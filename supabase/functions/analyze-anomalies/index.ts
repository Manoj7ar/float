import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { claudeComplete, parseJsonFromModel } from "../_shared/claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type TransactionRow = {
  amount: number;
  category: string | null;
  merchant_name: string | null;
  is_income: boolean | null;
  created: string | null;
  description: string | null;
};

type AnomalyInsight = {
  title: string;
  message: string;
  type: "critical" | "warning" | "info";
  action_label: string | null;
  action_type: "view_transactions" | "chat" | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { account_id: accountId } = await req.json();
    if (!accountId) throw new Error("account_id required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase service role configuration missing");
    }

    const sb = createClient(supabaseUrl, supabaseKey);

    const since = new Date();
    since.setDate(since.getDate() - 90);

    const { data: transactionsData, error: transactionsError } = await sb
      .from("transactions")
      .select("amount, category, merchant_name, is_income, created, description")
      .eq("account_id", accountId)
      .gte("created", since.toISOString())
      .order("created", { ascending: false });
    if (transactionsError) throw transactionsError;

    const transactions = (transactionsData ?? []) as TransactionRow[];

    if (transactions.length < 5) {
      return new Response(
        JSON.stringify({ insights: [], message: "Not enough transaction data" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const txSummary = transactions
      .slice(0, 100)
      .map((transaction) => {
        const direction = transaction.is_income ? "IN" : "OUT";
        const amountEur = (Math.abs(transaction.amount) / 100).toFixed(2);
        const label =
          transaction.merchant_name ||
          transaction.category ||
          transaction.description ||
          "unknown";
        return `${transaction.created}: ${direction} EUR ${amountEur} - ${label}`;
      })
      .join("\n");

    const prompt = `You are a financial anomaly detector for a small business.

Analyze these recent transactions and identify anomalies:
- unusual spending
- unexpected charges
- suspicious duplicates
- pattern breaks from normal behavior

Transactions (most recent first):
${txSummary}

Return ONLY a JSON array.
Each item must be:
{
  "title": "max 60 chars",
  "message": "max 150 chars",
  "type": "critical|warning|info",
  "action_label": "max 20 chars or null",
  "action_type": "view_transactions|chat|null"
}

If no anomalies are found, return [].`;

    const { text } = await claudeComplete({
      messages: [{ role: "user", content: prompt }],
      maxTokens: 1400,
      temperature: 0.2,
    });

    const anomalies = parseJsonFromModel<AnomalyInsight[]>(text, []);

    if (anomalies.length > 0) {
      const inserts = anomalies.slice(0, 5).map((insight) => ({
        account_id: accountId,
        title: insight.title,
        message: insight.message,
        type: insight.type || "warning",
        action_label: insight.action_label || null,
        action_type: insight.action_type || null,
        dismissed: false,
      }));

      await sb.from("ai_insights").insert(inserts);
    }

    return new Response(JSON.stringify({ insights: anomalies.slice(0, 5) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-anomalies error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

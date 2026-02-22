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
  is_income: boolean | null;
  category: string | null;
};

type InvoiceRow = {
  amount: number;
  status: string | null;
  paid_at: string | null;
};

type IncidentRow = {
  title: string | null;
  severity: string | null;
  status: string | null;
};

type AccountRow = {
  business_name: string | null;
  payroll_amount: number | null;
  currency: string | null;
};

type DigestHighlight = {
  label: string;
  value: string;
  trend: "up" | "down" | "neutral";
  good: boolean;
};

type DigestResponse = {
  summary: string;
  highlights: DigestHighlight[];
  recommendations: string[];
  risk_score: number;
  risk_label: "Healthy" | "Caution" | "At Risk" | "Critical";
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

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [transactionsResult, invoicesResult, incidentsResult, accountResult] = await Promise.all([
      sb
        .from("transactions")
        .select("amount, is_income, category")
        .eq("account_id", accountId)
        .gte("created", weekAgo.toISOString()),
      sb
        .from("invoices")
        .select("amount, status, paid_at")
        .eq("account_id", accountId),
      sb
        .from("incidents")
        .select("title, severity, status")
        .eq("account_id", accountId)
        .gte("opened_at", weekAgo.toISOString()),
      sb
        .from("accounts")
        .select("business_name, payroll_amount, currency")
        .eq("id", accountId)
        .single(),
    ]);

    if (transactionsResult.error) throw transactionsResult.error;
    if (invoicesResult.error) throw invoicesResult.error;
    if (incidentsResult.error) throw incidentsResult.error;
    if (accountResult.error) throw accountResult.error;

    const transactions = (transactionsResult.data ?? []) as TransactionRow[];
    const invoices = (invoicesResult.data ?? []) as InvoiceRow[];
    const incidents = (incidentsResult.data ?? []) as IncidentRow[];
    const account = accountResult.data as AccountRow | null;

    const totalIn = transactions
      .filter((item) => item.is_income)
      .reduce((sum, item) => sum + item.amount, 0);
    const totalOut = transactions
      .filter((item) => !item.is_income)
      .reduce((sum, item) => sum + Math.abs(item.amount), 0);
    const overdueInvoices = invoices.filter((item) => item.status === "overdue");
    const paidThisWeek = invoices.filter(
      (item) => item.paid_at && new Date(item.paid_at) >= weekAgo,
    );

    const spendingByCategory = transactions
      .filter((item) => !item.is_income)
      .reduce<Record<string, number>>((acc, item) => {
        const category = item.category || "Other";
        acc[category] = (acc[category] || 0) + Math.abs(item.amount);
        return acc;
      }, {});

    const topExpenseLines = Object.entries(spendingByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, amount]) => `  ${category}: EUR ${(amount / 100).toFixed(2)}`)
      .join("\n");

    const context = `Business: ${account?.business_name || "Unknown"}
Currency: ${account?.currency || "EUR"}
This week's income: EUR ${(totalIn / 100).toFixed(2)}
This week's expenses: EUR ${(totalOut / 100).toFixed(2)}
Net: EUR ${((totalIn - totalOut) / 100).toFixed(2)}
Total transactions: ${transactions.length}
Overdue invoices: ${overdueInvoices.length} totaling EUR ${(overdueInvoices.reduce((sum, invoice) => sum + invoice.amount, 0) / 100).toFixed(2)}
Invoices paid this week: ${paidThisWeek.length}
New incidents this week: ${incidents.length}
Payroll amount: EUR ${((account?.payroll_amount || 0) / 100).toFixed(2)}

Top expenses by category:
${topExpenseLines || "  none"}`;

    const prompt = `You are Float AI, an expert CFO assistant.

Generate a concise weekly financial digest for this business:
${context}

Return ONLY a JSON object:
{
  "summary": "2-3 sentence executive summary, max 200 chars",
  "highlights": [
    { "label": "...", "value": "...", "trend": "up|down|neutral", "good": true }
  ],
  "recommendations": ["...", "..."],
  "risk_score": 1-10,
  "risk_label": "Healthy|Caution|At Risk|Critical"
}`;

    const { text } = await claudeComplete({
      messages: [{ role: "user", content: prompt }],
      maxTokens: 1600,
      temperature: 0.2,
    });

    const fallbackDigest: DigestResponse = {
      summary: "Unable to generate digest right now.",
      highlights: [],
      recommendations: [],
      risk_score: 5,
      risk_label: "Caution",
    };

    const digest = parseJsonFromModel<DigestResponse>(text, fallbackDigest);

    return new Response(JSON.stringify(digest), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("weekly-digest error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

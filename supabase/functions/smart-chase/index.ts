import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { claudeComplete, parseJsonFromModel } from "../_shared/claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ChaseRanking = {
  invoice_id: string;
  score: number;
  priority: "high" | "medium" | "low";
  reason: string;
  best_channel: "call" | "email";
  best_time: string;
};

type InvoiceRow = {
  id: string;
  client_name: string | null;
  amount: number;
  due_date: string | null;
  status: string | null;
  client_phone: string | null;
  invoice_number: string | null;
};

type CallRow = {
  client_name: string | null;
  outcome: string | null;
  status: string | null;
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

    const { data: invoicesData, error: invoicesError } = await sb
      .from("invoices")
      .select("id, client_name, amount, due_date, status, client_phone, invoice_number")
      .eq("account_id", accountId)
      .in("status", ["unpaid", "overdue", "chasing"]);
    if (invoicesError) throw invoicesError;

    const { data: callsData, error: callsError } = await sb
      .from("calls")
      .select("client_name, outcome, status")
      .eq("account_id", accountId)
      .order("initiated_at", { ascending: false })
      .limit(20);
    if (callsError) throw callsError;

    const invoices = (invoicesData ?? []) as InvoiceRow[];
    const calls = (callsData ?? []) as CallRow[];

    if (invoices.length === 0) {
      return new Response(JSON.stringify({ rankings: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const invoiceSummary = invoices
      .map((invoice) => {
        const daysOverdue = invoice.due_date
          ? Math.max(
              0,
              Math.floor((Date.now() - new Date(invoice.due_date).getTime()) / 86400000),
            )
          : 0;

        return `${invoice.invoice_number ?? "N/A"} | ${invoice.client_name ?? "Unknown"} | EUR ${(invoice.amount / 100).toFixed(2)} | ${daysOverdue}d overdue | status: ${invoice.status ?? "unknown"} | phone: ${invoice.client_phone ? "yes" : "no"}`;
      })
      .join("\n");

    const callHistory = calls
      .map((call) => `${call.client_name ?? "Unknown"}: ${call.outcome || call.status || "none"}`)
      .join("; ");

    const prompt = `You are an AI accounts receivable specialist.

Rank these unpaid invoices by likelihood-to-pay and urgency to chase.

Invoices:
${invoiceSummary}

Past call outcomes: ${callHistory || "None"}

Return a JSON array sorted by chase priority (highest first). Each item must be:
{
  "invoice_id": "exact invoice id",
  "score": 1-100,
  "priority": "high" | "medium" | "low",
  "reason": "max 80 chars",
  "best_channel": "call" | "email",
  "best_time": "e.g. Morning 9-11am"
}

Return ONLY JSON.`;

    const { text } = await claudeComplete({
      messages: [{ role: "user", content: prompt }],
      maxTokens: 1400,
      temperature: 0.2,
    });

    const rankings = parseJsonFromModel<ChaseRanking[]>(text, []);

    return new Response(JSON.stringify({ rankings }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("smart-chase error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

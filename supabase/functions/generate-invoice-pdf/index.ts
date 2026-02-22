import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { invoice_id, account_id } = await req.json();
    if (!invoice_id || !account_id) throw new Error("invoice_id and account_id required");

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const [invRes, accRes] = await Promise.all([
      sb.from("invoices").select("*").eq("id", invoice_id).eq("account_id", account_id).single(),
      sb.from("accounts").select("business_name, currency").eq("id", account_id).single(),
    ]);

    if (!invRes.data) throw new Error("Invoice not found");
    const inv = invRes.data;
    const acc = accRes.data;
    const currency = acc?.currency || "EUR";
    const symbol = currency === "GBP" ? "£" : currency === "USD" ? "$" : "€";
    const amount = (inv.amount / 100).toFixed(2);

    // Generate an HTML invoice that can be printed/saved as PDF
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invoice ${inv.invoice_number || ""}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; padding: 40px; max-width: 800px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px; }
  .brand { font-size: 28px; font-weight: 700; color: #3b82f6; }
  .brand-sub { font-size: 12px; color: #666; margin-top: 4px; }
  .invoice-meta { text-align: right; }
  .invoice-number { font-size: 20px; font-weight: 600; color: #1a1a1a; }
  .invoice-date { font-size: 13px; color: #666; margin-top: 4px; }
  .parties { display: flex; justify-content: space-between; margin-bottom: 40px; }
  .party h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 8px; }
  .party p { font-size: 14px; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
  thead th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #999; padding: 12px 0; border-bottom: 2px solid #eee; }
  thead th:last-child { text-align: right; }
  tbody td { padding: 16px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
  tbody td:last-child { text-align: right; font-family: 'SF Mono', monospace; font-weight: 600; }
  .total-row { display: flex; justify-content: flex-end; margin-bottom: 40px; }
  .total-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 24px; text-align: right; }
  .total-label { font-size: 12px; color: #666; margin-bottom: 4px; }
  .total-value { font-size: 28px; font-weight: 700; font-family: 'SF Mono', monospace; color: #1a1a1a; }
  .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
  .status-paid { background: #d1fae5; color: #065f46; }
  .status-overdue { background: #fee2e2; color: #991b1b; }
  .status-unpaid { background: #dbeafe; color: #1e40af; }
  .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; text-align: center; }
  ${inv.stripe_payment_link ? '.pay-btn { display: inline-block; margin-top: 20px; padding: 12px 32px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; }' : ''}
  @media print { body { padding: 20px; } .pay-btn { display: none !important; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">Float</div>
      <div class="brand-sub">${acc?.business_name || "Business"}</div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-number">${inv.invoice_number || "INVOICE"}</div>
      <div class="invoice-date">${inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString("en-IE", { year: "numeric", month: "long", day: "numeric" }) : ""}</div>
      <div style="margin-top: 8px;">
        <span class="status ${inv.status === "paid" ? "status-paid" : inv.status === "overdue" ? "status-overdue" : "status-unpaid"}">${(inv.status || "unpaid").toUpperCase()}</span>
      </div>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <h3>From</h3>
      <p><strong>${acc?.business_name || "Your Business"}</strong></p>
    </div>
    <div class="party" style="text-align: right;">
      <h3>Bill To</h3>
      <p><strong>${inv.client_name}</strong></p>
      ${inv.client_email ? `<p>${inv.client_email}</p>` : ""}
      ${inv.client_phone ? `<p>${inv.client_phone}</p>` : ""}
    </div>
  </div>

  <table>
    <thead><tr><th>Description</th><th>Due Date</th><th>Amount</th></tr></thead>
    <tbody>
      <tr>
        <td>Invoice ${inv.invoice_number || ""}</td>
        <td>${inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-IE") : "—"}</td>
        <td>${symbol}${amount}</td>
      </tr>
    </tbody>
  </table>

  <div class="total-row">
    <div class="total-box">
      <div class="total-label">Total Due</div>
      <div class="total-value">${symbol}${amount}</div>
    </div>
  </div>

  ${inv.stripe_payment_link ? `<div style="text-align: center;"><a href="${inv.stripe_payment_link}" class="pay-btn">Pay Now →</a></div>` : ""}

  <div class="footer">
    Generated by Float · AI-powered financial management<br>
    ${new Date().toLocaleDateString("en-IE", { year: "numeric", month: "long", day: "numeric" })}
  </div>
</body>
</html>`;

    return new Response(html, {
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    console.error("generate-invoice-pdf error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

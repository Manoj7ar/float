import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { type, data } = body;

    // Monzo sends webhook events for transactions
    if (type === "transaction.created") {
      const txn = data;

      // Find account by monzo_account_id
      const { data: account } = await supabase
        .from("accounts")
        .select("id")
        .eq("monzo_account_id", txn.account_id)
        .single();

      if (!account) {
        console.warn("No account found for Monzo account:", txn.account_id);
        return new Response(JSON.stringify({ ok: true, skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Insert the transaction
      const isIncome = txn.amount > 0;
      const { error } = await supabase.from("transactions").insert({
        id: txn.id,
        account_id: account.id,
        amount: txn.amount, // Monzo sends in pence, positive = income
        merchant_name: txn.merchant?.name || txn.description || "Unknown",
        category: txn.category || "general",
        description: txn.description || txn.merchant?.name || "",
        is_income: isIncome,
        created: txn.created,
      });

      if (error) {
        // Duplicate transaction - that's fine
        if (error.code === "23505") {
          return new Response(JSON.stringify({ ok: true, duplicate: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.error("Transaction insert error:", error);
        throw error;
      }

      console.log("Transaction synced:", txn.id, txn.amount, txn.merchant?.name);

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle other webhook types gracefully
    console.log("Unhandled webhook type:", type);
    return new Response(JSON.stringify({ ok: true, unhandled: type }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("monzo-webhook error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

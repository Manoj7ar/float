import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      card_number,
      exp_month,
      exp_year,
      cvc,
      invoice_id,
      amount,
      client_name,
    } = await req.json();

    if (!card_number || !exp_month || !exp_year || !cvc) {
      throw new Error("Card details are required: card_number, exp_month, exp_year, cvc");
    }
    if (!invoice_id) {
      throw new Error("invoice_id is required");
    }
    if (!amount) {
      throw new Error("amount is required");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Create a PaymentMethod with the card details (test mode only)
    const paymentMethod = await stripe.paymentMethods.create({
      type: "card",
      card: {
        number: card_number,
        exp_month: parseInt(exp_month),
        exp_year: parseInt(exp_year),
        cvc: cvc,
      },
    });

    console.log("PaymentMethod created:", paymentMethod.id);

    // Create and confirm a PaymentIntent in one step
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // amount in cents
      currency: "eur",
      payment_method: paymentMethod.id,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
      description: `Invoice payment from ${client_name || "customer"} for invoice ${invoice_id}`,
    });

    console.log("PaymentIntent status:", paymentIntent.status);

    if (paymentIntent.status === "succeeded") {
      // Update the invoice in the database
      const { error: updateError } = await supabaseAdmin
        .from("invoices")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: paymentIntent.id,
        })
        .eq("id", invoice_id);

      if (updateError) {
        console.error("Failed to update invoice:", updateError);
      } else {
        console.log("Invoice marked as paid:", invoice_id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          payment_intent_id: paymentIntent.id,
          status: paymentIntent.status,
          message: `Payment of €${(amount / 100).toFixed(2)} processed successfully.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          status: paymentIntent.status,
          message: `Payment requires additional action: ${paymentIntent.status}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (e) {
    console.error("process-card-payment error:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

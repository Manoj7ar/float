import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type EmailProvider = "resend" | "sendgrid";

const toSafeString = (value: unknown) => String(value ?? "").trim();

const getAppBaseUrl = () =>
  (Deno.env.get("APP_BASE_URL") || Deno.env.get("FRONTEND_URL") || "https://floatyouraicfo.com").replace(/\/+$/, "");

const resolveEmailProvider = (): EmailProvider => {
  const explicit = toSafeString(Deno.env.get("EMAIL_PROVIDER")).toLowerCase();
  const hasResend = !!Deno.env.get("RESEND_API_KEY");
  const hasSendgrid = !!Deno.env.get("SENDGRID_API_KEY");

  if (explicit) {
    if (explicit === "resend") {
      if (!hasResend) throw new Error("EMAIL_PROVIDER is resend but RESEND_API_KEY is missing");
      return "resend";
    }
    if (explicit === "sendgrid") {
      if (!hasSendgrid) throw new Error("EMAIL_PROVIDER is sendgrid but SENDGRID_API_KEY is missing");
      return "sendgrid";
    }
    throw new Error("EMAIL_PROVIDER must be either resend or sendgrid");
  }

  if (hasResend) return "resend";
  if (hasSendgrid) return "sendgrid";
  throw new Error("No email provider configured. Set RESEND_API_KEY or SENDGRID_API_KEY.");
};

async function sendPaymentEmail({
  provider,
  to,
  subject,
  html,
  text,
}: {
  provider: EmailProvider;
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const from = toSafeString(Deno.env.get("EMAIL_FROM"));
  if (!from) throw new Error("EMAIL_FROM is required");

  if (provider === "resend") {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY is missing");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Resend failed: ${response.status} ${detail}`);
    }
    return "sent_via_resend";
  }

  const sendgridKey = Deno.env.get("SENDGRID_API_KEY");
  if (!sendgridKey) throw new Error("SENDGRID_API_KEY is missing");

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sendgridKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from },
      subject,
      content: [
        { type: "text/plain", value: text },
        { type: "text/html", value: html },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`SendGrid failed: ${response.status} ${detail}`);
  }
  return "sent_via_sendgrid";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase service credentials are missing");
    if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is missing");

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2025-08-27.basil",
    });

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const invoiceId = toSafeString(body.invoice_id);
    let invoiceNumber = toSafeString(body.invoice_number);
    let clientName = toSafeString(body.client_name);
    let clientEmail = toSafeString(body.client_email);
    const callId = toSafeString(body.call_id);
    const rawAmount = Number(body.amount_cents ?? body.amount ?? 0);
    const currency = toSafeString(body.currency || "eur").toLowerCase();
    let amountCents = Number.isFinite(rawAmount) ? Math.round(rawAmount) : 0;

    if (invoiceId) {
      const { data: invoice, error: invoiceError } = await supabaseAdmin
        .from("invoices")
        .select("id, amount, client_name, client_email, invoice_number")
        .eq("id", invoiceId)
        .single();

      if (invoiceError) {
        throw new Error(`Failed to load invoice ${invoiceId}: ${invoiceError.message}`);
      }

      if (!invoiceNumber) invoiceNumber = toSafeString(invoice.invoice_number);
      if (!clientName) clientName = toSafeString(invoice.client_name);
      if (!clientEmail) clientEmail = toSafeString(invoice.client_email);
      if (!amountCents) amountCents = Number(invoice.amount || 0);
    }

    if (!clientEmail) {
      throw new Error("No client_email available. Provide client_email or set it on the invoice.");
    }
    if (!amountCents || amountCents <= 0) {
      throw new Error("Invalid amount. Provide amount_cents/amount or link a valid invoice.");
    }

    const descriptor = invoiceNumber ? `invoice ${invoiceNumber}` : "your invoice";
    const appBaseUrl = getAppBaseUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: clientEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: amountCents,
            product_data: {
              name: invoiceNumber ? `Payment for ${invoiceNumber}` : "Invoice payment",
              description: clientName ? `Requested for ${clientName}` : undefined,
            },
          },
        },
      ],
      metadata: {
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
        client_name: clientName,
        call_id: callId,
      },
      success_url: `${appBaseUrl}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBaseUrl}/payments/cancel`,
    });

    if (!session.url) throw new Error("Stripe checkout session URL was not returned");

    if (invoiceId) {
      const { error: updateError } = await supabaseAdmin
        .from("invoices")
        .update({ stripe_payment_link: session.url })
        .eq("id", invoiceId);
      if (updateError) {
        console.error("Failed to store stripe_payment_link:", updateError.message);
      }
    }

    const provider = resolveEmailProvider();
    const subject = invoiceNumber ? `Payment link for ${invoiceNumber}` : "Your payment link";
    const text =
      `Hi ${clientName || "there"},\n\n` +
      `As discussed on our call, here is your secure payment link for ${descriptor}.\n\n` +
      `${session.url}\n\n` +
      "Thank you.";
    const html =
      `<p>Hi ${clientName || "there"},</p>` +
      `<p>As discussed on our call, here is your secure payment link for <strong>${descriptor}</strong>.</p>` +
      `<p><a href="${session.url}">Pay securely now</a></p>` +
      `<p>If the button does not work, use this link:<br/>${session.url}</p>` +
      "<p>Thank you.</p>";

    const emailStatus = await sendPaymentEmail({
      provider,
      to: clientEmail,
      subject,
      html,
      text,
    });

    return new Response(
      JSON.stringify({
        success: true,
        payment_url: session.url,
        client_email: clientEmail,
        email_status: emailStatus,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("send-payment-link error:", message);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

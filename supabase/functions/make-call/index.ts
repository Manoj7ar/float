import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const escapeXml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!TWILIO_ACCOUNT_SID) throw new Error("TWILIO_ACCOUNT_SID is not configured");
    if (!TWILIO_AUTH_TOKEN) throw new Error("TWILIO_AUTH_TOKEN is not configured");
    if (!TWILIO_PHONE_NUMBER) throw new Error("TWILIO_PHONE_NUMBER is not configured");

    const { to, clientName, invoiceNumber, invoiceId, amount, dueDate, callId } = await req.json();

    if (!to) throw new Error("'to' phone number is required");
    if (!clientName) throw new Error("'clientName' is required");

    const amountFormatted = `EUR ${(amount / 100).toLocaleString("en-IE", { minimumFractionDigits: 2 })}`;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const wsUrl = SUPABASE_URL.replace("https://", "wss://") + "/functions/v1/twilio-media-stream";

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}">
      <Parameter name="clientName" value="${escapeXml(clientName)}" />
      <Parameter name="invoiceNumber" value="${escapeXml(invoiceNumber || "")}" />
      <Parameter name="amount" value="${escapeXml(amountFormatted)}" />
      <Parameter name="amountCents" value="${escapeXml(amount || 0)}" />
      <Parameter name="dueDate" value="${escapeXml(dueDate || "")}" />
      <Parameter name="invoiceId" value="${escapeXml(invoiceId || "")}" />
      <Parameter name="callId" value="${escapeXml(callId || "")}" />
    </Stream>
  </Connect>
</Response>`;

    const authString = base64Encode(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const params = new URLSearchParams();
    params.append("To", to);
    params.append("From", TWILIO_PHONE_NUMBER);
    params.append("Twiml", twiml);
    if (callId) {
      params.append("StatusCallback", `${SUPABASE_URL}/functions/v1/twilio-status-callback?callId=${callId}`);
    }
    params.append("StatusCallbackEvent", "completed");

    const twilioResponse = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authString}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
    );

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("Twilio error:", JSON.stringify(twilioData));
      throw new Error(`Twilio API error: ${twilioData.message || twilioData.code || twilioResponse.status}`);
    }

    console.log("Call initiated:", twilioData.sid);

    return new Response(
      JSON.stringify({
        success: true,
        callSid: twilioData.sid,
        status: twilioData.status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("make-call error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

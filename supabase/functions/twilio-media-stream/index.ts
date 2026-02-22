import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ELEVENLABS_AGENT_ID =
  Deno.env.get("ELEVENLABS_AGENT_ID") ?? "agent_0601kj0ahmzeej18y9xp6av1bdrh";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// μ-law to 16-bit linear PCM decode table
const MULAW_DECODE: Int16Array = new Int16Array(256);
for (let i = 0; i < 256; i++) {
  const mu = ~i & 0xff;
  const sign = mu & 0x80;
  const exponent = (mu >> 4) & 0x07;
  const mantissa = mu & 0x0f;
  let magnitude = ((mantissa << 3) + 0x84) << exponent;
  magnitude -= 0x84;
  MULAW_DECODE[i] = sign !== 0 ? -magnitude : magnitude;
}

// Encode a 16-bit linear PCM sample to μ-law byte
function linearToMulaw(sample: number): number {
  const BIAS = 0x84;
  const MAX = 32635;
  let sign = 0;
  if (sample < 0) {
    sign = 0x80;
    sample = -sample;
  }
  if (sample > MAX) sample = MAX;
  sample += BIAS;
  let exponent = 7;
  let mask = 0x4000;
  while (exponent > 0 && (sample & mask) === 0) {
    exponent--;
    mask >>= 1;
  }
  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

// Convert base64 μ-law 8kHz → base64 PCM 16-bit 16kHz (upsample 2×)
function mulawToLinear16k(b64: string): string {
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const out = new Int16Array(raw.length * 2);
  for (let i = 0; i < raw.length; i++) {
    const s = MULAW_DECODE[raw[i]];
    const next = i < raw.length - 1 ? MULAW_DECODE[raw[i + 1]] : s;
    out[i * 2] = s;
    out[i * 2 + 1] = ((s + next) >> 1) as number;
  }
  const bytes = new Uint8Array(out.buffer);
  let bin = "";
  for (let j = 0; j < bytes.length; j++) bin += String.fromCharCode(bytes[j]);
  return btoa(bin);
}

// Convert base64 PCM 16-bit 16kHz → base64 μ-law 8kHz (downsample 2×)
function linear16kToMulaw(b64: string): string {
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const samples = new Int16Array(raw.buffer);
  const half = Math.floor(samples.length / 2);
  const out = new Uint8Array(half);
  for (let i = 0; i < half; i++) {
    out[i] = linearToMulaw(samples[i * 2]);
  }
  let bin = "";
  for (let j = 0; j < out.length; j++) bin += String.fromCharCode(out[j]);
  return btoa(bin);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Upgrade HTTP → WebSocket for Twilio's <Connect><Stream>
  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 426 });
  }

  const { socket: twilioWs, response } = Deno.upgradeWebSocket(req);

  let elevenLabsWs: WebSocket | null = null;
  let streamSid: string | null = null;
  let useConversion = true; // assume PCM ↔ μ-law conversion needed

  twilioWs.onopen = () => {
    console.log("[Bridge] Twilio WebSocket connected");
  };

  twilioWs.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data as string);

      switch (msg.event) {
        case "start": {
          streamSid = msg.start.streamSid;
          const customParams = msg.start.customParameters || {};
          console.log("[Bridge] Stream started:", streamSid, "params:", JSON.stringify(customParams));

          // Get ElevenLabs signed URL
          const apiKey = Deno.env.get("ELEVENLABS_API_KEY")!;
          const res = await fetch(
            `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${ELEVENLABS_AGENT_ID}`,
            { headers: { "xi-api-key": apiKey } }
          );

          if (!res.ok) {
            const errText = await res.text();
            console.error("[Bridge] Failed to get signed URL:", res.status, errText);
            twilioWs.close();
            return;
          }

          const { signed_url } = await res.json();
          console.log("[Bridge] Connecting to ElevenLabs agent...");

          elevenLabsWs = new WebSocket(signed_url);

          elevenLabsWs.onopen = () => {
            console.log("[Bridge] ElevenLabs WebSocket connected");

            const clientName = customParams.clientName || "the client";
            const invoiceNumber = customParams.invoiceNumber || "on file";
            const amount = customParams.amount || "an outstanding amount";
            const dueDate = customParams.dueDate || "recently";

            // Send dynamic context + conversation override with payment collection instructions
            const initPayload = {
              type: "conversation_initiation_client_data",
              dynamic_variables: {
                client_name: clientName,
                invoice_number: invoiceNumber,
                amount: amount,
                due_date: dueDate,
              },
              conversation_config_override: {
                agent: {
                  prompt: {
                    prompt: `You are Aria, a friendly and professional accounts receivable assistant calling on behalf of a business. You are calling ${clientName} about their overdue invoice ${invoiceNumber} for ${amount}, which was due ${dueDate}.

Your goals (in order):
1. Greet the customer politely and confirm you're speaking with the right person.
2. Remind them about the overdue invoice and ask if they can arrange payment today.
3. If they agree to pay NOW by card, collect their card details one at a time:
   - Card number (16 digits)
   - Expiry month (2 digits, e.g. 01-12)
   - Expiry year (2 digits, e.g. 26 for 2026)
   - CVC / security code (3 digits on the back of the card)
4. Once you have ALL four details, use the "process_payment" tool to process the payment.
5. After the tool responds, tell the customer whether the payment was successful or failed.
6. If they can't pay now, be understanding — ask when they expect to pay and thank them for their time.

IMPORTANT RULES:
- Be polite, empathetic, and professional at all times.
- Collect card details ONE FIELD AT A TIME. Confirm each before moving to the next.
- Read back the card number to confirm it before proceeding.
- NEVER repeat the full card number or CVC back after collecting it — just confirm "got it".
- Keep responses SHORT since this is a phone call.
- If the payment fails, apologise and suggest they try a different card or call back.`,
                  },
                  first_message: `Hello! Am I speaking with someone from ${clientName}? This is Aria calling about invoice ${invoiceNumber} for ${amount}. I wanted to check in and see if we can arrange payment today. Is now a good time to talk?`,
                },
              },
            };
            console.log("[Bridge] Sending init payload:", JSON.stringify(initPayload).slice(0, 300));
            elevenLabsWs!.send(JSON.stringify(initPayload));
          };

          let audioChunkCount = 0;
          elevenLabsWs.onmessage = async (elEvent) => {
            try {
              const data = JSON.parse(elEvent.data as string);
              
              // Log ALL event types for debugging
              console.log("[Bridge] ElevenLabs event type:", data.type, data.type === "audio" ? `(chunk #${audioChunkCount + 1})` : "");

              if (data.type === "audio" && data.audio_event?.audio_base_64 && streamSid) {
                audioChunkCount++;
                if (audioChunkCount <= 5) {
                  console.log("[Bridge] ElevenLabs → Twilio audio chunk #" + audioChunkCount, "size:", data.audio_event.audio_base_64.length);
                }
                // ElevenLabs → Twilio: convert PCM 16kHz to μ-law 8kHz
                const payload = useConversion
                  ? linear16kToMulaw(data.audio_event.audio_base_64)
                  : data.audio_event.audio_base_64;

                twilioWs.send(
                  JSON.stringify({
                    event: "media",
                    streamSid,
                    media: { payload },
                  })
                );
              }

              if (data.type === "conversation_initiation_metadata") {
                console.log("[Bridge] ElevenLabs conversation started:", JSON.stringify(data).slice(0, 200));
                // Check if ElevenLabs is already using μ-law 8000
                const outputFmt = data.conversation_initiation_metadata_event?.agent_output_audio_format;
                if (outputFmt === "ulaw_8000") {
                  useConversion = false;
                  console.log("[Bridge] Agent outputs μ-law 8kHz — no conversion needed");
                }
              }

              if (data.type === "agent_response") {
                console.log("[Bridge] Agent said:", data.agent_response_event?.agent_response?.slice(0, 100));
              }

              // Handle server tool calls from ElevenLabs (e.g. process_payment)
              if (data.type === "client_tool_call") {
                const { tool_name, tool_call_id, parameters } = data.client_tool_call || {};
                console.log("[Bridge] Tool call:", tool_name, "id:", tool_call_id, "params:", JSON.stringify(parameters));

                if (tool_name === "process_payment") {
                  try {
                    const paymentRes = await fetch(
                      `${SUPABASE_URL}/functions/v1/process-card-payment`,
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          "apikey": SUPABASE_ANON_KEY,
                          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                        },
                        body: JSON.stringify({
                          card_number: parameters.card_number,
                          exp_month: parameters.exp_month,
                          exp_year: parameters.exp_year,
                          cvc: parameters.cvc,
                          invoice_id: customParams.invoiceId || parameters.invoice_id,
                          amount: parameters.amount_cents || parseInt(String(customParams.amountCents || "0")),
                          client_name: customParams.clientName || parameters.client_name,
                        }),
                      }
                    );
                    const paymentResult = await paymentRes.json();
                    console.log("[Bridge] Payment result:", JSON.stringify(paymentResult));

                    // Send tool result back to ElevenLabs
                    elevenLabsWs!.send(
                      JSON.stringify({
                        type: "client_tool_result",
                        tool_call_id,
                        result: paymentResult.success
                          ? `Payment successful! ${paymentResult.message}`
                          : `Payment failed: ${paymentResult.error || paymentResult.message}`,
                        is_error: !paymentResult.success,
                      })
                    );
                  } catch (payErr) {
                    console.error("[Bridge] Payment processing error:", payErr);
                    elevenLabsWs!.send(
                      JSON.stringify({
                        type: "client_tool_result",
                        tool_call_id,
                        result: "Payment processing failed due to a technical error. Please try again later.",
                        is_error: true,
                      })
                    );
                  }
                }
              }

              // Log other message types for debugging
              if (!["audio", "conversation_initiation_metadata", "agent_response", "client_tool_call"].includes(data.type)) {
                console.log("[Bridge] ElevenLabs event:", data.type);
              }
            } catch (e) {
              console.error("[Bridge] Error handling ElevenLabs msg:", e);
            }
          };

          elevenLabsWs.onclose = (ev) => {
            console.log("[Bridge] ElevenLabs closed:", ev.code, ev.reason);
          };

          elevenLabsWs.onerror = (e) => {
            console.error("[Bridge] ElevenLabs error:", e);
          };
          break;
        }

        case "media": {
          if (elevenLabsWs?.readyState === WebSocket.OPEN) {
            // Twilio → ElevenLabs: convert μ-law 8kHz to PCM 16kHz
            const audioChunk = useConversion
              ? mulawToLinear16k(msg.media.payload)
              : msg.media.payload;

            elevenLabsWs.send(
              JSON.stringify({ user_audio_chunk: audioChunk })
            );
          } else if (elevenLabsWs) {
            console.log("[Bridge] ElevenLabs not ready, state:", elevenLabsWs.readyState);
          }
          break;
        }

        case "stop":
          console.log("[Bridge] Twilio stream stopped");
          elevenLabsWs?.close();
          break;
      }
    } catch (e) {
      console.error("[Bridge] Error processing Twilio msg:", e);
    }
  };

  twilioWs.onclose = () => {
    console.log("[Bridge] Twilio WebSocket closed");
    elevenLabsWs?.close();
  };

  twilioWs.onerror = (e) => {
    console.error("[Bridge] Twilio WebSocket error:", e);
  };

  return response;
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const callId = url.searchParams.get("callId");

    // Parse Twilio's form-encoded callback
    const formData = await req.formData();
    const callStatus = formData.get("CallStatus") as string;
    const callDuration = formData.get("CallDuration") as string;

    console.log(`Status callback: callId=${callId}, status=${callStatus}, duration=${callDuration}`);

    if (callId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const updates: Record<string, unknown> = {
        status: callStatus === "completed" ? "completed" : "failed",
        completed_at: new Date().toISOString(),
      };

      if (callDuration) {
        updates.duration_seconds = parseInt(callDuration, 10);
      }

      if (callStatus === "completed") {
        updates.outcome = `Call completed successfully. Duration: ${callDuration || 0}s`;
      } else {
        updates.outcome = `Call ${callStatus}`;
      }

      await supabase.from("calls").update(updates).eq("id", callId);
    }

    return new Response("OK", {
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  } catch (e) {
    console.error("Status callback error:", e);
    return new Response("Error", { status: 500 });
  }
});

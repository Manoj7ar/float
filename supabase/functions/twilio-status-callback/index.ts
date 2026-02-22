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

      const normalizedStatus = (callStatus || "").toLowerCase();
      const statusMap: Record<string, "initiated" | "in-progress" | "completed" | "failed"> = {
        queued: "initiated",
        initiated: "initiated",
        ringing: "initiated",
        "in-progress": "in-progress",
        answered: "in-progress",
        completed: "completed",
        busy: "failed",
        failed: "failed",
        "no-answer": "failed",
        canceled: "failed",
        cancelled: "failed",
      };
      const mappedStatus = statusMap[normalizedStatus] ?? (normalizedStatus === "completed" ? "completed" : "failed");
      const isTerminal = mappedStatus === "completed" || mappedStatus === "failed";

      const updates: Record<string, unknown> = {
        status: mappedStatus,
      };

      if (isTerminal) {
        updates.completed_at = new Date().toISOString();
      }

      if (callDuration) {
        const parsedDuration = parseInt(callDuration, 10);
        if (!Number.isNaN(parsedDuration)) {
          updates.duration_seconds = parsedDuration;
        }
      }

      if (mappedStatus === "completed") {
        updates.outcome = `Call completed successfully. Duration: ${callDuration || 0}s`;
      } else if (mappedStatus === "failed") {
        updates.outcome = `Call ${callStatus}`;
      }

      const { error: updateError } = await supabase.from("calls").update(updates).eq("id", callId);
      if (updateError) {
        console.error("Failed to update call status:", updateError);
      }
    }

    return new Response("OK", {
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  } catch (e) {
    console.error("Status callback error:", e);
    return new Response("Error", { status: 500 });
  }
});

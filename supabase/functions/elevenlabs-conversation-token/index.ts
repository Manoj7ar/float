import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not configured");
    const DEFAULT_AGENT_ID =
      Deno.env.get("ELEVENLABS_AGENT_ID") ?? "agent_0601kj0ahmzeej18y9xp6av1bdrh";

    const { agentId } = await req.json().catch(() => ({ agentId: undefined as string | undefined }));
    const effectiveAgentId = agentId || DEFAULT_AGENT_ID;
    if (!effectiveAgentId) throw new Error("agentId is required");

    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${effectiveAgentId}`,
      {
        headers: { "xi-api-key": ELEVENLABS_API_KEY },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("ElevenLabs token error:", response.status, text);
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const data = await response.json();

    return new Response(JSON.stringify({ token: data.token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Token error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

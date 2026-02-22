import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  ClaudeApiError,
  claudeStreamAsOpenAiSse,
  type ClaudeMessage,
} from "../_shared/claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type IncidentEvent = {
  type?: string;
  message?: string;
};

type IncidentContextRow = {
  title: string | null;
  severity: string | null;
  status: string | null;
  shortfall_amount: number | null;
  events: unknown;
};

type CallContextRow = {
  client_name: string | null;
  status: string | null;
  outcome: string | null;
  transcript: string | null;
};

function toClaudeMessages(rawMessages: unknown): ClaudeMessage[] {
  if (!Array.isArray(rawMessages)) return [];

  const messages: ClaudeMessage[] = [];
  for (const item of rawMessages) {
    if (!item || typeof item !== "object") continue;
    const role = "role" in item ? item.role : undefined;
    const content = "content" in item ? item.content : undefined;

    if ((role !== "user" && role !== "assistant") || typeof content !== "string") {
      continue;
    }
    if (!content.trim()) continue;
    messages.push({ role, content });
  }

  return messages;
}

function buildSystemPrompt(incidentContext: string) {
  return `You are Float AI, an expert AI CFO assistant for small businesses.

You help business owners understand cashflow, invoices, payroll, and financial health.

Rules:
- Money is stored in cents/pence. Convert to EUR for display (divide by 100).
- Be concise, actionable, and empathetic.
- Use markdown formatting for clarity.
- If asked about non-finance topics, politely redirect.
- You continuously learn from past incidents and collection calls.
- When referencing incidents, use phrasing like:
  - "Based on what I learned from incident..."
  - "From our past experience with..."
${incidentContext}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const accountId = typeof body.account_id === "string" ? body.account_id : null;
    const messages = toClaudeMessages(body.messages);

    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: "No valid messages provided." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let incidentContext = "";

    if (accountId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        if (supabaseUrl && serviceRoleKey) {
          const sb = createClient(supabaseUrl, serviceRoleKey);

          const { data: incidentsData } = await sb
            .from("incidents")
            .select("title, severity, status, shortfall_amount, events")
            .eq("account_id", accountId)
            .order("opened_at", { ascending: false })
            .limit(20);

          const { data: callsData } = await sb
            .from("calls")
            .select("client_name, status, outcome, transcript")
            .eq("account_id", accountId)
            .order("initiated_at", { ascending: false })
            .limit(10);

          const incidents = (incidentsData ?? []) as IncidentContextRow[];
          const calls = (callsData ?? []) as CallContextRow[];

          if (incidents.length > 0) {
            const summaries = incidents
              .map((incident) => {
                const events = Array.isArray(incident.events)
                  ? (incident.events as IncidentEvent[])
                  : [];

                const eventSummary = events
                  .map((event) => {
                    const eventType = event.type ?? "event";
                    const eventMessage = event.message ?? "";
                    return `${eventType}: ${eventMessage}`.trim();
                  })
                  .filter(Boolean)
                  .join("; ");

                const shortfall =
                  typeof incident.shortfall_amount === "number"
                    ? `EUR ${(incident.shortfall_amount / 100).toFixed(2)}`
                    : "N/A";

                return `- [${incident.severity ?? "unknown"}/${incident.status ?? "unknown"}] "${incident.title ?? "Untitled"}" - Shortfall: ${shortfall}. Events: ${eventSummary || "none"}`;
              })
              .join("\n");

            incidentContext += `\n\n## Past Incidents (AI Learnings)\nReference these where relevant:\n${summaries}`;
          }

          if (calls.length > 0) {
            const callSummaries = calls
              .map((call) => {
                const snippet = call.transcript ? ` Transcript snippet: ${call.transcript.slice(0, 200)}` : "";
                return `- Call to ${call.client_name ?? "Unknown"} [${call.status ?? "unknown"}]: Outcome: ${call.outcome ?? "pending"}.${snippet}`;
              })
              .join("\n");

            incidentContext += `\n\n## Call History Learnings\nReference these outcomes and patterns where relevant:\n${callSummaries}`;
          }
        }
      } catch (contextError) {
        console.error("Failed to fetch context for chat:", contextError);
      }
    }

    const stream = await claudeStreamAsOpenAiSse({
      system: buildSystemPrompt(incidentContext),
      messages,
      maxTokens: 1400,
      temperature: 0.3,
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("chat error:", error);

    if (error instanceof ClaudeApiError) {
      if (error.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ error: "Claude API request failed." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

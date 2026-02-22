import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  claudeComplete,
  parseJsonFromModel,
  type ClaudeMessageContent,
} from "../_shared/claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ExtractedInvoice = {
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  invoice_number: string | null;
  amount: number;
  invoice_date: string | null;
  due_date: string | null;
};

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function normalizeExtractedInvoice(data: Partial<ExtractedInvoice>): ExtractedInvoice {
  const rawAmount = typeof data.amount === "number" ? data.amount : Number(data.amount ?? 0);
  const safeAmount = Number.isFinite(rawAmount) ? Math.max(0, Math.round(rawAmount)) : 0;

  return {
    client_name: normalizeString(data.client_name),
    client_email: normalizeString(data.client_email),
    client_phone: normalizeString(data.client_phone),
    invoice_number: normalizeString(data.invoice_number),
    amount: safeAmount,
    invoice_date: normalizeDate(data.invoice_date),
    due_date: normalizeDate(data.due_date),
  };
}

function buildFileContentBlock(file: File, base64Data: string): ClaudeMessageContent {
  const mediaType = file.type || "application/octet-stream";

  if (mediaType === "application/pdf") {
    return {
      type: "document",
      source: {
        type: "base64",
        media_type: mediaType,
        data: base64Data,
      },
    };
  }

  if (mediaType.startsWith("image/")) {
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType,
        data: base64Data,
      },
    };
  }

  throw new Error(`Unsupported file type: ${mediaType}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase service role configuration missing");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (accountError || !account) throw new Error("No account found");

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("No file provided");

    const arrayBuffer = await file.arrayBuffer();
    const base64Data = base64Encode(new Uint8Array(arrayBuffer));
    const fileContentBlock = buildFileContentBlock(file, base64Data);

    const extractionInstruction = `Extract invoice data and return ONLY valid JSON:
{
  "client_name": "string or null",
  "client_email": "string or null",
  "client_phone": "string or null",
  "invoice_number": "string or null",
  "amount": number in cents (integer, positive),
  "invoice_date": "YYYY-MM-DD or null",
  "due_date": "YYYY-MM-DD or null"
}

If a field is unknown, use null.
Amount is required; if unknown, use 0.`;

    const { text } = await claudeComplete({
      system: "You extract structured invoice fields from uploaded documents.",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: extractionInstruction },
            { type: "text", text: `File name: ${file.name}` },
            fileContentBlock,
          ],
        },
      ],
      maxTokens: 1200,
      temperature: 0,
    });

    const parsed = parseJsonFromModel<Partial<ExtractedInvoice>>(text, {});
    const extracted = normalizeExtractedInvoice(parsed);

    let status = "unpaid";
    if (extracted.due_date) {
      const dueDate = new Date(extracted.due_date);
      if (!Number.isNaN(dueDate.getTime()) && dueDate < new Date()) {
        status = "overdue";
      }
    }

    const { data: invoice, error: insertError } = await supabase
      .from("invoices")
      .insert({
        account_id: account.id,
        client_name: extracted.client_name || "Unknown Client",
        client_email: extracted.client_email,
        client_phone: extracted.client_phone,
        invoice_number: extracted.invoice_number,
        amount: extracted.amount,
        invoice_date: extracted.invoice_date,
        due_date: extracted.due_date,
        status,
      })
      .select()
      .single();
    if (insertError) throw new Error(`Failed to create invoice: ${insertError.message}`);

    return new Response(JSON.stringify({ success: true, invoice, extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("extract-invoice error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

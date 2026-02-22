const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-5";
const ANTHROPIC_VERSION = Deno.env.get("ANTHROPIC_VERSION") ?? "2023-06-01";

const encoder = new TextEncoder();

type ClaudeRole = "user" | "assistant";

type ClaudeTextContent = {
  type: "text";
  text: string;
};

type ClaudeImageContent = {
  type: "image";
  source: {
    type: "base64";
    media_type: string;
    data: string;
  };
};

type ClaudeDocumentContent = {
  type: "document";
  source: {
    type: "base64";
    media_type: string;
    data: string;
  };
};

export type ClaudeMessageContent = ClaudeTextContent | ClaudeImageContent | ClaudeDocumentContent;

export type ClaudeMessage = {
  role: ClaudeRole;
  content: string | ClaudeMessageContent[];
};

type ClaudeRequestOptions = {
  model?: string;
  system?: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  temperature?: number;
};

type ClaudeApiErrorDetails = {
  status: number;
  body: string;
};

export class ClaudeApiError extends Error {
  status: number;
  body: string;

  constructor(message: string, details: ClaudeApiErrorDetails) {
    super(message);
    this.status = details.status;
    this.body = details.body;
  }
}

function getApiKey() {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  return apiKey;
}

function makeHeaders(apiKey: string) {
  return {
    "x-api-key": apiKey,
    "anthropic-version": ANTHROPIC_VERSION,
    "content-type": "application/json",
  };
}

async function parseError(response: Response) {
  const body = await response.text();
  throw new ClaudeApiError("Claude API request failed", {
    status: response.status,
    body,
  });
}

function extractTextFromClaudeResponse(data: Record<string, unknown>) {
  const content = data.content;
  if (!Array.isArray(content)) return "";

  return content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      if (!("type" in block) || block.type !== "text") return "";
      if (!("text" in block) || typeof block.text !== "string") return "";
      return block.text;
    })
    .join("");
}

export async function claudeComplete(options: ClaudeRequestOptions) {
  const apiKey = getApiKey();
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: makeHeaders(apiKey),
    body: JSON.stringify({
      model: options.model ?? DEFAULT_MODEL,
      system: options.system,
      messages: options.messages,
      max_tokens: options.maxTokens ?? 1200,
      temperature: options.temperature ?? 0.2,
    }),
  });

  if (!response.ok) {
    await parseError(response);
  }

  const data = await response.json();
  const text = extractTextFromClaudeResponse(data as Record<string, unknown>);
  return { data, text };
}

function parseSseEvent(rawEvent: string) {
  const lines = rawEvent.split("\n");
  let eventName: string | null = null;
  const dataLines: string[] = [];

  for (const lineRaw of lines) {
    const line = lineRaw.endsWith("\r") ? lineRaw.slice(0, -1) : lineRaw;
    if (!line) continue;
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (!eventName && dataLines.length === 0) return null;
  return {
    eventName,
    data: dataLines.join("\n"),
  };
}

function toOpenAiDeltaChunk(content: string) {
  return `data: ${JSON.stringify({
    choices: [{ delta: { content } }],
  })}\n\n`;
}

export async function claudeStreamAsOpenAiSse(options: ClaudeRequestOptions) {
  const apiKey = getApiKey();
  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: makeHeaders(apiKey),
    body: JSON.stringify({
      model: options.model ?? DEFAULT_MODEL,
      system: options.system,
      messages: options.messages,
      max_tokens: options.maxTokens ?? 1200,
      temperature: options.temperature ?? 0.2,
      stream: true,
    }),
  });

  if (!response.ok) {
    await parseError(response);
  }

  if (!response.body) {
    throw new Error("Claude API returned an empty stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          buffer = buffer.replace(/\r\n/g, "\n");

          let splitIndex = buffer.indexOf("\n\n");
          while (splitIndex !== -1) {
            const rawEvent = buffer.slice(0, splitIndex);
            buffer = buffer.slice(splitIndex + 2);
            splitIndex = buffer.indexOf("\n\n");

            const parsed = parseSseEvent(rawEvent);
            if (!parsed) continue;

            if (parsed.eventName === "content_block_delta") {
              try {
                const payload = JSON.parse(parsed.data) as {
                  delta?: { type?: string; text?: string };
                };
                if (payload.delta?.type === "text_delta" && payload.delta.text) {
                  controller.enqueue(encoder.encode(toOpenAiDeltaChunk(payload.delta.text)));
                }
              } catch {
                // Ignore malformed delta payloads and continue streaming.
              }
              continue;
            }

            if (parsed.eventName === "message_stop") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }

            if (parsed.eventName === "error") {
              let detail = "Unknown Claude streaming error";
              try {
                const payload = JSON.parse(parsed.data) as { error?: { message?: string } };
                if (payload.error?.message) detail = payload.error.message;
              } catch {
                // Keep default message.
              }
              controller.error(new Error(detail));
              return;
            }
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });
}

export function parseJsonFromModel<T>(rawText: string, fallback: T): T {
  const cleaned = rawText
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();

  if (!cleaned) return fallback;

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const candidates = [
      cleaned.match(/\[[\s\S]*\]/)?.[0],
      cleaned.match(/\{[\s\S]*\}/)?.[0],
    ].filter((candidate): candidate is string => Boolean(candidate));

    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate) as T;
      } catch {
        // Try next candidate.
      }
    }

    return fallback;
  }
}

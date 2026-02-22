import { useState, useRef, useEffect, useCallback } from "react";
import { Send, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccount } from "@/hooks/useAccount";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { useToast } from "@/hooks/use-toast";
import { getDemoChatMessages } from "@/lib/demo-content";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const QUICK_PROMPTS = [
  "What did Float learn from past incidents?",
  "What's my cashflow outlook?",
  "Which invoices are overdue?",
  "Can I afford payroll this month?",
  "Where am I spending the most?",
];

function buildDemoReply(prompt: string) {
  const normalized = prompt.toLowerCase();
  if (normalized.includes("payroll")) {
    return "In this demo scenario, payroll is at risk by about EUR 2,200. Prioritize collecting INV-047 to close the gap quickly.";
  }
  if (normalized.includes("invoice") || normalized.includes("overdue")) {
    return "Two invoices are overdue in demo data: INV-047 (EUR 2,400) and INV-051 (EUR 1,800). Start with INV-047 for highest impact.";
  }
  if (normalized.includes("cashflow")) {
    return "Cashflow dips below payroll threshold near Friday, then recovers after expected collections. Use the forecast chart for day-level detail.";
  }
  if (normalized.includes("spend") || normalized.includes("expense")) {
    return "Top cost pressure in demo data is payroll, then rent and weekly supplier outflows. Thursday shows the tightest operating buffer.";
  }
  return "Demo mode is active for this chat. Ask about payroll, overdue invoices, incidents, or call outcomes to explore the scenario.";
}

function AiAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-8 w-8" : "h-10 w-10";
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-black/20 bg-white ${sizeClass}`}>
      <img src="/float-logo.png" alt="Float AI" className="h-full w-full object-contain" />
    </div>
  );
}

async function streamChat({
  messages,
  accountId,
  onDelta,
  onDone,
  signal,
}: {
  messages: Msg[];
  accountId?: string;
  onDelta: (t: string) => void;
  onDone: () => void;
  signal?: AbortSignal;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    signal,
    body: JSON.stringify({ messages, account_id: accountId }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${resp.status}`);
  }
  if (!resp.body) throw new Error("No stream body");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let done = false;

  while (!done) {
    const { done: readerDone, value } = await reader.read();
    if (readerDone) break;
    buf += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buf.indexOf("\n")) !== -1) {
      let line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") {
        done = true;
        break;
      }
      try {
        const parsed = JSON.parse(json);
        const c = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (c) onDelta(c);
      } catch {
        buf = line + "\n" + buf;
        break;
      }
    }
  }
  onDone();
}

export default function ChatPage() {
  const { account, loading: accountLoading } = useAccount();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [usingDemoHistory, setUsingDemoHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadDemoHistory = useCallback(() => {
    const demoMessages = getDemoChatMessages(account?.id ?? "demo-account");
    setMessages(demoMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
    setUsingDemoHistory(true);
    setLoadingHistory(false);
  }, [account?.id]);

  useEffect(() => {
    if (accountLoading) {
      setLoadingHistory(true);
      return;
    }

    if (!account) {
      loadDemoHistory();
      return;
    }

    let mounted = true;
    const fallbackTimer = window.setTimeout(() => {
      if (!mounted) return;
      loadDemoHistory();
    }, 4000);

    supabase
      .from("chat_messages")
      .select("role, content")
      .eq("account_id", account.id)
      .order("created_at")
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          loadDemoHistory();
          return;
        }

        if (data && data.length > 0) {
          setMessages(data.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
          setUsingDemoHistory(false);
          return;
        }

        loadDemoHistory();
      })
      .finally(() => {
        if (mounted) {
          window.clearTimeout(fallbackTimer);
          setLoadingHistory(false);
        }
      });

    return () => {
      mounted = false;
      window.clearTimeout(fallbackTimer);
    };
  }, [account, accountLoading, loadDemoHistory]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const userMsg: Msg = { role: "user", content: text };
    setMessages((p) => [...p, userMsg]);

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((p) => {
        const last = p[p.length - 1];
        if (last?.role === "assistant") {
          return p.map((m, i) => (i === p.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...p, { role: "assistant", content: assistantSoFar }];
      });
    };

    if (!account) {
      const fallback = buildDemoReply(text);
      setMessages((p) => [...p, { role: "assistant", content: fallback }]);
      return;
    }

    setLoading(true);
    supabase.from("chat_messages").insert({
      account_id: account.id,
      role: "user",
      content: text,
    });
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 20000);

    try {
      await streamChat({
        messages: [...messages, userMsg],
        accountId: account.id,
        onDelta: upsert,
        signal: controller.signal,
        onDone: () => {
          setLoading(false);
          if (assistantSoFar) {
            supabase.from("chat_messages").insert({
              account_id: account.id,
              role: "assistant",
              content: assistantSoFar,
            });
          }
        },
      });
    } catch (e: unknown) {
      setLoading(false);
      if (e instanceof DOMException && e.name === "AbortError") {
        toast({
          variant: "destructive",
          title: "AI timeout",
          description: "Claude is taking too long. Please try again.",
        });
        return;
      }
      if (usingDemoHistory) {
        const fallback = buildDemoReply(text);
        setMessages((p) => [...p, { role: "assistant", content: fallback }]);
      } else {
        const message = e instanceof Error ? e.message : "Failed to get AI response";
        toast({
          variant: "destructive",
          title: "AI Error",
          description: message,
        });
      }
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, [input, loading, account, messages, toast, usingDemoHistory]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-gradient-to-b from-background via-background to-card/40">
      <div className="border-b border-border/80 bg-card/70 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Float AI Assistant</p>
            <h1 className="text-lg font-semibold text-foreground">AI Chat</h1>
            <p className="text-sm text-muted-foreground">Ask Float about cashflow, invoices, payroll, and risks.</p>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-black/20 bg-white/80 px-2.5 py-1.5 text-xs text-black/70 sm:flex">
            <AiAvatar size="sm" />
            <span>AI Online</span>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
          {loadingHistory ? (
            <div className="flex items-center justify-center rounded-2xl border border-black/10 bg-card/70 py-14 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading history...
            </div>
          ) : messages.length === 0 ? (
            <div className="rounded-2xl border border-black/20 bg-card p-7 text-center shadow-sm sm:p-9">
              <div className="mb-4 flex justify-center">
                <AiAvatar size="lg" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Welcome to Float AI</h2>
              <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
                Your AI CFO for cashflow, payroll planning, and collections strategy. Start with a prompt below or ask anything.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setInput(q);
                    }}
                    className="rounded-full border border-black/25 bg-white px-4 py-2 text-sm text-foreground transition-colors hover:bg-black hover:text-white"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex items-end gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
                  {m.role === "assistant" && <AiAvatar size="sm" />}
                  <div
                    className={`max-w-[86%] rounded-2xl border px-4 py-3 text-sm leading-relaxed sm:max-w-[78%] ${
                      m.role === "user"
                        ? "border-black bg-black text-white"
                        : "border-black/20 bg-card text-foreground shadow-sm"
                    }`}
                  >
                    {m.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none prose-headings:my-2 prose-p:my-2 prose-ul:my-2 prose-li:my-1 dark:prose-invert">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    )}
                  </div>
                  {m.role === "user" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-black/35 bg-white">
                      <User className="h-4 w-4 text-black/70" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {loading && messages[messages.length - 1]?.role === "user" && (
            <div className="mt-4 flex gap-3">
              <AiAvatar size="sm" />
              <div className="flex items-center gap-2 rounded-2xl border border-black/20 bg-card px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Float is thinking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-border/80 bg-card/70 px-4 py-4 sm:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="mx-auto flex w-full max-w-4xl gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your cashflow, invoices, payroll..."
            disabled={loading}
            className="h-11 flex-1 rounded-xl border-black/25 bg-white"
          />
          <Button
            type="submit"
            disabled={loading || !input.trim()}
            size="icon"
            className="h-11 w-11 rounded-xl border border-black bg-black text-white hover:bg-black/90"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <div className="mx-auto mt-2 flex w-full max-w-4xl items-center justify-between text-xs text-muted-foreground">
          <span>{usingDemoHistory ? "Grounded in demo scenario data" : "Grounded in your account data"}</span>
          <span>Press Enter to send</span>
        </div>
      </div>
    </div>
  );
}

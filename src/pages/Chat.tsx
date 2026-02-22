import { useState, useRef, useEffect, useCallback } from "react";
import { Send, User, Loader2, PhoneOutgoing, CheckCircle2, XCircle, Clock3, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccount } from "@/hooks/useAccount";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { useToast } from "@/hooks/use-toast";
import { getDemoChatMessages, getDemoInvoices } from "@/lib/demo-content";
import { formatCurrency } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

type Msg = { role: "user" | "assistant"; content: string };
type Invoice = Tables<"invoices">;
type CallProgressStatus = "queued" | "dialing" | "started" | "failed";
type CallProgress = {
  invoiceId: string;
  clientName: string;
  clientPhone: string;
  invoiceNumber: string;
  amount: number;
  status: CallProgressStatus;
  error?: string;
};
type CallRunState = {
  active: boolean;
  jobs: CallProgress[];
  started: number;
  failed: number;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const CALLABLE_STATUSES = ["overdue", "chasing", "unpaid"] as const;
const MAX_CHAT_CALLS = 5;
const DEMO_CALL_PHONE = "+353894008256";
const DEMO_CALL_NAME = "Float Demo Business";
const QUICK_PROMPTS = [
  "What did Float learn from past incidents?",
  "What's my cashflow outlook?",
  "Which invoices are overdue?",
  "Call our debtors and get our money",
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

function isCollectionCallIntent(prompt: string) {
  const normalized = prompt.toLowerCase();
  const hasCallVerb = /(call|phone|ring|dial)/.test(normalized);
  const hasCollectionsContext =
    /(debtor|debtors|creditor|creditors|invoice|overdue|collect|collection|chase|get our money|get money)/.test(normalized);
  return hasCallVerb && hasCollectionsContext;
}

function callStatusLabel(status: CallProgressStatus) {
  if (status === "queued") return "Queued";
  if (status === "dialing") return "Dialing";
  if (status === "started") return "In Progress";
  return "Failed";
}

function AiAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "h-16 w-16" : size === "sm" ? "h-8 w-8" : "h-10 w-10";
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-card ${sizeClass}`}>
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
  const [callingFromChat, setCallingFromChat] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [usingDemoHistory, setUsingDemoHistory] = useState(false);
  const [callRun, setCallRun] = useState<CallRunState | null>(null);
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
  }, [messages, callRun]);

  const persistChatMessage = useCallback(
    (role: "user" | "assistant", content: string) => {
      if (!account) return;
      supabase.from("chat_messages").insert({
        account_id: account.id,
        role,
        content,
      });
    },
    [account],
  );

  const getCallableInvoices = useCallback(async (): Promise<Invoice[]> => {
    if (account) {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("account_id", account.id)
        .in("status", [...CALLABLE_STATUSES])
        .not("client_phone", "is", null)
        .order("due_date", { ascending: true });

      if (!error && data && data.length > 0) {
        return data;
      }
    }

    return getDemoInvoices(account?.id ?? "demo-account")
      .filter((item) => CALLABLE_STATUSES.includes((item.status ?? "unpaid") as typeof CALLABLE_STATUSES[number]))
      .map((item) => ({
        ...item,
        client_name: DEMO_CALL_NAME,
        client_phone: DEMO_CALL_PHONE,
      }));
  }, [account]);

  const updateCallJob = useCallback((invoiceId: string, patch: Partial<CallProgress>) => {
    setCallRun((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        jobs: prev.jobs.map((job) => (job.invoiceId === invoiceId ? { ...job, ...patch } : job)),
      };
    });
  }, []);

  const triggerCollectionCalls = useCallback(
    async () => {
      setCallingFromChat(true);
      const intro =
        "Understood. I am launching collection calls now and will show live progress below as each debtor is dialed.";
      setMessages((prev) => [...prev, { role: "assistant", content: intro }]);
      persistChatMessage("assistant", intro);

      try {
        const candidates = await getCallableInvoices();
        const selected = candidates.slice(0, MAX_CHAT_CALLS);

        if (selected.length === 0) {
          const noTargets =
            "I could not find any debtors with callable phone numbers. Add client phone numbers in Dashboard, then ask me to call again.";
          setMessages((prev) => [...prev, { role: "assistant", content: noTargets }]);
          persistChatMessage("assistant", noTargets);
          setCallRun(null);
          return;
        }

        const jobs: CallProgress[] = selected.map((invoice) => ({
          invoiceId: invoice.id,
          clientName: invoice.client_name,
          clientPhone: invoice.client_phone ?? "Unknown",
          invoiceNumber: invoice.invoice_number ?? "Unknown",
          amount: invoice.amount,
          status: "queued",
        }));

        setCallRun({ active: true, jobs, started: 0, failed: 0 });
        let started = 0;
        let failed = 0;

        for (const invoice of selected) {
          updateCallJob(invoice.id, { status: "dialing", error: undefined });

          let callId: string | undefined;
          const isDemoInvoice = invoice.id.startsWith("demo-");

          if (account && !isDemoInvoice) {
            const { data: callRecord, error: insertError } = await supabase
              .from("calls")
              .insert({
                account_id: account.id,
                invoice_id: invoice.id,
                client_name: invoice.client_name,
                client_phone: invoice.client_phone ?? "Unknown",
                status: "initiated",
              })
              .select()
              .single();

            if (!insertError) {
              callId = callRecord?.id;
            }
          }

          const dueDate = invoice.due_date
            ? new Date(invoice.due_date).toLocaleDateString("en-IE", { month: "long", day: "numeric", year: "numeric" })
            : undefined;

          const { data, error } = await supabase.functions.invoke("make-call", {
            body: {
              to: invoice.client_phone,
              clientName: invoice.client_name,
              clientEmail: invoice.client_email,
              invoiceNumber: invoice.invoice_number,
              invoiceId: isDemoInvoice ? undefined : invoice.id,
              amount: invoice.amount,
              dueDate,
              callId,
            },
          });

          if (error || !data?.success) {
            failed += 1;
            updateCallJob(invoice.id, {
              status: "failed",
              error: error?.message || data?.error || "Call failed",
            });
            setCallRun((prev) => (prev ? { ...prev, failed } : prev));
            if (callId) {
              await supabase
                .from("calls")
                .update({ status: "failed", completed_at: new Date().toISOString(), outcome: error?.message || "Call failed" })
                .eq("id", callId);
            }
            continue;
          }

          started += 1;
          updateCallJob(invoice.id, { status: "started" });
          setCallRun((prev) => (prev ? { ...prev, started } : prev));
          if (callId) {
            await supabase.from("calls").update({ status: "in-progress" }).eq("id", callId);
          }
        }

        setCallRun((prev) => (prev ? { ...prev, active: false, started, failed } : prev));

        const limited = candidates.length > MAX_CHAT_CALLS;
        const summary = `Call run complete. Started ${started} call${started === 1 ? "" : "s"} and failed ${failed}.${
          limited ? ` I limited this run to the first ${MAX_CHAT_CALLS} debtors.` : ""
        }`;
        setMessages((prev) => [...prev, { role: "assistant", content: summary }]);
        persistChatMessage("assistant", summary);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to start collection calls";
        setMessages((prev) => [...prev, { role: "assistant", content: `I hit an error while placing calls: ${message}` }]);
      } finally {
        setCallingFromChat(false);
      }
    },
    [account, getCallableInvoices, persistChatMessage, updateCallJob],
  );

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || callingFromChat) return;
    setInput("");

    const userMsg: Msg = { role: "user", content: text };
    setMessages((p) => [...p, userMsg]);
    persistChatMessage("user", text);

    if (isCollectionCallIntent(text)) {
      await triggerCollectionCalls();
      return;
    }

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
            persistChatMessage("assistant", assistantSoFar);
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
  }, [input, loading, callingFromChat, persistChatMessage, triggerCollectionCalls, account, messages, toast, usingDemoHistory]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-gradient-to-b from-background via-background to-card/40">
      <div className="border-b border-border/80 bg-card/70 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Float AI Assistant</p>
            <h1 className="text-lg font-semibold text-foreground">AI Chat</h1>
            <p className="text-sm text-muted-foreground">Ask Float about cashflow, invoices, payroll, and risks.</p>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-border bg-background/80 px-2.5 py-1.5 text-xs text-muted-foreground sm:flex">
            <AiAvatar size="sm" />
            <span>AI Online</span>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
          {loadingHistory ? (
            <div className="flex items-center justify-center rounded-2xl border border-border/70 bg-card/70 py-14 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading history...
            </div>
          ) : messages.length === 0 ? (
            <div className="rounded-2xl border border-border/70 bg-card p-7 text-center shadow-sm sm:p-9">
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
                    className="rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
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
                        ? "border-primary/30 bg-primary text-primary-foreground"
                        : "border-border/70 bg-card text-foreground shadow-sm"
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
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-background">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {callRun && (
            <div className="mt-4 flex gap-3">
              <AiAvatar size="sm" />
              <div className="w-full max-w-[86%] rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm shadow-sm sm:max-w-[78%]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <PhoneOutgoing className="h-4 w-4" />
                    <span>{callRun.active ? "Agent is placing calls..." : "Call run finished"}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {callRun.started} started, {callRun.failed} failed
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {callRun.jobs.map((job) => (
                    <div key={job.invoiceId} className="rounded-xl border border-border/70 bg-background/80 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-foreground">
                            {job.clientName} • {job.invoiceNumber}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {job.clientPhone} • {formatCurrency(job.amount, account?.currency)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                          {job.status === "queued" && <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />}
                          {job.status === "dialing" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                          {job.status === "started" && <CheckCircle2 className="h-3.5 w-3.5 text-float-green" />}
                          {job.status === "failed" && <XCircle className="h-3.5 w-3.5 text-float-red" />}
                          <span>{callStatusLabel(job.status)}</span>
                        </div>
                      </div>
                      {job.error && <p className="mt-1 text-[11px] text-float-red">{job.error}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {loading && messages[messages.length - 1]?.role === "user" && (
            <div className="mt-4 flex gap-3">
              <AiAvatar size="sm" />
              <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Float is thinking...
              </div>
            </div>
          )}
          {callingFromChat && (
            <div className="mt-4 flex gap-3">
              <AiAvatar size="sm" />
              <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground">
                <PhoneCall className="h-3.5 w-3.5" /> Calling debtors now...
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
            disabled={loading || callingFromChat}
            className="h-11 flex-1 rounded-xl border-input bg-background"
          />
          <Button
            type="submit"
            disabled={loading || callingFromChat || !input.trim()}
            size="icon"
            className="h-11 w-11 rounded-xl"
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

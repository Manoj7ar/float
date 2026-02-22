import { useState, useCallback, useRef, useEffect } from "react";
import { Search, Send, X, Bot, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/hooks/useAccount";
import ReactMarkdown from "react-markdown";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

export function NlQueryBar() {
  const { account } = useAccount();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const ask = useCallback(async () => {
    const text = query.trim();
    if (!text || loading || !account) return;
    setLoading(true);
    setAnswer("");

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: text }],
          account_id: account.id,
        }),
      });

      if (!resp.ok || !resp.body) throw new Error("Failed");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let result = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) {
              result += c;
              setAnswer(result);
            }
          } catch {
            buf = `${line}\n${buf}`;
            break;
          }
        }
      }
    } catch {
      setAnswer("Sorry, I could not process that question. Try the full AI Chat instead.");
    } finally {
      setLoading(false);
    }
  }, [query, loading, account]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mx-auto hidden h-9 w-72 items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3.5 text-xs text-muted-foreground shadow-sm transition-all hover:border-primary/30 hover:bg-background/90 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:flex"
      >
        <Search size={13} className="shrink-0" />
        <span className="truncate">Ask Float anything...</span>
        <span className="ml-auto rounded-full border border-border/70 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em]">
          AI
        </span>
      </button>
    );
  }

  return (
    <div className="relative mx-auto hidden w-full max-w-xl sm:block">
      <div className="overflow-hidden rounded-2xl border border-primary/25 bg-card/95 shadow-lg shadow-black/5 backdrop-blur">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
          className="flex items-center gap-2 px-3 py-2"
        >
          <Search size={14} className="shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about cashflow, invoices, or spending..."
            className="h-8 border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
          />
          <Button
            type="submit"
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            disabled={loading || !query.trim()}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            onClick={() => {
              setOpen(false);
              setAnswer("");
              setQuery("");
            }}
          >
            <X size={14} />
          </Button>
        </form>

        {(answer || loading) && (
          <div className="max-h-60 overflow-y-auto border-t border-border/70 bg-background/55 px-4 py-3">
            {loading && !answer && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Bot size={14} className="text-primary" />
                <Loader2 size={12} className="animate-spin" />
                <span>Thinking...</span>
              </div>
            )}

            {answer && (
              <div className="flex gap-2">
                <Bot size={14} className="mt-1 shrink-0 text-primary" />
                <div className="prose prose-sm max-w-none text-sm prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 dark:prose-invert">
                  <ReactMarkdown>{answer}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

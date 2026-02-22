import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Phone, Mail, Clock, Loader2, ArrowUpRight } from "lucide-react";
import { useAccount } from "@/hooks/useAccount";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

type Invoice = Tables<"invoices">;

interface ChaseRanking {
  invoice_id: string;
  score: number;
  priority: "high" | "medium" | "low";
  reason: string;
  best_channel: "call" | "email";
  best_time: string;
}

const CHASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-chase`;

interface SmartChasePanelProps {
  invoices: Invoice[];
  onChase: (invoice: Invoice) => void;
}

export function SmartChasePanel({ invoices, onChase }: SmartChasePanelProps) {
  const { account } = useAccount();
  const { toast } = useToast();
  const [rankings, setRankings] = useState<ChaseRanking[]>([]);
  const [loading, setLoading] = useState(false);

  const analyze = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const resp = await fetch(CHASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ account_id: account.id }),
      });
      if (!resp.ok) throw new Error("Failed");
      const data = await resp.json();
      setRankings(data.rankings || []);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setLoading(false);
    }
  }, [account, toast]);

  const priorityColor = (p: string) => {
    if (p === "high") return "text-float-red bg-float-red/10";
    if (p === "medium") return "text-float-amber bg-float-amber/10";
    return "text-float-green bg-float-green/10";
  };

  const unpaidInvoices = invoices.filter((i) => ["unpaid", "overdue", "chasing"].includes(i.status || ""));

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
          <Brain size={13} className="text-primary" />
        </div>
        <CardTitle className="text-sm font-semibold">Smart Chase</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-6 text-[10px] font-semibold text-primary"
          onClick={analyze}
          disabled={loading || unpaidInvoices.length === 0}
        >
          {loading ? <Loader2 size={12} className="mr-1 animate-spin" /> : <Brain size={12} className="mr-1" />}
          {rankings.length > 0 ? "Re-analyze" : "Analyze"}
        </Button>
      </CardHeader>
      <CardContent className="flex-1 space-y-2">
        {rankings.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Brain className="mb-2 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {unpaidInvoices.length === 0 ? "No unpaid invoices" : "AI-powered chase prioritization"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {unpaidInvoices.length > 0 ? "Click Analyze to rank invoices by likelihood to pay" : "All invoices are paid!"}
            </p>
          </div>
        )}
        {loading && rankings.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Loader2 className="mb-2 h-8 w-8 animate-spin text-primary/50" />
            <p className="text-sm text-muted-foreground">Analyzing payment patterns…</p>
          </div>
        )}
        {rankings.map((r, i) => {
          const inv = invoices.find((x) => x.id === r.invoice_id);
          if (!inv) return null;
          return (
            <div key={r.invoice_id} className="group rounded-lg border border-border bg-accent/20 p-3 transition-all hover:bg-accent/40">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground">#{i + 1}</span>
                    <span className="text-xs font-semibold text-foreground truncate">{inv.client_name}</span>
                    <Badge variant="secondary" className={`text-[9px] ${priorityColor(r.priority)}`}>
                      {r.priority}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{r.reason}</p>
                  <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      {r.best_channel === "call" ? <Phone size={9} /> : <Mail size={9} />}
                      {r.best_channel}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Clock size={9} /> {r.best_time}
                    </span>
                    <span className="font-mono font-semibold text-foreground">{formatCurrency(inv.amount)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="text-right">
                    <p className="font-mono text-sm font-bold tabular-nums text-primary">{r.score}%</p>
                    <p className="text-[9px] text-muted-foreground">pay score</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[10px] opacity-0 group-hover:opacity-100"
                    onClick={() => onChase(inv)}
                  >
                    <ArrowUpRight size={11} className="mr-0.5" /> Chase
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

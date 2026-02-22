import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ArrowUp, ArrowDown, Minus, TrendingUp, ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import { useAccount } from "@/hooks/useAccount";
import { useToast } from "@/hooks/use-toast";

interface Highlight {
  label: string;
  value: string;
  trend: "up" | "down" | "neutral";
  good: boolean;
}

interface Digest {
  summary: string;
  highlights: Highlight[];
  recommendations: string[];
  risk_score: number;
  risk_label: string;
}

const DIGEST_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/weekly-digest`;

export function WeeklyDigestCard() {
  const { account } = useAccount();
  const { toast } = useToast();
  const [digest, setDigest] = useState<Digest | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const resp = await fetch(DIGEST_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ account_id: account.id }),
      });
      if (!resp.ok) throw new Error("Failed to generate digest");
      const data = await resp.json();
      setDigest(data);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Digest Error", description: e.message });
    } finally {
      setLoading(false);
    }
  }, [account, toast]);

  const riskColor = (label: string) => {
    if (label === "Healthy") return "text-float-green bg-float-green/10";
    if (label === "Caution") return "text-float-amber bg-float-amber/10";
    return "text-float-red bg-float-red/10";
  };

  const TrendIcon = ({ trend, good }: { trend: string; good: boolean }) => {
    const color = good ? "text-float-green" : "text-float-red";
    if (trend === "up") return <ArrowUp size={12} className={color} />;
    if (trend === "down") return <ArrowDown size={12} className={color} />;
    return <Minus size={12} className="text-muted-foreground" />;
  };

  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
          <TrendingUp size={13} className="text-primary" />
        </div>
        <CardTitle className="text-sm font-semibold">Weekly Digest</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-6 text-[10px] font-semibold text-primary"
          onClick={generate}
          disabled={loading}
        >
          {loading ? <Loader2 size={12} className="mr-1 animate-spin" /> : <Sparkles size={12} className="mr-1" />}
          {digest ? "Refresh" : "Generate"}
        </Button>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        {!digest && !loading && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <TrendingUp className="mb-2 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No digest yet</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Click Generate for an AI weekly summary</p>
          </div>
        )}
        {loading && !digest && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Loader2 className="mb-2 h-8 w-8 animate-spin text-primary/50" />
            <p className="text-sm text-muted-foreground">Analyzing your week…</p>
          </div>
        )}
        {digest && (
          <>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={riskColor(digest.risk_label)}>
                <ShieldCheck size={10} className="mr-1" />
                {digest.risk_label} ({digest.risk_score}/10)
              </Badge>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{digest.summary}</p>

            <div className="grid grid-cols-2 gap-2">
              {digest.highlights?.map((h, i) => (
                <div key={i} className="rounded-lg border border-border bg-accent/30 p-2.5">
                  <div className="flex items-center gap-1">
                    <TrendIcon trend={h.trend} good={h.good} />
                    <span className="text-[10px] text-muted-foreground">{h.label}</span>
                  </div>
                  <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">{h.value}</p>
                </div>
              ))}
            </div>

            {digest.recommendations?.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Recommendations</p>
                {digest.recommendations.map((r, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-md bg-primary/[0.03] p-2">
                    <AlertTriangle size={11} className="mt-0.5 shrink-0 text-primary" />
                    <p className="text-[11px] leading-relaxed text-foreground">{r}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

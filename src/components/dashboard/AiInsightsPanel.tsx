import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, X, AlertTriangle, Info, TrendingUp, ShieldAlert } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Insight = Tables<"ai_insights">;

interface AiInsightsPanelProps {
  insights: Insight[];
  onDismiss: (id: string) => void;
  onAction: (type: string) => void;
}

const typeConfig: Record<string, { border: string; icon: React.ReactNode; bg: string }> = {
  critical: {
    border: "border-l-float-red",
    icon: <ShieldAlert size={14} className="text-float-red" />,
    bg: "bg-float-red/[0.03]",
  },
  warning: {
    border: "border-l-float-amber",
    icon: <AlertTriangle size={14} className="text-float-amber" />,
    bg: "bg-float-amber/[0.03]",
  },
  info: {
    border: "border-l-primary",
    icon: <Info size={14} className="text-primary" />,
    bg: "bg-primary/[0.03]",
  },
  opportunity: {
    border: "border-l-float-green",
    icon: <TrendingUp size={14} className="text-float-green" />,
    bg: "bg-float-green/[0.03]",
  },
};

export function AiInsightsPanel({ insights, onDismiss, onAction }: AiInsightsPanelProps) {
  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
          <Sparkles size={13} className="text-primary" />
        </div>
        <CardTitle className="text-sm font-semibold">AI Insights</CardTitle>
        {insights.length > 0 && (
          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-bold text-primary">
            {insights.length}
          </span>
        )}
      </CardHeader>
      <CardContent className="flex-1 space-y-2">
        {insights.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Sparkles className="mb-2 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No active insights</p>
            <p className="mt-0.5 text-xs text-muted-foreground">AI-generated insights will appear here</p>
          </div>
        ) : (
          insights.map((insight) => {
            const config = typeConfig[insight.type] ?? typeConfig.info;
            return (
              <div
                key={insight.id}
                className={`group relative rounded-lg border border-border border-l-[3px] ${config.border} ${config.bg} p-3.5 transition-all`}
              >
                <button
                  onClick={() => onDismiss(insight.id)}
                  className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                >
                  <X size={12} />
                </button>
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 shrink-0">{config.icon}</div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-semibold text-foreground pr-5 leading-snug">{insight.title}</h4>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{insight.message}</p>
                    {insight.action_label && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1.5 h-6 px-2 text-[10px] font-semibold text-primary"
                        onClick={() => onAction(insight.action_type ?? "")}
                      >
                        {insight.action_label} →
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

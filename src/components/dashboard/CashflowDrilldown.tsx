import { formatCurrency } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { ArrowDownLeft, ArrowUpRight, X, Sparkles } from "lucide-react";

interface DrilldownData {
  date: string;
  projected: number;
  income: { label: string; amount: number }[];
  expenses: { label: string; amount: number }[];
}

interface CashflowDrilldownProps {
  data: DrilldownData;
  onClose: () => void;
}

export function CashflowDrilldown({ data, onClose }: CashflowDrilldownProps) {
  const totalIncome = data.income.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = data.expenses.reduce((s, i) => s + i.amount, 0);
  const net = totalIncome - totalExpenses;

  return (
    <Card className="animate-fade-in-up border-primary/20 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            <Sparkles size={10} /> Projected
          </span>
          <span className="text-sm font-semibold text-foreground">{data.date}</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Income */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-float-green/10">
              <ArrowDownLeft size={11} className="text-float-green" />
            </div>
            <span className="text-[10px] font-medium text-muted-foreground">Expected Income</span>
          </div>
          <div className="space-y-1">
            {data.income.map((item, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border border-border px-2.5 py-1.5">
                <span className="text-[11px] text-muted-foreground">{item.label}</span>
                <span className="font-mono text-xs font-semibold tabular-nums text-float-green">
                  +{formatCurrency(item.amount)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-border pt-1.5">
            <span className="text-[10px] font-medium text-muted-foreground">Total</span>
            <span className="font-mono text-xs font-bold tabular-nums text-float-green">
              +{formatCurrency(totalIncome)}
            </span>
          </div>
        </div>

        {/* Expenses */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-float-red/10">
              <ArrowUpRight size={11} className="text-float-red" />
            </div>
            <span className="text-[10px] font-medium text-muted-foreground">Expected Expenses</span>
          </div>
          <div className="space-y-1">
            {data.expenses.map((item, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border border-border px-2.5 py-1.5">
                <span className="text-[11px] text-muted-foreground">{item.label}</span>
                <span className="font-mono text-xs font-semibold tabular-nums text-float-red">
                  -{formatCurrency(item.amount)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-border pt-1.5">
            <span className="text-[10px] font-medium text-muted-foreground">Total</span>
            <span className="font-mono text-xs font-bold tabular-nums text-float-red">
              -{formatCurrency(totalExpenses)}
            </span>
          </div>
        </div>
      </div>

      {/* Net */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-accent/30 px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">Net Cash Flow</span>
        <span className={`font-mono text-sm font-bold tabular-nums ${net >= 0 ? "text-float-green" : "text-float-red"}`}>
          {net >= 0 ? "+" : ""}{formatCurrency(net)}
        </span>
      </div>
    </Card>
  );
}

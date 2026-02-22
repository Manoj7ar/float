import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

const benchmarks = [
  { metric: "Invoice Payment Time", you: "34 days", avg: "22 days", gap: "+12 days", status: "red" as const },
  { metric: "Recurring Cost Ratio", you: "67%", avg: "58%", gap: "+9%", status: "amber" as const },
  { metric: "Cash Reserve", you: "11 days", avg: "18 days", gap: "-7 days", status: "red" as const },
  { metric: "Revenue Consistency", you: "72/100", avg: "68/100", gap: "+4 pts", status: "green" as const },
  { metric: "Outstanding Invoice Ratio", you: "18%", avg: "12%", gap: "+6%", status: "amber" as const },
  { metric: "Payroll to Revenue", you: "29%", avg: "31%", gap: "-2%", status: "green" as const },
];

const statusStyle = {
  red: { bg: "bg-float-red/10", text: "text-float-red", icon: ArrowDown },
  amber: { bg: "bg-float-amber/10", text: "text-float-amber", icon: Minus },
  green: { bg: "bg-float-green/10", text: "text-float-green", icon: ArrowUp },
};

export function BenchmarkPanel() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold">Industry Benchmarks</CardTitle>
        <Badge variant="secondary" className="text-[10px] font-normal">Dublin Restaurants · 6–15 Employees</Badge>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {benchmarks.map((b) => {
            const s = statusStyle[b.status];
            const Icon = s.icon;
            return (
              <div key={b.metric} className="group/bench flex items-center justify-between rounded-lg border border-border p-3.5 transition-all duration-200 hover:border-border/80 hover:shadow-sm">
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">{b.metric}</p>
                  <p className="mt-1 font-mono text-sm font-bold tabular-nums text-foreground">{b.you}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.bg} ${s.text}`}>
                    <Icon size={10} /> {b.gap}
                  </span>
                  <span className="text-[9px] text-muted-foreground">avg {b.avg}</span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[10px] text-muted-foreground">Benchmarks from anonymised aggregate data across similar businesses.</p>
      </CardContent>
    </Card>
  );
}

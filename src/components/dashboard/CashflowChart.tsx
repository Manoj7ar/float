import { useState, useMemo, useEffect, useCallback, useRef, type ReactNode } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, ReferenceArea,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { format, subDays } from "date-fns";
import { Sparkles, TrendingDown, TrendingUp, Calendar, ArrowRight, GitBranch } from "lucide-react";
import { CashflowDrilldown } from "./CashflowDrilldown";
import type { Tables } from "@/integrations/supabase/types";

type Projection = Tables<"cashflow_projections">;

interface CashflowChartProps {
  projections: Projection[];
  payrollThreshold: number;
}

type Range = "14d" | "30d" | "60d";

export function CashflowChart({ projections, payrollThreshold }: CashflowChartProps) {
  const [range, setRange] = useState<Range>("30d");
  const [animate, setAnimate] = useState(false);
  const [drilldown, setDrilldown] = useState<{ date: string; projected: number } | null>(null);
  const [showScenarios, setShowScenarios] = useState(false);
  const hasAnimatedOnce = useRef(false);
  const today = new Date("2026-02-21");

  // Generate mock breakdown for a projected day
  const generateBreakdown = useCallback((dateLabel: string, projected: number) => {
    const incomeItems = [
      { label: "Client payments", amount: Math.round(projected * 0.35) },
      { label: "Recurring revenue", amount: Math.round(projected * 0.25) },
      { label: "Late payments", amount: Math.round(projected * 0.08) },
    ];
    const totalIncome = incomeItems.reduce((s, i) => s + i.amount, 0);
    const totalExpenses = totalIncome - (projected - (chartData.find(d => d.date === dateLabel)?.projected ?? projected));
    const expenseItems = [
      { label: "Payroll", amount: Math.round(totalExpenses * 0.45) },
      { label: "Suppliers", amount: Math.round(totalExpenses * 0.25) },
      { label: "Rent & utilities", amount: Math.round(totalExpenses * 0.18) },
      { label: "Other", amount: Math.round(totalExpenses * 0.12) },
    ];
    return { date: dateLabel, projected, income: incomeItems, expenses: expenseItems };
  }, []);

  // Trigger animation on mount / range change
  useEffect(() => {
    setAnimate(false);
    const delay = hasAnimatedOnce.current ? 90 : 220;
    const t = setTimeout(() => {
      setAnimate(true);
      hasAnimatedOnce.current = true;
    }, delay);
    return () => clearTimeout(t);
  }, [range]);

  const chartData = useMemo(() => {
    const histDays = range === "14d" ? 14 : range === "60d" ? 60 : 30;
    const data: { date: string; rawDate: Date; balance: number | null; projected: number | null; bestCase: number | null; worstCase: number | null; isToday?: boolean }[] = [];

    let bal = 980000;
    for (let i = Math.max(histDays, 60); i >= 1; i--) {
      const d = subDays(today, i);
      const dow = d.getDay();
      if (dow === 5 || dow === 6) bal += 120000;
      else bal -= 40000;
      if (d.getDate() === 1) bal -= 320000;
      if (i <= histDays) {
        data.push({ date: format(d, "MMM d"), rawDate: d, balance: bal, projected: null, bestCase: null, worstCase: null });
      }
    }

    data.push({ date: "Today", rawDate: today, balance: 620000, projected: 620000, bestCase: 620000, worstCase: 620000, isToday: true });

    projections.forEach((p, idx) => {
      const d = new Date(p.projection_date);
      if (d <= today) return;
      const factor = (idx + 1) * 0.03;
      data.push({
        date: format(d, "MMM d"),
        rawDate: d,
        balance: null,
        projected: p.projected_balance,
        bestCase: Math.round(p.projected_balance * (1 + factor + 0.05)),
        worstCase: Math.round(p.projected_balance * (1 - factor - 0.03)),
      });
    });

    return data;
  }, [projections, range]);

  const hasData = chartData.length > 1;

  const stats = useMemo(() => {
    const historicalValues = chartData.filter((d) => d.balance !== null).map((d) => d.balance!);
    const projectedValues = chartData.filter((d) => d.projected !== null).map((d) => d.projected!);
    const allValues = [...historicalValues, ...projectedValues];

    const currentBalance = 620000;
    const lowestProjected = projectedValues.length > 0 ? Math.min(...projectedValues) : currentBalance;
    const highestHistorical = historicalValues.length > 0 ? Math.max(...historicalValues) : currentBalance;
    const trend = projectedValues.length >= 2
      ? projectedValues[projectedValues.length - 1] - projectedValues[0]
      : 0;

    const daysBelow = projectedValues.filter((v) => v < payrollThreshold).length;

    return { currentBalance, lowestProjected, highestHistorical, trend, daysBelow, min: Math.min(...allValues), max: Math.max(...allValues) };
  }, [chartData, payrollThreshold]);

  const todayIndex = chartData.findIndex((d) => d.isToday);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const balVal = payload.find((p: any) => p.dataKey === "balance")?.value;
    const projVal = payload.find((p: any) => p.dataKey === "projected")?.value;
    const bestVal = payload.find((p: any) => p.dataKey === "bestCase")?.value;
    const worstVal = payload.find((p: any) => p.dataKey === "worstCase")?.value;
    const val = balVal ?? projVal;
    if (val == null) return null;
    const isProjected = balVal == null;

    return (
      <div className="rounded-2xl border border-border/70 bg-background/95 px-4 py-3 shadow-xl backdrop-blur-md">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <p className="mt-1 font-mono text-lg font-bold tabular-nums text-foreground">
          {formatCurrency(val)}
        </p>
        {isProjected && (
          <p className="mt-0.5 flex items-center gap-1 text-[9px] font-medium text-primary">
            <Sparkles size={8} /> AI projected
          </p>
        )}
        {showScenarios && bestVal != null && worstVal != null && (
          <div className="mt-2 space-y-0.5 border-t border-border/80 pt-1.5">
            <p className="flex items-center justify-between gap-3 text-[10px]">
              <span className="text-float-green font-medium">Best case</span>
              <span className="font-mono font-semibold tabular-nums text-float-green">{formatCurrency(bestVal)}</span>
            </p>
            <p className="flex items-center justify-between gap-3 text-[10px]">
              <span className="text-float-red font-medium">Worst case</span>
              <span className="font-mono font-semibold tabular-nums text-float-red">{formatCurrency(worstVal)}</span>
            </p>
          </div>
        )}
        {val < payrollThreshold && (
          <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-float-red">
            <TrendingDown size={10} /> Below payroll threshold
          </p>
        )}
      </div>
    );
  };

  const TodayDot = (props: any) => {
    const { cx, cy, index } = props;
    if (index !== todayIndex || !cx || !cy) return null;
    return (
      <g>
        <circle cx={cx} cy={cy} r={10} fill="hsl(var(--primary))" opacity={0.08}>
          <animate attributeName="r" values="8;12;8" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.1;0.04;0.1" dur="2.5s" repeatCount="indefinite" />
        </circle>
        <circle cx={cx} cy={cy} r={5} fill="hsl(var(--primary))" opacity={0.15} />
        <circle cx={cx} cy={cy} r={3.5} fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth={2.5} />
      </g>
    );
  };

  // Custom cursor
  const CustomCursor = ({ points, height }: any) => {
    if (!points?.[0]) return null;
    return (
      <line
        x1={points[0].x}
        y1={0}
        x2={points[0].x}
        y2={height}
        stroke="hsl(var(--foreground))"
        strokeWidth={1}
        strokeOpacity={0.16}
        strokeDasharray="5 4"
      />
    );
  };

  return (
    <Card className="overflow-hidden border-border/60 bg-gradient-to-b from-card via-card to-accent/20 shadow-sm">
      <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
            <TrendingUp size={14} className="text-primary" />
          </div>
          <CardTitle className="text-sm font-semibold tracking-tight">Cashflow Forecast</CardTitle>
          <span className="flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
            <Sparkles size={10} /> AI-powered
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-background/70 p-0.5">
            {(["14d", "30d", "60d"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition-all duration-200 ${
                  range === r
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r === "14d" ? "2W" : r === "30d" ? "1M" : "2M"}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowScenarios((s) => !s)}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[10px] font-medium transition-all duration-200 ${
              showScenarios
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border/70 bg-background/70 text-muted-foreground hover:text-foreground"
            }`}
          >
            <GitBranch size={10} />
            Scenarios
          </button>
        </div>
      </CardHeader>

      {/* Summary stats */}
      {hasData && (
        <div className="flex flex-wrap gap-2.5 px-6 pb-3">
          <StatPill
            color="primary"
            label="Balance"
            value={formatCurrency(stats.currentBalance)}
            dot
          />
          <StatPill
            color="float-red"
            label="Lowest"
            value={formatCurrency(stats.lowestProjected)}
            icon={<TrendingDown size={10} />}
          />
          <StatPill
            color="float-green"
            label="Peak"
            value={formatCurrency(stats.highestHistorical)}
            icon={<TrendingUp size={10} />}
          />
          {stats.daysBelow > 0 && (
            <StatPill
              color="float-amber"
              label={`${stats.daysBelow}d below payroll`}
              icon={<Calendar size={10} />}
              warning
            />
          )}
        </div>
      )}

      <CardContent className="pt-0">
        {!hasData ? (
          <div className="flex h-72 flex-col items-center justify-center gap-2 text-center">
            <Sparkles size={24} className="text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No projection data</p>
            <p className="text-xs text-muted-foreground">Load demo data or connect Monzo to see your forecast</p>
          </div>
        ) : (
          <div
            className={`relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-background via-background to-accent/20 p-2.5 transition-all duration-700 ease-out ${
              animate ? "translate-y-0 scale-100 opacity-100" : "translate-y-4 scale-[0.985] opacity-0"
            }`}
          >
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData} margin={{ top: 18, right: 18, left: -6, bottom: 6 }}>
                <defs>
                  <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.26} />
                    <stop offset="40%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="projectedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--float-amber))" stopOpacity={0.2} />
                    <stop offset="40%" stopColor="hsl(var(--float-amber))" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="hsl(var(--float-amber))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dangerGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--float-red))" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="hsl(var(--float-red))" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="bestCaseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--float-green))" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="hsl(var(--float-green))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="worstCaseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--float-red))" stopOpacity={0.14} />
                    <stop offset="100%" stopColor="hsl(var(--float-red))" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="hsl(var(--border))"
                  vertical={false}
                  opacity={0.3}
                />

                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  tickMargin={12}
                />
                <YAxis
                  tickFormatter={(v: number) => {
                    const units = v / 100;
                    const abs = Math.abs(units);
                    if (abs >= 1_000_000) return `${units < 0 ? "-" : ""}${(abs / 1_000_000).toFixed(1)}m`;
                    if (abs >= 1_000) return `${units < 0 ? "-" : ""}${(abs / 1_000).toFixed(1)}k`;
                    return `${units.toFixed(0)}`;
                  }}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickMargin={8}
                />
                <Tooltip content={<CustomTooltip />} cursor={<CustomCursor />} wrapperStyle={{ outline: "none" }} />

                {/* Danger zone below payroll threshold */}
                <ReferenceArea
                  y1={stats.min < 0 ? stats.min : 0}
                  y2={payrollThreshold}
                  fill="url(#dangerGrad)"
                />

                {/* Payroll threshold line */}
                <ReferenceLine
                  y={payrollThreshold}
                  stroke="hsl(var(--float-amber))"
                  strokeDasharray="6 4"
                  strokeOpacity={0.72}
                  strokeWidth={1.5}
                  label={{
                    value: `Payroll ${formatCurrency(payrollThreshold)}`,
                    position: "right",
                    fill: "hsl(var(--float-amber) / 0.9)",
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                />

                {/* "Today" vertical line */}
                <ReferenceLine
                  x="Today"
                  stroke="hsl(var(--primary))"
                  strokeDasharray="4 3"
                  strokeOpacity={0.42}
                  label={{
                    value: "Today",
                    position: "top",
                    fill: "hsl(var(--primary) / 0.95)",
                    fontSize: 9,
                    fontWeight: 700,
                  }}
                />

                {/* Historical balance */}
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="hsl(var(--primary))"
                  fill="url(#balanceGrad)"
                  strokeWidth={2.5}
                  isAnimationActive={animate}
                  animationDuration={1450}
                  animationEasing="ease-out"
                  animationBegin={90}
                  connectNulls={false}
                  dot={<TodayDot />}
                  activeDot={{
                    r: 5,
                    strokeWidth: 2.5,
                    fill: "hsl(var(--card))",
                    stroke: "hsl(var(--primary))",
                  }}
                />

                {/* Best case scenario */}
                {showScenarios && (
                  <Area
                    type="monotone"
                    dataKey="bestCase"
                    stroke="hsl(var(--float-green))"
                    fill="url(#bestCaseGrad)"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    strokeOpacity={0.6}
                    isAnimationActive={animate}
                    animationDuration={1250}
                    animationEasing="ease-out"
                    animationBegin={760}
                    connectNulls={false}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, fill: "hsl(var(--card))", stroke: "hsl(var(--float-green))" }}
                  />
                )}

                {/* Worst case scenario */}
                {showScenarios && (
                  <Area
                    type="monotone"
                    dataKey="worstCase"
                    stroke="hsl(var(--float-red))"
                    fill="url(#worstCaseGrad)"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    strokeOpacity={0.6}
                    isAnimationActive={animate}
                    animationDuration={1250}
                    animationEasing="ease-out"
                    animationBegin={760}
                    connectNulls={false}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, fill: "hsl(var(--card))", stroke: "hsl(var(--float-red))" }}
                  />
                )}

                {/* Projected balance — clickable */}
                <Area
                  type="monotone"
                  dataKey="projected"
                  stroke="hsl(var(--float-amber))"
                  fill="url(#projectedGrad)"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  isAnimationActive={animate}
                  animationDuration={1550}
                  animationEasing="ease-out"
                  animationBegin={360}
                  connectNulls={false}
                  dot={false}
                  activeDot={{
                    r: 6,
                    strokeWidth: 2.5,
                    fill: "hsl(var(--card))",
                    stroke: "hsl(var(--float-amber))",
                    cursor: "pointer",
                    onClick: (_: any, e: any) => {
                      if (e?.payload?.projected != null) {
                        setDrilldown({ date: e.payload.date, projected: e.payload.projected });
                      }
                    },
                  } as any}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Legend */}
        {hasData && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2">
            <LegendItem color="hsl(var(--primary))" label="Actual" />
            <LegendItem color="hsl(var(--float-amber))" label="Projected" dashed />
            {showScenarios && <LegendItem color="hsl(var(--float-green))" label="Best case" dashed />}
            {showScenarios && <LegendItem color="hsl(var(--float-red))" label="Worst case" dashed />}
            <LegendItem color="hsl(var(--float-amber) / 0.72)" label="Payroll threshold" dashed />
            <div className="flex items-center gap-2">
              <div className="h-3 w-4 rounded-sm border border-float-red/20 bg-float-red/[0.09]" />
              <span className="text-[10px] text-muted-foreground">Danger zone</span>
            </div>
          </div>
        )}

        {/* Scenario summary card */}
        {showScenarios && hasData && <ScenarioSummary chartData={chartData} payrollThreshold={payrollThreshold} />}

        {/* Drilldown panel */}
        {drilldown && (
          <div className="pt-3">
            <CashflowDrilldown
              data={generateBreakdown(drilldown.date, drilldown.projected)}
              onClose={() => setDrilldown(null)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Sub-components ──────────────────────────────────────── */

function StatPill({ color, label, value, icon, dot, warning }: {
  color: string;
  label: string;
  value?: string;
  icon?: React.ReactNode;
  dot?: boolean;
  warning?: boolean;
}) {
  const tone = {
    primary: {
      dot: "bg-primary",
      icon: "text-primary",
      value: "text-foreground",
      warningSurface: "border-primary/20 bg-primary/[0.07]",
    },
    "float-red": {
      dot: "bg-float-red",
      icon: "text-float-red",
      value: "text-float-red",
      warningSurface: "border-float-red/20 bg-float-red/[0.06]",
    },
    "float-green": {
      dot: "bg-float-green",
      icon: "text-float-green",
      value: "text-float-green",
      warningSurface: "border-float-green/20 bg-float-green/[0.06]",
    },
    "float-amber": {
      dot: "bg-float-amber",
      icon: "text-float-amber",
      value: "text-float-amber",
      warningSurface: "border-float-amber/20 bg-float-amber/[0.08]",
    },
  }[color] ?? {
    dot: "bg-primary",
    icon: "text-primary",
    value: "text-foreground",
    warningSurface: "border-border/70 bg-background/70",
  };

  return (
    <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 transition-all ${
      warning ? tone.warningSurface : "border-border/70 bg-background/70"
    }`}>
      {dot && <div className={`h-2 w-2 rounded-full ${tone.dot}`} />}
      {icon && <span className={tone.icon}>{icon}</span>}
      <span className="text-[10px] text-muted-foreground">{label}</span>
      {value && (
        <span className={`font-mono text-xs font-semibold tabular-nums ${tone.value}`}>
          {value}
        </span>
      )}
    </div>
  );
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-0.5 w-6 rounded-full"
        style={
          dashed
            ? { backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 6px, transparent 6px 10px)` }
            : { backgroundColor: color }
        }
      />
      <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

function ScenarioSummary({ chartData, payrollThreshold }: {
  chartData: { bestCase: number | null; worstCase: number | null; projected: number | null; date: string }[];
  payrollThreshold: number;
}) {
  const projected = chartData.filter((d) => d.projected != null);
  if (projected.length === 0) return null;

  const lastPoint = projected[projected.length - 1];
  const bestVals = projected.map((d) => d.bestCase!).filter(Boolean);
  const worstVals = projected.map((d) => d.worstCase!).filter(Boolean);

  const bestEnd = lastPoint.bestCase ?? 0;
  const worstEnd = lastPoint.worstCase ?? 0;
  const baseEnd = lastPoint.projected ?? 0;
  const range = bestEnd - worstEnd;
  const worstDaysBelow = worstVals.filter((v) => v < payrollThreshold).length;
  const bestPeak = bestVals.length > 0 ? Math.max(...bestVals) : 0;

  return (
    <div className="mt-4 rounded-2xl border border-border/60 bg-gradient-to-br from-accent/30 via-background/80 to-background p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-2 mb-3">
        <GitBranch size={14} className="text-primary" />
        <span className="text-xs font-semibold text-foreground">Scenario Analysis</span>
        <span className="text-[10px] text-muted-foreground ml-auto">{projected.length}-day outlook</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ScenarioMetric
          label="Best case end"
          value={formatCurrency(bestEnd)}
          sub={`+${formatCurrency(bestEnd - baseEnd)} vs base`}
          color="text-float-green"
        />
        <ScenarioMetric
          label="Worst case end"
          value={formatCurrency(worstEnd)}
          sub={`${formatCurrency(worstEnd - baseEnd)} vs base`}
          color="text-float-red"
        />
        <ScenarioMetric
          label="Outcome range"
          value={formatCurrency(range)}
          sub="Between best & worst"
          color="text-foreground"
        />
        <ScenarioMetric
          label="Worst payroll risk"
          value={worstDaysBelow > 0 ? `${worstDaysBelow} days` : "None"}
          sub={worstDaysBelow > 0 ? "Days below threshold" : "Always covered"}
          color={worstDaysBelow > 0 ? "text-float-red" : "text-float-green"}
        />
      </div>
      {/* Range bar */}
      <div className="mt-3 pt-3 border-t border-border">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
          <span>Worst</span>
          <span>Base</span>
          <span>Best</span>
        </div>
        <div className="relative h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="absolute inset-y-0 rounded-full"
            style={{
              left: "0%",
              right: `${Math.max(0, 100 - ((bestEnd - worstEnd) > 0 ? 100 : 0))}%`,
              background: "linear-gradient(90deg, hsl(var(--float-red)), hsl(var(--float-amber)), hsl(var(--float-green)))",
            }}
          />
          {/* Base marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-foreground"
            style={{ left: range > 0 ? `${((baseEnd - worstEnd) / range) * 100}%` : "50%" }}
          />
        </div>
      </div>
    </div>
  );
}

function ScenarioMetric({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`font-mono text-sm font-semibold tabular-nums ${color}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground">{sub}</p>
    </div>
  );
}

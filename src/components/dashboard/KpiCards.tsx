import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  FileText,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Account } from "@/hooks/useAccount";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Invoice = Tables<"invoices">;

interface KpiCardsProps {
  account: Account | null;
  invoices: Invoice[];
}

interface KpiCardItem {
  label: string;
  icon: LucideIcon;
  value: string;
  badge: string;
  badgeClassName: string;
  iconWrapClassName: string;
  detail: ReactNode;
}

function capAtZero(value: number) {
  return Math.max(0, value);
}

export function KpiCards({ account, invoices }: KpiCardsProps) {
  const balance = 620000;
  const payroll = account?.payroll_amount ?? 840000;
  const atRisk = account?.payroll_at_risk ?? false;
  const currency = account?.currency;

  const payrollGap = balance - payroll;
  const totalOutstanding = invoices
    .filter((invoice) => invoice.status !== "paid")
    .reduce((sum, invoice) => sum + invoice.amount, 0);
  const overdueInvoices = invoices.filter((invoice) => invoice.status === "overdue");
  const overdueCount = overdueInvoices.length;
  const overdueAmount = overdueInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const unpaidCount = invoices.filter((invoice) => invoice.status !== "paid").length;

  const payrollCoveragePercent = payroll > 0 ? Math.round((balance / payroll) * 100) : 0;
  const collectionCoveragePercent = payroll > 0 ? Math.round((totalOutstanding / payroll) * 100) : 0;
  const runwayDays = atRisk ? Math.max(8, Math.round((balance / Math.max(1, payroll)) * 18)) : 47;
  const runwayProgress = Math.min(100, Math.round((runwayDays / 60) * 100));
  const balanceTrend = atRisk ? "-2.1%" : "+1.9%";

  const cards: KpiCardItem[] = [
    {
      label: "Current Balance",
      icon: Wallet,
      value: formatCurrency(balance, currency),
      badge: account?.monzo_connected ? "Live" : "Demo",
      badgeClassName: "border-black/30 bg-black/5 text-black/70",
      iconWrapClassName: "border-black/20 bg-black/5 text-black/80",
      detail: (
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1 text-black/70">
            <TrendingDown size={12} className="text-black/55" />
            {balanceTrend} vs last week
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-black/20 px-2 py-0.5 text-[10px] text-black/65">
            {account?.monzo_connected ? "Bank synced" : "Scenario data"}
          </span>
        </div>
      ),
    },
    {
      label: "Payroll Coverage",
      icon: atRisk ? ShieldAlert : ShieldCheck,
      value: payrollGap < 0 ? `-${formatCurrency(Math.abs(payrollGap), currency)}` : `+${formatCurrency(payrollGap, currency)}`,
      badge: atRisk ? "At Risk" : "Covered",
      badgeClassName: atRisk
        ? "border-float-red/30 bg-float-red/10 text-float-red"
        : "border-float-green/30 bg-float-green/10 text-float-green",
      iconWrapClassName: atRisk
        ? "border-float-red/30 bg-float-red/10 text-float-red"
        : "border-float-green/30 bg-float-green/10 text-float-green",
      detail: (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-black/65">Funded</span>
            <span className="font-mono text-black/80">{capAtZero(payrollCoveragePercent)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10">
            <div
              className={cn("h-full rounded-full", atRisk ? "bg-float-red/80" : "bg-float-green/80")}
              style={{ width: `${capAtZero(Math.min(payrollCoveragePercent, 100))}%` }}
            />
          </div>
          <p className="text-[10px] text-black/60">Next payroll: {account?.payroll_day || "Friday"}</p>
        </div>
      ),
    },
    {
      label: "Outstanding Invoices",
      icon: FileText,
      value: formatCurrency(totalOutstanding, currency),
      badge: `${unpaidCount} open`,
      badgeClassName: "border-black/25 bg-black/5 text-black/70",
      iconWrapClassName: "border-black/20 bg-black/5 text-black/80",
      detail: (
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1 text-black/70">
            <ArrowUpRight size={12} className="text-black/55" />
            Can cover {capAtZero(collectionCoveragePercent)}% of payroll
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-float-red/30 bg-float-red/10 px-2 py-0.5 text-[10px] font-semibold text-float-red">
            {overdueCount} overdue
          </span>
          {overdueAmount > 0 && (
            <span className="hidden text-[10px] text-black/60 lg:inline">
              {formatCurrency(overdueAmount, currency)}
            </span>
          )}
        </div>
      ),
    },
    {
      label: "Runway",
      icon: Activity,
      value: `${runwayDays} days`,
      badge: atRisk ? "Compressed" : "Stable",
      badgeClassName: atRisk
        ? "border-float-amber/35 bg-float-amber/10 text-float-amber"
        : "border-float-green/30 bg-float-green/10 text-float-green",
      iconWrapClassName: "border-black/20 bg-black/5 text-black/80",
      detail: (
        <div className="space-y-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10">
            <div
              className={cn("h-full rounded-full", atRisk ? "bg-float-amber/80" : "bg-black/70")}
              style={{ width: `${runwayProgress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-black/60">Based on 30-day projection</span>
            <span className="inline-flex items-center gap-1 font-medium text-black/75">
              {atRisk ? <ArrowDownRight size={10} /> : <ArrowUpRight size={10} />}
              {runwayProgress}%
            </span>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, idx) => (
        <Card
          key={card.label}
          className="group relative overflow-hidden rounded-2xl border border-black/15 bg-gradient-to-b from-white via-white to-black/[0.03] shadow-[0_1px_0_rgba(0,0,0,0.15)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(0,0,0,0.08)]"
          style={{ animationDelay: `${80 + idx * 70}ms` }}
        >
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/60">
                  {card.label}
                </p>
                <p className="mt-2 font-mono text-[1.55rem] font-semibold leading-none tabular-nums text-black">
                  {card.value}
                </p>
              </div>

              <div className="space-y-2 text-right">
                <div className={cn("ml-auto flex h-9 w-9 items-center justify-center rounded-lg border", card.iconWrapClassName)}>
                  <card.icon size={16} />
                </div>
                <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold", card.badgeClassName)}>
                  {card.badge}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-black/10 bg-white/80 px-2.5 py-2">
              {card.detail}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

import { useEffect, useState } from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { Account } from "@/hooks/useAccount";

interface CrisisBannerProps {
  account: Account | null;
  onFixIt: () => void;
}

export function CrisisBanner({ account, onFixIt }: CrisisBannerProps) {
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if (!account?.payroll_at_risk) return;
    const payrollDate = new Date("2026-02-27T17:00:00Z");
    const timer = setInterval(() => {
      const now = new Date();
      const diff = payrollDate.getTime() - now.getTime();
      if (diff <= 0) { setCountdown("00:00:00"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(timer);
  }, [account?.payroll_at_risk]);

  if (!account) return null;

  const payroll = account.payroll_amount ?? 840000;
  const balance = 620000;
  const shortfall = payroll - balance;

  // Healthy
  if (account.risk_level === "healthy" || (!account.payroll_at_risk && account.risk_level !== "warning")) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-float-green/20 bg-float-green/5 px-5 py-3.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-float-green/15">
          <span className="text-xs">✓</span>
        </div>
        <div>
          <span className="text-sm font-medium text-float-green">Cashflow healthy</span>
          <span className="ml-2 text-xs text-muted-foreground">47 days runway · Payroll covered · No action needed</span>
        </div>
      </div>
    );
  }

  // Warning
  if (account.risk_level === "warning") {
    return (
      <div className="flex items-center justify-between rounded-xl border border-float-amber/20 bg-float-amber/5 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-float-amber/15">
            <AlertTriangle size={13} className="text-float-amber" />
          </div>
          <span className="text-sm font-medium text-float-amber">Cashflow pressure detected this week</span>
        </div>
        <Button variant="ghost" size="sm" className="text-xs text-float-amber hover:text-float-amber">
          View details →
        </Button>
      </div>
    );
  }

  // Critical
  return (
    <div className="overflow-hidden rounded-xl border border-float-red/20 bg-gradient-to-br from-float-red/5 via-float-red/[0.03] to-transparent">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-float-red/15">
              <AlertTriangle size={14} className="text-float-red" />
            </div>
            <span className="text-sm font-bold uppercase tracking-wide text-float-red">Payroll at Risk</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock size={12} />
            <span>Friday Feb 27</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-card/60 p-3 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Payroll Due</p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-foreground">{formatCurrency(payroll)}</p>
          </div>
          <div className="rounded-lg bg-card/60 p-3 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Balance</p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-foreground">{formatCurrency(balance)}</p>
          </div>
          <div className="rounded-lg bg-float-red/[0.06] p-3 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wider text-float-red">Shortfall</p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-float-red">−{formatCurrency(shortfall)}</p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Time remaining</p>
            <p className="mt-0.5 font-mono text-3xl font-bold tabular-nums tracking-widest text-foreground">{countdown}</p>
          </div>
          <Button
            onClick={onFixIt}
            size="lg"
            className="rounded-full bg-float-red-deep px-8 font-bold text-primary-foreground shadow-lg transition-all hover:bg-float-red hover:shadow-xl animate-pulse-red"
          >
            Fix It Now
          </Button>
        </div>
      </div>
    </div>
  );
}

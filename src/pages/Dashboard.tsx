import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/useAccount";
import { TopBar } from "@/components/TopBar";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { CashflowChart } from "@/components/dashboard/CashflowChart";
import { InvoiceTable } from "@/components/dashboard/InvoiceTable";
import { BenchmarkPanel } from "@/components/dashboard/BenchmarkPanel";
import { FixItModal } from "@/components/dashboard/FixItModal";
import { getDemoIncidents, getDemoInsights, getDemoInvoices, getDemoProjections } from "@/lib/demo-content";
import { formatCurrency } from "@/lib/format";
import { AlertTriangle, CalendarClock, DatabaseZap, Wallet } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Invoice = Tables<"invoices">;
type Insight = Tables<"ai_insights">;
type Projection = Tables<"cashflow_projections">;
type Incident = Tables<"incidents">;

export default function DashboardPage() {
  const { account } = useAccount();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [projections, setProjections] = useState<Projection[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [usingDemoData, setUsingDemoData] = useState(false);
  const [showFixIt, setShowFixIt] = useState(false);

  useEffect(() => {
    if (!account) return;
    const fetchAll = async () => {
      const demoInvoices = getDemoInvoices(account.id);
      const demoInsights = getDemoInsights(account.id);
      const demoProjections = getDemoProjections(account.id);
      const demoIncidents = getDemoIncidents(account.id);

      try {
        const [inv, ins, proj, inc] = await Promise.all([
          supabase.from("invoices").select("*").eq("account_id", account.id),
          supabase.from("ai_insights").select("*").eq("account_id", account.id).eq("dismissed", false),
          supabase.from("cashflow_projections").select("*").eq("account_id", account.id).order("projection_date"),
          supabase.from("incidents").select("*").eq("account_id", account.id),
        ]);

        const nextInvoices = (inv.data?.length ?? 0) > 0 ? inv.data! : demoInvoices;
        const nextInsights = (ins.data?.length ?? 0) > 0 ? ins.data! : demoInsights;
        const nextProjections = (proj.data?.length ?? 0) > 0 ? proj.data! : demoProjections;
        const nextIncidents = (inc.data?.length ?? 0) > 0 ? inc.data! : demoIncidents;

        setInvoices(nextInvoices);
        setInsights(nextInsights);
        setProjections(nextProjections);
        setIncidents(nextIncidents);
        setUsingDemoData(
          (inv.data?.length ?? 0) === 0 &&
          (ins.data?.length ?? 0) === 0 &&
          (proj.data?.length ?? 0) === 0 &&
          (inc.data?.length ?? 0) === 0,
        );
      } catch {
        setInvoices(demoInvoices);
        setInsights(demoInsights);
        setProjections(demoProjections);
        setIncidents(demoIncidents);
        setUsingDemoData(true);
      }
    };
    fetchAll();

    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices", filter: `account_id=eq.${account.id}` }, (payload) => {
        if (payload.eventType === "UPDATE") {
          setInvoices((prev) => prev.map((i) => (i.id === (payload.new as Invoice).id ? payload.new as Invoice : i)));
        } else if (payload.eventType === "INSERT") {
          setInvoices((prev) => [payload.new as Invoice, ...prev]);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_insights", filter: `account_id=eq.${account.id}` }, () => {
        supabase.from("ai_insights").select("*").eq("account_id", account.id).eq("dismissed", false).then(({ data }) => {
          if (data) setInsights(data);
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "incidents", filter: `account_id=eq.${account.id}` }, () => {
        supabase.from("incidents").select("*").eq("account_id", account.id).then(({ data }) => {
          if (data) setIncidents(data);
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [account]);

  const openIncident = incidents.find((i) => i.status === "open" && i.severity === "P1");
  const payrollThreshold = account?.payroll_amount ?? 840000;
  const currentBalance = 620000;
  const payrollGap = currentBalance - payrollThreshold;
  const unpaidInvoices = invoices.filter((invoice) => invoice.status !== "paid");
  const overdueInvoices = invoices.filter((invoice) => invoice.status === "overdue");
  const outstandingTotal = unpaidInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const isPayrollAtRisk = account?.payroll_at_risk ?? false;

  return (
    <>
      <TopBar
        title="Dashboard"
        subtitle={usingDemoData ? `${account?.business_name ?? "Business"} (demo data)` : account?.business_name ?? undefined}
      />

      <div className="relative px-4 pb-6 pt-4 lg:px-6 lg:pb-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 rounded-b-[2.5rem] bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.14),transparent_60%)]" />

        <div className="space-y-6">
          <section
            className="animate-fade-in-up overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-card via-card to-accent/30 p-4 shadow-sm sm:p-5"
            style={{ animationDelay: "70ms" }}
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                    <DatabaseZap size={11} className={usingDemoData ? "text-float-amber" : "text-float-green"} />
                    {usingDemoData ? "Demo data mode" : "Live data connected"}
                  </span>
                  {openIncident && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-float-red/25 bg-float-red/10 px-2.5 py-1 text-[10px] font-semibold text-float-red">
                      <AlertTriangle size={11} />
                      P1 incident open
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {isPayrollAtRisk
                      ? "Payroll risk detected. Prioritize overdue collections today."
                      : "Cashflow is stable. Keep collections momentum and monitor runway."}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {overdueInvoices.length > 0
                      ? `${overdueInvoices.length} overdue invoice${overdueInvoices.length === 1 ? "" : "s"} can be actioned from the table below.`
                      : "No overdue invoices right now. Forecast and benchmark panels are the key watch areas."}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
                  <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    <Wallet size={11} />
                    Balance
                  </div>
                  <p className="mt-2 font-mono text-lg font-semibold tabular-nums text-foreground">
                    {formatCurrency(currentBalance, account?.currency)}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">Working balance used for forecast</p>
                </div>

                <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
                  <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    <CalendarClock size={11} />
                    Payroll
                  </div>
                  <p className="mt-2 font-mono text-lg font-semibold tabular-nums text-foreground">
                    {formatCurrency(payrollThreshold, account?.currency)}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">Due {account?.payroll_day ?? "Friday"}</p>
                </div>

                <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Open invoices</p>
                  <p className="mt-2 font-mono text-lg font-semibold tabular-nums text-foreground">
                    {unpaidInvoices.length}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatCurrency(outstandingTotal, account?.currency)} outstanding
                  </p>
                </div>

                <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Payroll gap
                  </p>
                  <p className={`mt-2 font-mono text-lg font-semibold tabular-nums ${payrollGap < 0 ? "text-float-red" : "text-float-green"}`}>
                    {payrollGap < 0 ? "-" : "+"}
                    {formatCurrency(Math.abs(payrollGap), account?.currency)}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {payrollGap < 0 ? "Shortfall before payroll" : "Coverage over payroll"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="animate-fade-in-up space-y-3" style={{ animationDelay: "120ms" }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Financial Overview</h2>
                <p className="text-xs text-muted-foreground">Key health indicators and payroll readiness.</p>
              </div>
            </div>
            <KpiCards account={account} invoices={invoices} />
          </section>

          <section className="animate-fade-in-up space-y-3" style={{ animationDelay: "200ms" }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Forecast</h2>
                <p className="text-xs text-muted-foreground">Historical cash movement and AI projected balance path.</p>
              </div>
            </div>
            <CashflowChart projections={projections} payrollThreshold={payrollThreshold} />
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] xl:items-start">
            <section className="animate-fade-in-up space-y-3" style={{ animationDelay: "280ms" }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Collections Workspace</h2>
                  <p className="text-xs text-muted-foreground">
                    Prioritize overdue invoices, update contacts, and trigger recovery actions.
                  </p>
                </div>
              </div>
              <InvoiceTable
                invoices={invoices}
                onChase={() => setShowFixIt(true)}
                payrollAtRisk={isPayrollAtRisk}
              />
            </section>

            <section className="animate-fade-in-up space-y-3" style={{ animationDelay: "360ms" }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Peer Comparison</h2>
                  <p className="text-xs text-muted-foreground">
                    Where your operations sit against similar businesses.
                  </p>
                </div>
              </div>
              <BenchmarkPanel />
            </section>
          </div>
        </div>
      </div>

      {showFixIt && openIncident && (
        <FixItModal incident={openIncident} onClose={() => setShowFixIt(false)} />
      )}
    </>
  );
}

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

  return (
    <>
      <TopBar
        title="Dashboard"
        subtitle={usingDemoData ? `${account?.business_name ?? "Business"} (demo data)` : account?.business_name ?? undefined}
        insightCount={insights.length}
      />

      <div className="space-y-6 p-4 lg:p-6">

        {/* KPI Cards */}
        <section className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          <KpiCards account={account} invoices={invoices} />
        </section>

        {/* Cashflow Chart */}
        <section className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          <CashflowChart projections={projections} payrollThreshold={account?.payroll_amount ?? 840000} />
        </section>

        {/* Invoices */}
        <section className="animate-fade-in-up" style={{ animationDelay: "300ms" }}>
          <InvoiceTable
            invoices={invoices}
            onChase={() => setShowFixIt(true)}
            payrollAtRisk={account?.payroll_at_risk ?? false}
          />
        </section>

        {/* Benchmarks */}
        <section className="animate-fade-in-up" style={{ animationDelay: "400ms" }}>
          <BenchmarkPanel />
        </section>
      </div>

      {showFixIt && openIncident && (
        <FixItModal incident={openIncident} onClose={() => setShowFixIt(false)} />
      )}
    </>
  );
}

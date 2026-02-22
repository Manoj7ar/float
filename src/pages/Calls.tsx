import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Loader2,
  Phone,
  PhoneCall,
  PhoneOff,
  PhoneOutgoing,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { differenceInCalendarDays, format } from "date-fns";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAccount } from "@/hooks/useAccount";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { getDemoCalls, getDemoInvoices, isDemoId } from "@/lib/demo-content";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Call = Tables<"calls">;
type Invoice = Tables<"invoices">;

type HistoryFilter = "all" | "completed" | "failed" | "initiated" | "in-progress";

const statusConfig: Record<string, { icon: ReactNode; className: string; label: string }> = {
  completed: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    className: "bg-float-green/10 text-float-green border-float-green/20",
    label: "Completed",
  },
  failed: {
    icon: <XCircle className="h-4 w-4" />,
    className: "bg-float-red/10 text-float-red border-float-red/20",
    label: "Failed",
  },
  initiated: {
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    className: "bg-float-amber/10 text-float-amber border-float-amber/20",
    label: "Initiated",
  },
  "in-progress": {
    icon: <PhoneCall className="h-4 w-4" />,
    className: "bg-primary/10 text-primary border-primary/20",
    label: "In Progress",
  },
  unknown: {
    icon: <AlertCircle className="h-4 w-4" />,
    className: "bg-muted text-muted-foreground border-border",
    label: "Unknown",
  },
};

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDateTime(value: string | null, fallback = "Not recorded") {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return format(parsed, "MMM d, yyyy - h:mm a");
}

function getStatusMeta(status: string | null) {
  if (!status) return statusConfig.initiated;
  return statusConfig[status] ?? statusConfig.unknown;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

export default function CallsPage() {
  const { account } = useAccount();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [calls, setCalls] = useState<Call[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [callingInvoiceId, setCallingInvoiceId] = useState<string | null>(null);
  const [callingAll, setCallingAll] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [clearingHistory, setClearingHistory] = useState(false);
  const [deletingCallId, setDeletingCallId] = useState<string | null>(null);
  const [usingDemoData, setUsingDemoData] = useState(false);

  const loadData = useCallback(
    async (options?: { background?: boolean }) => {
      if (!account) return;

      if (options?.background) setRefreshing(true);
      else setLoading(true);

      try {
        const [callsRes, invRes] = await Promise.all([
          supabase
            .from("calls")
            .select("*")
            .eq("account_id", account.id)
            .order("initiated_at", { ascending: false }),
          supabase
            .from("invoices")
            .select("*")
            .eq("account_id", account.id)
            .in("status", ["overdue", "chasing", "unpaid"]),
        ]);

        if (callsRes.error) throw callsRes.error;
        if (invRes.error) throw invRes.error;

        const nextCalls = (callsRes.data?.length ?? 0) > 0 ? callsRes.data! : getDemoCalls(account.id);
        const nextInvoices = (invRes.data?.length ?? 0) > 0
          ? invRes.data!
          : getDemoInvoices(account.id).filter((item) => item.status === "overdue" || item.status === "chasing" || item.status === "unpaid");

        setCalls(nextCalls);
        setInvoices(nextInvoices);
        setUsingDemoData((callsRes.data?.length ?? 0) === 0 && (invRes.data?.length ?? 0) === 0);
      } catch (error: unknown) {
        setCalls(getDemoCalls(account.id));
        setInvoices(getDemoInvoices(account.id).filter((item) => item.status === "overdue" || item.status === "chasing" || item.status === "unpaid"));
        setUsingDemoData(true);
        if (!options?.background) {
          toast({
            title: "Showing demo call data",
            description: "Live call records are unavailable right now.",
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [account, toast],
  );

  useEffect(() => {
    if (!account) return;
    void loadData();
  }, [account, loadData]);

  useEffect(() => {
    if (!account) return;

    const channel = supabase
      .channel(`calls-realtime-${account.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calls", filter: `account_id=eq.${account.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const inserted = payload.new as Call;
            setCalls((prev) => (prev.some((item) => item.id === inserted.id) ? prev : [inserted, ...prev]));
            return;
          }

          if (payload.eventType === "UPDATE") {
            const updated = payload.new as Call;
            setCalls((prev) =>
              prev.some((item) => item.id === updated.id)
                ? prev.map((item) => (item.id === updated.id ? updated : item))
                : [updated, ...prev],
            );
            return;
          }

          if (payload.eventType === "DELETE") {
            const deleted = payload.old as Pick<Call, "id">;
            setCalls((prev) => prev.filter((item) => item.id !== deleted.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [account]);

  const startCall = useCallback(
    async (
      invoice: Invoice,
      options?: {
        silentSuccess?: boolean;
        silentError?: boolean;
      },
    ) => {
      if (isDemoId(invoice.id)) {
        setCallingInvoiceId(invoice.id);
        try {
          const now = new Date();
          const demoCallId = `demo-call-live-${now.getTime()}`;
          const initiatedAt = now.toISOString();

          setCalls((prev) => [
            {
              id: demoCallId,
              account_id: invoice.account_id,
              invoice_id: invoice.id,
              client_name: invoice.client_name,
              client_phone: invoice.client_phone ?? "Unknown",
              status: "initiated",
              initiated_at: initiatedAt,
              completed_at: null,
              duration_seconds: null,
              outcome: null,
              transcript: null,
            },
            ...prev,
          ]);

          await new Promise((resolve) => setTimeout(resolve, 1000));

          setCalls((prev) =>
            prev.map((call) =>
              call.id === demoCallId
                ? {
                    ...call,
                    status: "completed",
                    completed_at: new Date(now.getTime() + 95000).toISOString(),
                    duration_seconds: 95,
                    outcome: "Demo call completed with payment commitment within 24h.",
                    transcript:
                      "Assistant confirmed invoice details, provided payment options, and secured a commitment to settle today.",
                  }
                : call,
            ),
          );

          if (!options?.silentSuccess) {
            toast({
              title: "Demo call simulated",
              description: `Simulated collection call for ${invoice.client_name}.`,
            });
          }

          return true;
        } finally {
          setCallingInvoiceId(null);
        }
      }

      if (!invoice.client_phone) {
        toast({
          variant: "destructive",
          title: "No phone number",
          description: "Add a phone number for this client in Dashboard before placing a call.",
        });
        return false;
      }

      setCallingInvoiceId(invoice.id);
      try {
        let callId: string | undefined;
        if (account) {
          const { data: callRecord, error: insertError } = await supabase
            .from("calls")
            .insert({
              account_id: account.id,
              invoice_id: invoice.id,
              client_name: invoice.client_name,
              client_phone: invoice.client_phone,
              status: "initiated",
            })
            .select()
            .single();

          if (insertError) throw insertError;
          callId = callRecord?.id;
        }

        const { data, error } = await supabase.functions.invoke("make-call", {
          body: {
            to: invoice.client_phone,
            clientName: invoice.client_name,
            invoiceNumber: invoice.invoice_number,
            invoiceId: invoice.id,
            amount: invoice.amount,
            dueDate: invoice.due_date ? format(new Date(invoice.due_date), "MMMM d, yyyy") : undefined,
            callId,
          },
        });

        if (error || !data?.success) {
          throw new Error(error?.message || data?.error || "Failed to initiate call");
        }

        if (callId) {
          await supabase.from("calls").update({ status: "in-progress" }).eq("id", callId);
        }

        if (!options?.silentSuccess) {
          toast({
            title: "Call initiated",
            description: `Calling ${invoice.client_name} at ${invoice.client_phone}.`,
          });
        }

        return true;
      } catch (error: unknown) {
        if (!options?.silentError) {
          toast({
            variant: "destructive",
            title: "Call failed",
            description: getErrorMessage(error, "Unable to place the call right now."),
          });
        }
        return false;
      } finally {
        setCallingInvoiceId(null);
      }
    },
    [account, toast],
  );

  useEffect(() => {
    const state = location.state as { autoCallInvoice?: Invoice } | null;
    if (!state?.autoCallInvoice || !account || loading) return;

    void startCall(state.autoCallInvoice);
    navigate(location.pathname, { replace: true, state: null });
  }, [account, loading, location.pathname, location.state, navigate, startCall]);

  const overdueInvoices = useMemo(
    () =>
      invoices
        .filter((item) => item.status === "overdue" && item.client_phone)
        .sort((a, b) => {
          const aTime = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
          const bTime = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
          return aTime - bTime;
        }),
    [invoices],
  );

  const overdueWithoutPhoneCount = useMemo(
    () => invoices.filter((item) => item.status === "overdue" && !item.client_phone).length,
    [invoices],
  );

  const totalCalls = calls.length;
  const completedCalls = calls.filter((item) => item.status === "completed").length;
  const failedCalls = calls.filter((item) => item.status === "failed").length;
  const activeCalls = calls.filter((item) => item.status === "initiated" || item.status === "in-progress").length;
  const totalDuration = calls.reduce((sum, item) => sum + (item.duration_seconds || 0), 0);
  const avgDuration = completedCalls > 0 ? Math.round(totalDuration / completedCalls) : 0;
  const successRate = completedCalls + failedCalls > 0 ? Math.round((completedCalls / (completedCalls + failedCalls)) * 100) : 0;
  const readyAmount = overdueInvoices.reduce((sum, item) => sum + item.amount, 0);

  const filteredCalls = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();

    return calls.filter((call) => {
      if (historyFilter !== "all" && call.status !== historyFilter) {
        return false;
      }

      if (!query) return true;

      return [call.client_name, call.client_phone, call.outcome ?? "", call.transcript ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [calls, historyFilter, historyQuery]);

  useEffect(() => {
    if (!selectedCall) return;
    const present = filteredCalls.some((item) => item.id === selectedCall.id);
    if (!present) setSelectedCall(null);
  }, [filteredCalls, selectedCall]);

  const selectedCallRecord = useMemo(() => {
    if (!selectedCall) return null;
    return calls.find((item) => item.id === selectedCall.id) ?? null;
  }, [calls, selectedCall]);

  const invoicesById = useMemo(
    () => new Map(invoices.map((invoice) => [invoice.id, invoice])),
    [invoices],
  );

  const clearAllCalls = useCallback(async () => {
    if (!account || calls.length === 0) return;
    const confirmed = window.confirm("Delete all call history? This action cannot be undone.");
    if (!confirmed) return;

    const allDemo = calls.every((call) => isDemoId(call.id));
    if (allDemo) {
      setCalls([]);
      setSelectedCall(null);
      toast({ title: "Demo call history cleared" });
      return;
    }

    setClearingHistory(true);
    try {
      const { error } = await supabase.from("calls").delete().eq("account_id", account.id);
      if (error) throw error;

      setCalls([]);
      setSelectedCall(null);
      toast({ title: "Call history cleared" });
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Failed to clear history",
        description: getErrorMessage(error, "Please try again."),
      });
    } finally {
      setClearingHistory(false);
    }
  }, [account, calls, toast]);

  const deleteCall = useCallback(
    async (call: Call) => {
      const confirmed = window.confirm(`Delete call record for ${call.client_name}?`);
      if (!confirmed) return;

      if (isDemoId(call.id)) {
        setCalls((prev) => prev.filter((item) => item.id !== call.id));
        setSelectedCall((prev) => (prev?.id === call.id ? null : prev));
        toast({ title: "Demo call removed" });
        return;
      }

      setDeletingCallId(call.id);
      try {
        const { error } = await supabase.from("calls").delete().eq("id", call.id);
        if (error) throw error;

        setCalls((prev) => prev.filter((item) => item.id !== call.id));
        setSelectedCall((prev) => (prev?.id === call.id ? null : prev));
        toast({ title: "Call deleted" });
      } catch (error: unknown) {
        toast({
          variant: "destructive",
          title: "Failed to delete call",
          description: getErrorMessage(error, "Please try again."),
        });
      } finally {
        setDeletingCallId(null);
      }
    },
    [toast],
  );

  const callAllReadyInvoices = useCallback(async () => {
    if (overdueInvoices.length === 0) return;

    setCallingAll(true);
    let successCount = 0;
    let failedCount = 0;

    for (const invoice of overdueInvoices) {
      const ok = await startCall(invoice, { silentError: true, silentSuccess: true });
      if (ok) successCount += 1;
      else failedCount += 1;
    }

    setCallingAll(false);

    if (failedCount === 0) {
      toast({
        title: "Bulk call started",
        description: `${successCount} calls were queued successfully.`,
      });
      return;
    }

    toast({
      variant: failedCount === overdueInvoices.length ? "destructive" : "default",
      title: "Bulk call finished",
      description: `${successCount} succeeded, ${failedCount} failed.`,
    });
  }, [overdueInvoices, startCall, toast]);

  const callDetails = selectedCallRecord ? (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{selectedCallRecord.client_name}</p>
          <p className="text-xs font-mono text-muted-foreground">{selectedCallRecord.client_phone}</p>
        </div>
        <Badge variant="outline" className={cn("text-[10px] font-semibold", getStatusMeta(selectedCallRecord.status).className)}>
          {getStatusMeta(selectedCallRecord.status).label}
        </Badge>
      </div>

      <Separator />

      <div className="space-y-2 text-xs">
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Started</span>
          <span className="text-right text-foreground">{formatDateTime(selectedCallRecord.initiated_at)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Completed</span>
          <span className="text-right text-foreground">{formatDateTime(selectedCallRecord.completed_at)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Duration</span>
          <span className="font-mono text-foreground">
            {selectedCallRecord.duration_seconds != null ? formatDuration(selectedCallRecord.duration_seconds) : "Not available"}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Invoice</span>
          <span className="text-right text-foreground">
            {selectedCallRecord.invoice_id && invoicesById.get(selectedCallRecord.invoice_id)?.invoice_number
              ? invoicesById.get(selectedCallRecord.invoice_id)?.invoice_number
              : "Not linked"}
          </span>
        </div>
      </div>

      {selectedCallRecord.outcome && (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Outcome</p>
          <p className="rounded-md bg-muted/50 p-2 text-xs text-foreground">{selectedCallRecord.outcome}</p>
        </div>
      )}

      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Transcript</p>
        <p className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-xs leading-relaxed text-foreground">
          {selectedCallRecord.transcript || "No transcript recorded for this call."}
        </p>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-full text-destructive hover:text-destructive"
        onClick={() => void deleteCall(selectedCallRecord)}
        disabled={deletingCallId === selectedCallRecord.id}
      >
        {deletingCallId === selectedCallRecord.id ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Deleting...
          </>
        ) : (
          <>
            <Trash2 className="h-3.5 w-3.5" />
            Delete Call
          </>
        )}
      </Button>
    </div>
  ) : (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-center">
      <PhoneOff className="mx-auto mb-2 h-4 w-4 text-muted-foreground/70" />
      <p className="text-xs text-muted-foreground">Select a call to see outcome, transcript, and metadata.</p>
    </div>
  );

  return (
    <>
      <TopBar
        title="Collection Calls"
        subtitle={usingDemoData ? "AI-driven calls with demo records loaded" : "AI-driven calls to recover overdue invoice payments"}
      />

      <div className="space-y-6 p-4 lg:p-6">
        <section className="animate-fade-in-up" style={{ animationDelay: "50ms" }}>
          <Card className="overflow-hidden border-primary/20">
            <CardContent className="p-0">
              <div className="grid gap-0 lg:grid-cols-[1.4fr_1fr]">
                <div className="space-y-4 bg-gradient-to-br from-primary/10 via-primary/5 to-card p-5 lg:p-6">
                  <div className="flex items-center gap-2 text-primary">
                    <PhoneOutgoing className="h-4 w-4" />
                    <p className="text-xs font-semibold uppercase tracking-wider">Call Queue Control</p>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Prioritize overdue collections with one queue</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Review ready invoices, trigger single calls, or queue all overdue calls in one action.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                      {overdueInvoices.length} ready now
                    </Badge>
                    <Badge variant="outline" className="border-float-red/30 bg-float-red/10 text-float-red">
                      {formatCurrency(readyAmount)} at risk
                    </Badge>
                    {overdueWithoutPhoneCount > 0 && (
                      <Badge variant="outline" className="border-float-amber/30 bg-float-amber/10 text-float-amber">
                        {overdueWithoutPhoneCount} missing phone numbers
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 divide-x divide-y divide-border bg-card">
                  <div className="space-y-1 p-4">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Calls</p>
                    <p className="font-mono text-2xl font-semibold tabular-nums">{totalCalls}</p>
                  </div>
                  <div className="space-y-1 p-4">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Completed</p>
                    <p className="font-mono text-2xl font-semibold tabular-nums text-float-green">{completedCalls}</p>
                  </div>
                  <div className="space-y-1 p-4">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg Duration</p>
                    <p className="font-mono text-2xl font-semibold tabular-nums">{formatDuration(avgDuration)}</p>
                  </div>
                  <div className="space-y-1 p-4">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Success Rate</p>
                    <p className="font-mono text-2xl font-semibold tabular-nums">{successRate}%</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Phone className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Ready to Call</p>
                <p className="text-xl font-semibold font-mono tabular-nums text-foreground">{overdueInvoices.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-float-amber/10">
                <PhoneCall className="h-4 w-4 text-float-amber" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Active Calls</p>
                <p className="text-xl font-semibold font-mono tabular-nums text-foreground">{activeCalls}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-float-red/10">
                <XCircle className="h-4 w-4 text-float-red" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Failed Calls</p>
                <p className="text-xl font-semibold font-mono tabular-nums text-foreground">{failedCalls}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Queue Value</p>
                <p className="text-xl font-semibold font-mono tabular-nums text-foreground">{formatCurrency(readyAmount)}</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-5 lg:grid-cols-12 animate-fade-in-up" style={{ animationDelay: "180ms" }}>
          <Card className="flex flex-col overflow-hidden lg:col-span-4">
            <CardHeader className="space-y-3 border-b border-border/60">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-semibold">Overdue Queue</CardTitle>
                  <p className="text-xs text-muted-foreground">Clients with overdue invoices and a callable phone number.</p>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {overdueInvoices.length}
                </Badge>
              </div>
              <Button
                onClick={() => void callAllReadyInvoices()}
                disabled={overdueInvoices.length === 0 || callingAll || !!callingInvoiceId}
                className="h-9 w-full"
              >
                {callingAll ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Queueing calls...
                  </>
                ) : (
                  <>
                    <PhoneOutgoing className="h-3.5 w-3.5" />
                    Call All Overdue
                  </>
                )}
              </Button>
            </CardHeader>

            <CardContent className="flex-1 p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading queue...
                </div>
              ) : overdueInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Phone className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No overdue invoices ready to call</p>
                  <p className="mt-1 text-xs text-muted-foreground">Add or correct client phone numbers in Dashboard.</p>
                </div>
              ) : (
                <ScrollArea className="h-[560px]">
                  <div className="space-y-2 p-3">
                    {overdueInvoices.map((invoice) => {
                      const isCalling = callingInvoiceId === invoice.id;
                      const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;
                      const isValidDueDate = dueDate ? !Number.isNaN(dueDate.getTime()) : false;
                      const daysOverdue = isValidDueDate ? differenceInCalendarDays(new Date(), dueDate as Date) : null;

                      return (
                        <div key={invoice.id} className="rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-primary/30">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">{invoice.client_name}</p>
                              <p className="text-xs font-mono text-muted-foreground">{invoice.client_phone}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold font-mono tabular-nums">{formatCurrency(invoice.amount)}</p>
                              <p className="text-[10px] text-muted-foreground">{invoice.invoice_number}</p>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div className="text-[10px] text-float-red">
                              {isValidDueDate ? (
                                <>
                                  Due {format(dueDate as Date, "MMM d, yyyy")}
                                  {typeof daysOverdue === "number" && daysOverdue >= 0 ? ` (${daysOverdue}d overdue)` : ""}
                                </>
                              ) : (
                                "Due date unavailable"
                              )}
                            </div>

                            <Button
                              size="sm"
                              className="h-7 px-2.5 text-xs"
                              onClick={() => void startCall(invoice)}
                              disabled={!!callingInvoiceId || callingAll}
                            >
                              {isCalling ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Calling...
                                </>
                              ) : (
                                <>
                                  <Phone className="h-3 w-3" />
                                  Call Now
                                  <ArrowUpRight className="h-3 w-3 opacity-70" />
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Card className="flex flex-col overflow-hidden lg:col-span-8">
            <CardHeader className="space-y-3 border-b border-border/60">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-sm font-semibold">Call History</CardTitle>
                  <p className="text-xs text-muted-foreground">Search, filter, and review outcomes from all collection calls.</p>
                </div>

                <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                  <div className="relative w-full sm:max-w-[240px]">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={historyQuery}
                      onChange={(event) => setHistoryQuery(event.target.value)}
                      placeholder="Search name, phone, transcript..."
                      className="h-9 pl-8 text-xs"
                    />
                  </div>

                  <Select value={historyFilter} onValueChange={(value: HistoryFilter) => setHistoryFilter(value)}>
                    <SelectTrigger className="h-9 w-full text-xs sm:w-[155px]">
                      <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="initiated">Initiated</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 px-3 text-xs"
                    onClick={() => void loadData({ background: true })}
                    disabled={refreshing}
                  >
                    {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
                    Refresh
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-3 text-xs text-destructive hover:text-destructive"
                    onClick={() => void clearAllCalls()}
                    disabled={calls.length === 0 || clearingHistory}
                  >
                    {clearingHistory ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Clear All
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {filteredCalls.length} visible
                </Badge>
                {historyFilter !== "all" && (
                  <Badge variant="outline" className="text-[10px] capitalize">
                    Filter: {historyFilter}
                  </Badge>
                )}
                {historyQuery.trim() && (
                  <Badge variant="outline" className="text-[10px]">
                    Query: "{historyQuery.trim()}"
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading call history...
                </div>
              ) : calls.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <PhoneOff className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No calls yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">Select an overdue invoice and place your first collection call.</p>
                </div>
              ) : filteredCalls.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Search className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No results match your filters</p>
                  <p className="mt-1 text-xs text-muted-foreground">Try a different status filter or remove the search query.</p>
                </div>
              ) : (
                <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
                  <ScrollArea className="h-[560px]">
                    <div className="divide-y divide-border">
                      {filteredCalls.map((call) => {
                        const statusMeta = getStatusMeta(call.status);
                        const isSelected = selectedCallRecord?.id === call.id;

                        return (
                          <button
                            key={call.id}
                            onClick={() => setSelectedCall(isSelected ? null : call)}
                            className={cn(
                              "w-full px-4 py-3 text-left transition-colors",
                              isSelected ? "bg-primary/[0.06]" : "hover:bg-accent/50",
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 items-start gap-3">
                                <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border", statusMeta.className)}>
                                  {statusMeta.icon}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-foreground">{call.client_name}</p>
                                  <p className="truncate text-xs font-mono text-muted-foreground">{call.client_phone}</p>
                                  <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(call.initiated_at)}</p>
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-2">
                                {call.duration_seconds != null && (
                                  <span className="text-xs font-mono text-muted-foreground">{formatDuration(call.duration_seconds)}</span>
                                )}
                                <Badge variant="outline" className={cn("text-[10px] font-semibold", statusMeta.className)}>
                                  {statusMeta.label}
                                </Badge>
                              </div>
                            </div>

                            {(call.outcome || call.transcript) && (
                              <p className="mt-2 line-clamp-2 pl-11 text-xs text-muted-foreground">
                                {call.outcome || call.transcript}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>

                  <div className="hidden border-l border-border/70 p-4 lg:block">{callDetails}</div>
                </div>
              )}

              {filteredCalls.length > 0 && <div className="border-t border-border/70 p-4 lg:hidden">{callDetails}</div>}
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  );
}

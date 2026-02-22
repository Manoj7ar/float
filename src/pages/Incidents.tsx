import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  Loader2,
  PhoneCall,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccount } from "@/hooks/useAccount";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { getDemoIncidents, isDemoId } from "@/lib/demo-content";
import { formatCurrency } from "@/lib/format";

type Incident = Tables<"incidents">;
type IncidentEvent = { type: string; timestamp: string; message: string };
type IncidentFilter = "all" | "open" | "closed";
type IncidentSort = "newest" | "oldest" | "severity" | "shortfall";

const severityColor: Record<string, string> = {
  P1: "border-float-red/25 bg-float-red/10 text-float-red",
  P2: "border-float-amber/25 bg-float-amber/10 text-float-amber",
  P3: "border-primary/25 bg-primary/10 text-primary",
};

const severityAccent: Record<string, string> = {
  P1: "border-l-float-red",
  P2: "border-l-float-amber",
  P3: "border-l-primary",
};

const severityIcon: Record<string, ReactNode> = {
  P1: <ShieldAlert className="h-4 w-4 text-float-red" />,
  P2: <AlertTriangle className="h-4 w-4 text-float-amber" />,
  P3: <Clock className="h-4 w-4 text-primary" />,
};

const statusColor: Record<string, string> = {
  open: "border-float-red/25 bg-float-red/10 text-float-red",
  investigating: "border-float-amber/25 bg-float-amber/10 text-float-amber",
  mitigated: "border-primary/25 bg-primary/10 text-primary",
  resolved: "border-float-green/25 bg-float-green/10 text-float-green",
  closed: "border-border bg-muted text-muted-foreground",
};

const eventTypeIcon: Record<string, ReactNode> = {
  DETECTED: <AlertTriangle className="h-3.5 w-3.5 text-float-red" />,
  STRATEGY_COMPUTED: <Brain className="h-3.5 w-3.5 text-primary" />,
  PAYMENT_LINK_SENT: <CreditCard className="h-3.5 w-3.5 text-primary" />,
  CALL_INITIATED: <PhoneCall className="h-3.5 w-3.5 text-float-amber" />,
  CALL_COMPLETED: <CheckCircle2 className="h-3.5 w-3.5 text-float-green" />,
  PAYMENT_RECEIVED: <CheckCircle2 className="h-3.5 w-3.5 text-float-green" />,
  RESOLVED: <CheckCircle2 className="h-3.5 w-3.5 text-float-green" />,
};

const severityRank: Record<string, number> = {
  P1: 0,
  P2: 1,
  P3: 2,
};

const isOpenIncident = (status: string) =>
  status === "open" || status === "investigating";
const isClosedIncident = (status: string) =>
  status === "resolved" || status === "closed" || status === "mitigated";

const formatStatusLabel = (value: string) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatAbsoluteDate = (value: string | null | undefined, pattern: string) => {
  if (!value) return "Unknown date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";
  return format(parsed, pattern);
};

const formatRelativeDate = (value: string | null | undefined) => {
  if (!value) return "Unknown time";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown time";
  return formatDistanceToNow(parsed, { addSuffix: true });
};

const toTimestamp = (value: string | null | undefined) => {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

export default function IncidentsPage() {
  const { account, loading: accountLoading } = useAccount();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<IncidentFilter>("all");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<IncidentSort>("newest");
  const [usingDemoData, setUsingDemoData] = useState(false);

  useEffect(() => {
    if (accountLoading) return;

    if (!account) {
      setIncidents(getDemoIncidents("demo-account"));
      setUsingDemoData(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    supabase
      .from("incidents")
      .select("*")
      .eq("account_id", account.id)
      .order("opened_at", { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        if (data && data.length > 0) {
          setIncidents(data);
          setUsingDemoData(false);
          return;
        }

        setIncidents(getDemoIncidents(account.id));
        setUsingDemoData(true);
      })
      .catch(() => {
        if (cancelled) return;
        setIncidents(getDemoIncidents(account.id));
        setUsingDemoData(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [account, accountLoading]);

  useEffect(() => {
    if (!account) return;

    const channel = supabase
      .channel(`incidents-realtime-${account.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "incidents",
          filter: `account_id=eq.${account.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setIncidents((prev) => [payload.new as Incident, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setIncidents((prev) =>
              prev.map((incident) =>
                incident.id === (payload.new as Incident).id
                  ? (payload.new as Incident)
                  : incident
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [account]);

  const updateStatus = async (id: string, status: string) => {
    const updates: Partial<Incident> & { status: string } = { status };
    if (status === "resolved" || status === "closed") {
      updates.closed_at = new Date().toISOString();
    }

    setIncidents((prev) =>
      prev.map((incident) =>
        incident.id === id ? { ...incident, ...updates } : incident
      )
    );

    if (!isDemoId(id)) {
      await supabase.from("incidents").update(updates).eq("id", id);
    }
  };

  const addEvent = async (incident: Incident, type: string, message: string) => {
    const events = (Array.isArray(incident.events)
      ? incident.events
      : []) as IncidentEvent[];
    const updatedEvents = [
      ...events,
      { type, timestamp: new Date().toISOString(), message },
    ];

    setIncidents((prev) =>
      prev.map((inc) =>
        inc.id === incident.id ? { ...inc, events: updatedEvents } : inc
      )
    );

    if (!isDemoId(incident.id)) {
      await supabase
        .from("incidents")
        .update({ events: updatedEvents })
        .eq("id", incident.id);
    }
  };

  const filteredByStatus = useMemo(() => {
    return incidents.filter((incident) => {
      if (filter === "open") return isOpenIncident(incident.status);
      if (filter === "closed") return isClosedIncident(incident.status);
      return true;
    });
  }, [filter, incidents]);

  const openCount = useMemo(
    () => incidents.filter((incident) => isOpenIncident(incident.status)).length,
    [incidents]
  );
  const resolvedCount = useMemo(
    () =>
      incidents.filter(
        (incident) => incident.status === "resolved" || incident.status === "closed"
      ).length,
    [incidents]
  );
  const p1OpenCount = useMemo(
    () =>
      incidents.filter(
        (incident) => incident.severity === "P1" && isOpenIncident(incident.status)
      ).length,
    [incidents]
  );
  const totalEvents = useMemo(
    () =>
      incidents.reduce(
        (sum, incident) =>
          sum +
          (Array.isArray(incident.events)
            ? (incident.events as IncidentEvent[]).length
            : 0),
        0
      ),
    [incidents]
  );
  const callEvents = useMemo(
    () =>
      incidents.reduce((sum, incident) => {
        const events = (Array.isArray(incident.events)
          ? incident.events
          : []) as IncidentEvent[];
        return (
          sum +
          events.filter(
            (event) =>
              event.type === "CALL_COMPLETED" || event.type === "CALL_INITIATED"
          ).length
        );
      }, 0),
    [incidents]
  );

  const filterOptions: { key: IncidentFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: incidents.length },
    { key: "open", label: "Open", count: openCount },
    { key: "closed", label: "Closed", count: incidents.length - openCount },
  ];

  const visibleIncidents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const withSearch = filteredByStatus.filter((incident) => {
      if (!normalizedQuery) return true;

      const eventMessages = ((Array.isArray(incident.events)
        ? incident.events
        : []) as IncidentEvent[])
        .map((event) => event.message)
        .join(" ");

      const haystack = [
        incident.title,
        incident.description ?? "",
        incident.status,
        incident.severity,
        eventMessages,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });

    return [...withSearch].sort((a, b) => {
      if (sortBy === "oldest") {
        return toTimestamp(a.opened_at) - toTimestamp(b.opened_at);
      }

      if (sortBy === "severity") {
        const severityDelta =
          (severityRank[a.severity] ?? 99) - (severityRank[b.severity] ?? 99);
        if (severityDelta !== 0) return severityDelta;
        return toTimestamp(b.opened_at) - toTimestamp(a.opened_at);
      }

      if (sortBy === "shortfall") {
        const shortfallDelta =
          (b.shortfall_amount ?? 0) - (a.shortfall_amount ?? 0);
        if (shortfallDelta !== 0) return shortfallDelta;
        return toTimestamp(b.opened_at) - toTimestamp(a.opened_at);
      }

      return toTimestamp(b.opened_at) - toTimestamp(a.opened_at);
    });
  }, [filteredByStatus, query, sortBy]);

  const hasActiveControls =
    filter !== "all" || query.trim().length > 0 || sortBy !== "newest";

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-background via-background to-accent/20">
      <div className="border-b border-border/70 bg-card/90 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                <Zap size={17} className="text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-foreground">
                  Incidents
                </h1>
                <p className="text-xs text-muted-foreground">
                  Powered by Incident.io | AI continuously learning from each
                  response
                </p>
                {usingDemoData && (
                  <p className="mt-0.5 text-[11px] text-primary">Showing demo incident timeline</p>
                )}
              </div>
            </div>

            <div className="flex w-full flex-wrap gap-1 rounded-xl border border-border/70 bg-background/70 p-1 sm:w-auto sm:flex-nowrap">
              {filterOptions.map((option) => (
                <button
                  key={option.key}
                  onClick={() => setFilter(option.key)}
                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all sm:flex-none ${
                    filter === option.key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {option.label}
                  <span
                    className={`rounded-full px-1.5 py-0 text-[10px] ${
                      filter === option.key
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {option.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <LearningStatCard
              icon={<Brain size={14} className="text-primary" />}
              label="Learnings Captured"
              value={totalEvents}
              note="Events tracked across incidents"
            />
            <LearningStatCard
              icon={<PhoneCall size={14} className="text-float-amber" />}
              label="Learning from Calls"
              value={callEvents}
              note="Calls with captured outcomes"
            />
            <LearningStatCard
              icon={<CheckCircle2 size={14} className="text-float-green" />}
              label="Incidents Resolved"
              value={resolvedCount}
              note="Closed with successful outcome"
            />
            <LearningStatCard
              icon={<TrendingUp size={14} className="text-float-red" />}
              label="P1 Active"
              value={p1OpenCount}
              note="Highest-priority active incidents"
              highlight={p1OpenCount > 0}
            />
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_180px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search incidents, statuses, or timeline events"
                className="h-9 border-border/70 bg-background/80 pl-8 text-sm"
              />
            </div>

            <Select
              value={sortBy}
              onValueChange={(value) => setSortBy(value as IncidentSort)}
            >
              <SelectTrigger className="h-9 border-border/70 bg-background/80 text-xs">
                <div className="inline-flex items-center gap-1.5">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Sort" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="severity">Highest Severity</SelectItem>
                <SelectItem value="shortfall">Largest Shortfall</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveControls ? (
              <Button
                size="sm"
                variant="outline"
                className="h-9 border-border/70 bg-background/80 text-xs"
                onClick={() => {
                  setFilter("all");
                  setQuery("");
                  setSortBy("newest");
                }}
              >
                Reset View
              </Button>
            ) : (
              <div className="hidden md:block" />
            )}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl space-y-4 py-6">
          {!loading && (
            <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
              <span>
                Showing {visibleIncidents.length} of {incidents.length} incident
                {incidents.length !== 1 ? "s" : ""}
              </span>
              <span>
                {sortBy === "newest" && "Sorted by newest"}
                {sortBy === "oldest" && "Sorted by oldest"}
                {sortBy === "severity" && "Sorted by severity"}
                {sortBy === "shortfall" && "Sorted by shortfall"}
              </span>
            </div>
          )}

          {!loading && resolvedCount > 0 && <AiLearningSummary incidents={incidents} />}

          {loading ? (
            <Card className="border-border/70 bg-card/70">
              <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading incidents...
              </CardContent>
            </Card>
          ) : visibleIncidents.length === 0 ? (
            <Card className="border-border/70 bg-card/70">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <CheckCircle2 className="mb-3 h-10 w-10 text-float-green/40" />
                <p className="text-sm font-medium text-foreground">
                  {incidents.length === 0
                    ? "No incidents recorded"
                    : "No incidents match your current view"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {incidents.length === 0
                    ? "New operational issues and AI-detected anomalies will appear here."
                    : "Try adjusting the filter, search term, or sorting option."}
                </p>
              </CardContent>
            </Card>
          ) : (
            visibleIncidents.map((incident) => {
              const events = (Array.isArray(incident.events)
                ? incident.events
                : []) as IncidentEvent[];
              const expanded = expandedId === incident.id;

              return (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  events={events}
                  expanded={expanded}
                  onToggle={() => setExpandedId(expanded ? null : incident.id)}
                  onUpdateStatus={updateStatus}
                  onAddEvent={addEvent}
                />
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function LearningStatCard({
  icon,
  label,
  value,
  note,
  highlight,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  note: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 ${
        highlight
          ? "border-float-red/25 bg-float-red/[0.05]"
          : "border-border/70 bg-background/75"
      }`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-mono text-lg font-semibold leading-none tabular-nums text-foreground">
          {value}
        </p>
        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{note}</p>
      </div>
    </div>
  );
}

function IncidentCard({
  incident,
  events,
  expanded,
  onToggle,
  onUpdateStatus,
  onAddEvent,
}: {
  incident: Incident;
  events: IncidentEvent[];
  expanded: boolean;
  onToggle: () => void;
  onUpdateStatus: (id: string, status: string) => Promise<void>;
  onAddEvent: (incident: Incident, type: string, message: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const isActive = isOpenIncident(incident.status);
  const isP1Active = incident.severity === "P1" && isActive;
  const sortedEvents = useMemo(
    () =>
      [...events].sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ),
    [events]
  );
  const latestEventTime = sortedEvents[sortedEvents.length - 1]?.timestamp;

  const runTransition = async (status: string, eventMessage?: string) => {
    setBusy(true);
    try {
      if (eventMessage) {
        await onAddEvent(incident, status === "resolved" ? "RESOLVED" : "STATUS", eventMessage);
      }
      await onUpdateStatus(incident.id, status);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      className={`overflow-hidden border-l-4 border-border/70 bg-card/80 transition-all ${
        severityAccent[incident.severity] ?? "border-l-primary"
      } ${expanded ? "shadow-md" : "hover:shadow-sm"} ${
        isP1Active ? "ring-1 ring-float-red/20 shadow-[0_0_0_1px_hsl(var(--float-red)/0.15)]" : ""
      }`}
    >
      <CardHeader className="pb-3">
        <div
          className="cursor-pointer rounded-lg p-1 transition-colors hover:bg-accent/40"
          onClick={onToggle}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {expanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                {severityIcon[incident.severity]}
                <CardTitle className="truncate text-base font-semibold">
                  {incident.title}
                </CardTitle>
              </div>
              {incident.description && (
                <p className="mt-1 pl-6 text-sm text-muted-foreground">
                  {incident.description}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="outline" className={severityColor[incident.severity]}>
                {incident.severity}
              </Badge>
              <Badge variant="outline" className={statusColor[incident.status] ?? ""}>
                {formatStatusLabel(incident.status)}
              </Badge>
              {incident.shortfall_amount ? (
                <Badge
                  variant="outline"
                  className="border-float-red/20 bg-float-red/5 font-mono tabular-nums text-float-red"
                >
                  {formatCurrency(incident.shortfall_amount)}
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 pl-6 text-xs text-muted-foreground">
            {incident.opened_at && (
              <span>
                Opened {formatAbsoluteDate(incident.opened_at, "MMM d, yyyy h:mm a")}
              </span>
            )}
            {incident.closed_at && (
              <>
                <span className="h-1 w-1 rounded-full bg-border" />
                <span>
                  Closed {formatAbsoluteDate(incident.closed_at, "MMM d, yyyy h:mm a")}
                </span>
              </>
            )}
            <span className="h-1 w-1 rounded-full bg-border" />
            <span>{events.length} event{events.length !== 1 ? "s" : ""}</span>
            {latestEventTime && (
              <>
                <span className="h-1 w-1 rounded-full bg-border" />
                <span>
                  Last activity{" "}
                  {formatRelativeDate(latestEventTime)}
                </span>
              </>
            )}
            {incident.shortfall_amount ? (
              <>
                <span className="h-1 w-1 rounded-full bg-border" />
                <span className="font-mono font-medium tabular-nums text-float-red">
                  Shortfall {formatCurrency(incident.shortfall_amount)}
                </span>
              </>
            ) : null}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          {events.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/[0.04] px-3 py-2">
              <Sparkles size={13} className="shrink-0 text-primary" />
              <p className="text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">
                  Learning from this incident
                </span>{" "}
                - {events.length} event{events.length !== 1 ? "s" : ""} tracked
              </p>
            </div>
          )}

          <div className="rounded-xl border border-border/70 bg-background/70 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Timeline
            </p>
            <div className="border-l border-border pl-3">
              {sortedEvents.length === 0 ? (
                <p className="py-1 text-xs text-muted-foreground">
                  No events recorded yet.
                </p>
              ) : (
                sortedEvents.map((event, idx) => (
                  <div key={`${event.type}-${event.timestamp}-${idx}`} className="relative mb-3 last:mb-0">
                    <div className="absolute -left-[1.03rem] top-2 h-2.5 w-2.5 rounded-full border border-border bg-card" />
                    <div className="rounded-lg border border-border/60 bg-card px-2.5 py-2">
                      <div className="flex items-start gap-2">
                        {eventTypeIcon[event.type] ?? (
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground">{event.message}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatAbsoluteDate(event.timestamp, "MMM d, yyyy h:mm:ss a")}
                          </p>
                        </div>
                        {(event.type === "CALL_COMPLETED" ||
                          event.type === "STRATEGY_COMPUTED") && (
                          <Badge
                            variant="outline"
                            className="h-5 border-primary/20 bg-primary/5 px-1.5 text-[9px] font-semibold text-primary"
                          >
                            <BookOpen size={8} className="mr-0.5" />
                            AI Learned
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {isActive && (
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              {incident.status === "open" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => runTransition("investigating", "Investigation started")}
                >
                  Start Investigating
                </Button>
              )}
              {incident.status !== "mitigated" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => runTransition("mitigated", "Risk has been mitigated")}
                >
                  Mark Mitigated
                </Button>
              )}
              <Button
                size="sm"
                disabled={busy}
                onClick={() => runTransition("resolved", "Incident resolved")}
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Resolve
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function AiLearningSummary({ incidents }: { incidents: Incident[] }) {
  const [expanded, setExpanded] = useState(false);

  const resolved = useMemo(
    () =>
      incidents.filter(
        (incident) =>
          incident.status === "resolved" || incident.status === "closed"
      ),
    [incidents]
  );

  const allEvents = useMemo(
    () =>
      resolved.flatMap((incident) => {
        const events = (Array.isArray(incident.events)
          ? incident.events
          : []) as IncidentEvent[];
        return events.map((event) => ({ ...event, incidentTitle: incident.title }));
      }),
    [resolved]
  );

  const callLearnings = allEvents.filter((event) => event.type === "CALL_COMPLETED");
  const paymentLearnings = allEvents.filter(
    (event) => event.type === "PAYMENT_RECEIVED"
  );
  const strategyLearnings = allEvents.filter(
    (event) => event.type === "STRATEGY_COMPUTED"
  );
  const totalShortfallRecovered = resolved
    .filter((incident) => incident.shortfall_amount)
    .reduce((sum, incident) => sum + (incident.shortfall_amount ?? 0), 0);

  return (
    <Card className="border-primary/15 bg-gradient-to-br from-primary/[0.05] via-card to-card">
      <CardHeader className="cursor-pointer pb-3" onClick={() => setExpanded((v) => !v)}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
              <Brain size={14} className="text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">
                AI Learning Summary
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">
                Insights from {resolved.length} resolved incident
                {resolved.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-primary/20 bg-primary/10 text-[10px] text-primary"
            >
              <Sparkles size={9} className="mr-1" />
              {allEvents.length} learnings
            </Badge>
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryMetric
              label="Shortfall Addressed"
              value={formatCurrency(totalShortfallRecovered)}
              tone="text-float-green"
            />
            <SummaryMetric
              label="Call Outcomes Learned"
              value={`${callLearnings.length}`}
              tone="text-primary"
            />
            <SummaryMetric
              label="Strategies Computed"
              value={`${strategyLearnings.length}`}
              tone="text-float-amber"
            />
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Key Learnings
            </p>

            {callLearnings.length > 0 && (
              <LearningDetail
                icon={<PhoneCall size={13} className="text-float-amber" />}
                title="Learning from Calls"
                text={`${callLearnings.length} collection call${
                  callLearnings.length !== 1 ? "s" : ""
                } captured. AI is adapting contact strategy based on response patterns.`}
                samples={callLearnings}
              />
            )}

            {paymentLearnings.length > 0 && (
              <LearningDetail
                icon={<CreditCard size={13} className="text-float-green" />}
                title="Learning from Payments"
                text={`${paymentLearnings.length} payment${
                  paymentLearnings.length !== 1 ? "s" : ""
                } recorded. AI is identifying actions most likely to convert outstanding invoices.`}
                samples={paymentLearnings}
              />
            )}

            {strategyLearnings.length > 0 && (
              <LearningDetail
                icon={<Brain size={13} className="text-primary" />}
                title="Learning from Strategies"
                text={`${strategyLearnings.length} strategy decision${
                  strategyLearnings.length !== 1 ? "s" : ""
                } computed. The incident playbook keeps improving across similar cases.`}
                samples={strategyLearnings}
              />
            )}

            {callLearnings.length === 0 &&
              paymentLearnings.length === 0 &&
              strategyLearnings.length === 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-card px-3 py-2.5">
                  <Sparkles size={13} className="text-muted-foreground" />
                  <p className="text-[11px] text-muted-foreground">
                    Incidents were resolved, but no detailed learning events were
                    captured yet.
                  </p>
                </div>
              )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function SummaryMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/70 p-3 text-center">
      <p className={`font-mono text-lg font-semibold leading-none tabular-nums ${tone}`}>
        {value}
      </p>
      <p className="mt-1 text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function LearningDetail({
  icon,
  title,
  text,
  samples,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  samples: Array<IncidentEvent & { incidentTitle: string }>;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card px-3 py-2.5">
      <div className="flex items-start gap-2">
        <div className="mt-0.5">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">{title}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{text}</p>
          <div className="mt-2 space-y-1">
            {samples.slice(0, 2).map((sample, idx) => (
              <p key={`${sample.timestamp}-${idx}`} className="text-[10px] text-muted-foreground">
                <span className="font-medium text-foreground">Incident:</span>{" "}
                {sample.incidentTitle} - {sample.message}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

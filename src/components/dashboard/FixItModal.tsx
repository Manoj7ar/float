import { useEffect, useState, type CSSProperties } from "react";
import { CheckCircle, Loader2, Phone, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FloatLogo } from "@/components/FloatLogo";
import type { Tables } from "@/integrations/supabase/types";

type Incident = Tables<"incidents">;

interface FixItModalProps {
  incident: Incident;
  onClose: () => void;
}

const logSequence = [
  { icon: "loading", time: "14:32:01", message: "Analysing payroll shortfall..." },
  { icon: "check", time: "14:32:02", message: "Gap confirmed: EUR 2,200 before Friday payroll." },
  { icon: "check", time: "14:32:03", message: "TechCorp Dublin - INV-047 (EUR 2,400) identified as resolution." },
  { icon: "loading", time: "14:32:04", message: "Creating Stripe payment link..." },
  { icon: "check", time: "14:32:05", message: "Payment link created: pay.stripe.com/float/inv047" },
  { icon: "loading", time: "14:32:06", message: "Preparing AI call to TechCorp Dublin..." },
  { icon: "check", time: "14:32:07", message: "Call strategy confirmed. Dynamic variables injected." },
  { icon: "phone", time: "14:32:08", message: "Initiating call to TechCorp Dublin (+353 1 234 5678)..." },
  { icon: "live", time: "14:32:10", message: "LIVE CALL IN PROGRESS" },
];

const postCallLogs = [
  { icon: "check", time: "14:36:52", message: "Call completed - TechCorp committed to payment today." },
  { icon: "check", time: "14:36:53", message: "Stripe link confirmed sent to accounts@techcorp.ie" },
  { icon: "loading", time: "14:36:54", message: "Monitoring for payment confirmation..." },
];

const resolutionLogs = [
  { icon: "resolved", time: "14:41:18", message: "PAYMENT RECEIVED - EUR 2,400 from TechCorp Dublin" },
  { icon: "resolved", time: "14:41:18", message: "Payroll shortfall ELIMINATED" },
  { icon: "resolved", time: "14:41:18", message: "8 employees will be paid on Friday" },
];

export function FixItModal({ incident, onClose }: FixItModalProps) {
  const [visibleLogs, setVisibleLogs] = useState(0);
  const [showCall, setShowCall] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [phase, setPhase] = useState<"activity" | "call" | "postcall" | "resolution" | "complete">("activity");
  const [postCallIndex, setPostCallIndex] = useState(0);
  const [resolutionIndex, setResolutionIndex] = useState(0);

  useEffect(() => {
    if (phase !== "activity") return;
    if (visibleLogs < logSequence.length) {
      const timer = setTimeout(() => setVisibleLogs((v) => v + 1), 800);
      return () => clearTimeout(timer);
    }

    setShowCall(true);
    setPhase("call");
  }, [visibleLogs, phase]);

  useEffect(() => {
    if (phase !== "call") return;
    const timer = setInterval(() => setCallDuration((d) => d + 1), 1000);
    const endCall = setTimeout(() => setPhase("postcall"), 8000);
    return () => {
      clearInterval(timer);
      clearTimeout(endCall);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "postcall") return;
    if (postCallIndex < postCallLogs.length) {
      const timer = setTimeout(() => setPostCallIndex((i) => i + 1), 800);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => setPhase("resolution"), 3000);
    return () => clearTimeout(timer);
  }, [phase, postCallIndex]);

  useEffect(() => {
    if (phase !== "resolution") return;
    if (resolutionIndex < resolutionLogs.length) {
      const timer = setTimeout(() => setResolutionIndex((i) => i + 1), 600);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => setPhase("complete"), 1000);
    return () => clearTimeout(timer);
  }, [phase, resolutionIndex]);

  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const renderLogIcon = (icon: string) => {
    if (icon === "loading") return <Loader2 size={14} className="animate-spin text-muted-foreground" />;
    if (icon === "check") return <CheckCircle size={14} className="text-float-green" />;
    if (icon === "phone") return <Phone size={14} className="text-float-amber" />;
    if (icon === "live") return <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-float-red" />;
    if (icon === "resolved") return <CheckCircle size={14} className="text-float-green" />;
    return null;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4 backdrop-blur-sm animate-fade-in-up"
      style={{ animationDuration: "200ms" }}
    >
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-auto rounded-3xl border border-border/70 bg-card/95 shadow-2xl shadow-black/20">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.16),transparent_70%)]" />

        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full border border-border/70 bg-background/70 p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X size={18} />
        </button>

        {phase !== "complete" ? (
          <div className="space-y-6 p-6 sm:p-8">
            <div className="space-y-3 text-center">
              <div className="flex justify-center">
                <FloatLogo />
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                  <Sparkles size={11} />
                  Autonomous Recovery
                </span>
                <span className="inline-flex items-center rounded-full border border-float-red/20 bg-float-red/10 px-2.5 py-1 text-[10px] font-semibold text-float-red">
                  {incident.severity ?? "P1"} incident
                </span>
              </div>

              <h2 className="text-xl font-bold text-foreground">Float is protecting your payroll.</h2>
              <p className="text-sm text-muted-foreground">
                8 employees are counting on this. Recovery actions are running now.
              </p>
            </div>

            <div className="max-h-64 space-y-2 overflow-auto rounded-2xl border border-border/70 bg-accent/30 p-4 font-mono text-xs">
              {logSequence.slice(0, visibleLogs).map((log, i) => (
                <div key={i} className="flex items-center gap-3 animate-fade-in-up" style={{ animationDuration: "200ms" }}>
                  {renderLogIcon(log.icon)}
                  <span className="text-muted-foreground">{log.time}</span>
                  <span className={log.icon === "live" ? "font-bold text-float-red" : "text-foreground"}>
                    {log.message}
                  </span>
                </div>
              ))}

              {postCallLogs.slice(0, postCallIndex).map((log, i) => (
                <div
                  key={`post-${i}`}
                  className="flex items-center gap-3 animate-fade-in-up"
                  style={{ animationDuration: "200ms" }}
                >
                  {renderLogIcon(log.icon)}
                  <span className="text-muted-foreground">{log.time}</span>
                  <span className="text-foreground">{log.message}</span>
                </div>
              ))}

              {resolutionLogs.slice(0, resolutionIndex).map((log, i) => (
                <div
                  key={`res-${i}`}
                  className="flex items-center gap-3 rounded-lg bg-float-green/10 p-1.5 animate-fade-in-up"
                  style={{ animationDuration: "200ms" }}
                >
                  {renderLogIcon(log.icon)}
                  <span className="text-muted-foreground">{log.time}</span>
                  <span className="font-semibold text-float-green">{log.message}</span>
                </div>
              ))}
            </div>

            {showCall && phase === "call" && (
              <div className="space-y-4 rounded-2xl border border-float-red/25 bg-float-red/[0.03] p-5 animate-fade-in-up">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-float-red" />
                  <span className="text-sm font-bold text-float-red">LIVE CALL IN PROGRESS</span>
                </div>

                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">TechCorp Dublin - Accounts Payable</p>
                  <p className="font-mono text-xs text-muted-foreground">+353 1 234 5678</p>
                </div>

                <div className="flex h-10 items-end justify-center gap-1">
                  {Array.from({ length: 14 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-1 animate-soundwave rounded-full bg-primary"
                      style={
                        {
                          "--wave-height": `${8 + Math.random() * 24}px`,
                          "--wave-duration": `${0.4 + Math.random() * 0.8}s`,
                          animationDelay: `${i * 0.05}s`,
                        } as CSSProperties
                      }
                    />
                  ))}
                </div>

                <p className="text-center font-mono text-sm tabular-nums text-muted-foreground">
                  Duration: {formatDuration(callDuration)}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6 p-6 text-center sm:p-8 animate-fade-in-up">
            <svg className="mx-auto h-20 w-20" viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="25" fill="none" stroke="hsl(var(--float-green))" strokeWidth="2" />
              <path
                className="animate-checkmark"
                fill="none"
                stroke="hsl(var(--float-green))"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14 27l7 7 16-16"
              />
            </svg>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Payroll Secured</h2>
              <p className="text-muted-foreground">8 employees will be paid on Friday, Feb 27.</p>
            </div>

            <div className="space-y-2 rounded-2xl border border-border/70 bg-accent/20 p-4 text-left text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Collected</span>
                <span className="font-mono font-semibold">EUR 2,400 from TechCorp Dublin</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Method</span>
                <span>AI Call + Stripe</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Time to resolution</span>
                <span className="font-mono">4 min 12 sec</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Incident</span>
                <span className="font-medium text-float-green">Closed</span>
              </div>
            </div>

            <Button
              onClick={onClose}
              size="lg"
              className="w-full bg-float-green text-primary-foreground hover:bg-float-green/90"
            >
              Return to Dashboard {"->"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { CheckCircle, Loader2, Phone, X } from "lucide-react";
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
  { icon: "check", time: "14:32:02", message: "Gap confirmed: €2,200 before Friday payroll." },
  { icon: "check", time: "14:32:03", message: "TechCorp Dublin — INV-047 (€2,400) identified as resolution." },
  { icon: "loading", time: "14:32:04", message: "Creating Stripe payment link..." },
  { icon: "check", time: "14:32:05", message: "Payment link created: pay.stripe.com/float/inv047" },
  { icon: "loading", time: "14:32:06", message: "Preparing AI call to TechCorp Dublin..." },
  { icon: "check", time: "14:32:07", message: "Call strategy confirmed. Dynamic variables injected." },
  { icon: "phone", time: "14:32:08", message: "Initiating call to TechCorp Dublin (+353 1 234 5678)..." },
  { icon: "live", time: "14:32:10", message: "LIVE CALL IN PROGRESS" },
];

const postCallLogs = [
  { icon: "check", time: "14:36:52", message: "Call completed — TechCorp committed to payment today." },
  { icon: "check", time: "14:36:53", message: "Stripe link confirmed sent to accounts@techcorp.ie" },
  { icon: "loading", time: "14:36:54", message: "Monitoring for payment confirmation..." },
];

const resolutionLogs = [
  { icon: "resolved", time: "14:41:18", message: "PAYMENT RECEIVED — €2,400 from TechCorp Dublin" },
  { icon: "resolved", time: "14:41:18", message: "Payroll shortfall ELIMINATED" },
  { icon: "resolved", time: "14:41:18", message: "8 employees will be paid on Friday ✓" },
];

export function FixItModal({ incident, onClose }: FixItModalProps) {
  const [visibleLogs, setVisibleLogs] = useState(0);
  const [showCall, setShowCall] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [phase, setPhase] = useState<"activity" | "call" | "postcall" | "resolution" | "complete">("activity");
  const [postCallIndex, setPostCallIndex] = useState(0);
  const [resolutionIndex, setResolutionIndex] = useState(0);

  // Activity log sequence
  useEffect(() => {
    if (phase !== "activity") return;
    if (visibleLogs < logSequence.length) {
      const timer = setTimeout(() => setVisibleLogs((v) => v + 1), 800);
      return () => clearTimeout(timer);
    } else {
      setShowCall(true);
      setPhase("call");
    }
  }, [visibleLogs, phase]);

  // Call duration timer
  useEffect(() => {
    if (phase !== "call") return;
    const timer = setInterval(() => setCallDuration((d) => d + 1), 1000);
    // End call after ~8 seconds for demo
    const endCall = setTimeout(() => setPhase("postcall"), 8000);
    return () => { clearInterval(timer); clearTimeout(endCall); };
  }, [phase]);

  // Post-call logs
  useEffect(() => {
    if (phase !== "postcall") return;
    if (postCallIndex < postCallLogs.length) {
      const timer = setTimeout(() => setPostCallIndex((i) => i + 1), 800);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => setPhase("resolution"), 3000);
      return () => clearTimeout(timer);
    }
  }, [phase, postCallIndex]);

  // Resolution logs
  useEffect(() => {
    if (phase !== "resolution") return;
    if (resolutionIndex < resolutionLogs.length) {
      const timer = setTimeout(() => setResolutionIndex((i) => i + 1), 600);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => setPhase("complete"), 1000);
      return () => clearTimeout(timer);
    }
  }, [phase, resolutionIndex]);

  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const renderLogIcon = (icon: string) => {
    if (icon === "loading") return <Loader2 size={14} className="animate-spin text-muted-foreground" />;
    if (icon === "check") return <CheckCircle size={14} className="text-float-green" />;
    if (icon === "phone") return <Phone size={14} className="text-float-amber" />;
    if (icon === "live") return <span className="h-3 w-3 rounded-full bg-float-red animate-pulse inline-block" />;
    if (icon === "resolved") return <CheckCircle size={14} className="text-float-green" />;
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm animate-fade-in-up" style={{ animationDuration: "200ms" }}>
      <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl max-h-[90vh] overflow-auto">
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground hover:text-foreground z-10">
          <X size={18} />
        </button>

        {phase !== "complete" ? (
          <div className="p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="flex justify-center"><FloatLogo /></div>
              <h2 className="text-xl font-bold text-foreground">Float is protecting your payroll.</h2>
              <p className="text-sm text-muted-foreground">8 employees are counting on this. We've got it.</p>
            </div>

            {/* Activity Log */}
            <div className="rounded-xl bg-accent/50 p-4 font-mono text-xs space-y-2 max-h-64 overflow-auto">
              {logSequence.slice(0, visibleLogs).map((log, i) => (
                <div key={i} className="flex items-center gap-3 animate-fade-in-up" style={{ animationDuration: "200ms" }}>
                  {renderLogIcon(log.icon)}
                  <span className="text-muted-foreground">{log.time}</span>
                  <span className={`text-foreground ${log.icon === "live" ? "font-bold text-float-red" : ""}`}>{log.message}</span>
                </div>
              ))}

              {/* Post-call logs */}
              {postCallLogs.slice(0, postCallIndex).map((log, i) => (
                <div key={`post-${i}`} className="flex items-center gap-3 animate-fade-in-up" style={{ animationDuration: "200ms" }}>
                  {renderLogIcon(log.icon)}
                  <span className="text-muted-foreground">{log.time}</span>
                  <span className="text-foreground">{log.message}</span>
                </div>
              ))}

              {/* Resolution logs */}
              {resolutionLogs.slice(0, resolutionIndex).map((log, i) => (
                <div key={`res-${i}`} className="flex items-center gap-3 animate-fade-in-up rounded bg-float-green/10 p-1.5" style={{ animationDuration: "200ms" }}>
                  {renderLogIcon(log.icon)}
                  <span className="text-muted-foreground">{log.time}</span>
                  <span className="text-float-green font-semibold">{log.message}</span>
                </div>
              ))}
            </div>

            {/* Live Call Panel */}
            {showCall && (phase === "call") && (
              <div className="rounded-xl border border-float-red/30 bg-float-red/[0.03] p-5 space-y-4 animate-fade-in-up">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-float-red animate-pulse" />
                  <span className="text-sm font-bold text-float-red">LIVE CALL IN PROGRESS</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">TechCorp Dublin — Accounts Payable</p>
                  <p className="text-xs text-muted-foreground font-mono">+353 1 234 5678</p>
                </div>

                {/* Soundwave */}
                <div className="flex items-end justify-center gap-1 h-10">
                  {Array.from({ length: 14 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-1 rounded-full bg-primary animate-soundwave"
                      style={{
                        "--wave-height": `${8 + Math.random() * 24}px`,
                        "--wave-duration": `${0.4 + Math.random() * 0.8}s`,
                        animationDelay: `${i * 0.05}s`,
                      } as React.CSSProperties}
                    />
                  ))}
                </div>

                <p className="text-center font-mono text-sm text-muted-foreground tabular-nums">
                  Duration: {formatDuration(callDuration)}
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Resolution Screen */
          <div className="p-8 text-center space-y-6 animate-fade-in-up">
            <svg className="mx-auto h-20 w-20" viewBox="0 0 52 52">
              <circle cx="26" cy="26" r="25" fill="none" stroke="hsl(var(--float-green))" strokeWidth="2" />
              <path className="animate-checkmark" fill="none" stroke="hsl(var(--float-green))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="M14 27l7 7 16-16" />
            </svg>
            <h2 className="text-2xl font-bold text-foreground">Payroll Secured</h2>
            <p className="text-muted-foreground">8 employees will be paid on Friday, Feb 27.</p>

            <div className="rounded-xl border border-border bg-accent/30 p-4 text-left space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Collected</span><span className="font-mono font-semibold">€2,400 from TechCorp Dublin</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span>AI Call + Stripe</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Time to resolution</span><span className="font-mono">4 min 12 sec</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Incident</span><span className="text-float-green font-medium">Closed</span></div>
            </div>

            <Button onClick={onClose} size="lg" className="w-full bg-float-green hover:bg-float-green/90 text-primary-foreground">
              Return to Dashboard →
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

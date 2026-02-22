import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAccount } from "@/hooks/useAccount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FloatLogo } from "@/components/FloatLogo";
import { Switch } from "@/components/ui/switch";
import { Check, Loader2, Shield, Eye, Unplug } from "lucide-react";
import { loadDemoData } from "@/lib/demo-data";

const sectors = ["Restaurant", "Agency", "Clinic", "Construction", "Retail", "Other"];
const employeeRanges = ["1-5", "6-15", "16-30", "31-50", "50+"];
const frequencies = ["Weekly", "Biweekly", "Monthly"];
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const syncSteps = [
  "Connecting to Monzo",
  "Syncing 90 days of transactions",
  "AI is building your cashflow model",
  "Calculating payroll risk",
  "Your dashboard is ready",
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { account, createAccount, updateAccount } = useAccount();
  const [step, setStep] = useState(1);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [syncIndex, setSyncIndex] = useState(-1);
  const [demoMode, setDemoMode] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);

  // Form state
  const [businessName, setBusinessName] = useState("");
  const [sector, setSector] = useState("");
  const [employees, setEmployees] = useState("");
  const [payroll, setPayroll] = useState("");
  const [frequency, setFrequency] = useState("");
  const [payday, setPayday] = useState("");

  useEffect(() => {
    if (user && !account) {
      createAccount();
    }
    if (account?.onboarding_complete) {
      navigate("/dashboard");
    }
  }, [user, account]);

  // Syncing animation
  useEffect(() => {
    if (step === 4 && syncIndex < syncSteps.length - 1) {
      const timer = setTimeout(() => setSyncIndex((i) => i + 1), 800);
      return () => clearTimeout(timer);
    }
  }, [step, syncIndex]);

  const handleBusinessDetailNext = async (value: string) => {
    const updates: Record<string, unknown> = {};
    if (questionIndex === 0) { setBusinessName(value); updates.business_name = value; }
    if (questionIndex === 1) { setSector(value); updates.sector = value.toLowerCase(); }
    if (questionIndex === 2) {
      setEmployees(value);
      const num = value === "50+" ? 50 : parseInt(value.split("-")[1] || value);
      updates.employee_count = num;
    }
    if (questionIndex === 3) {
      setPayroll(value);
      updates.payroll_amount = Math.round(parseFloat(value) * 100);
    }
    if (questionIndex === 4) { setFrequency(value); updates.payroll_frequency = value.toLowerCase(); }
    if (questionIndex === 5) { setPayday(value); updates.payroll_day = value.toLowerCase(); }

    await updateAccount(updates);

    if (questionIndex < 5) {
      setQuestionIndex((i) => i + 1);
    } else {
      setStep(3);
    }
  };

  const handleConnectMonzo = () => {
    // Skip to syncing step for now (Monzo OAuth will be wired in edge functions)
    setStep(4);
    setSyncIndex(0);
  };

  const handleEnterDashboard = async () => {
    if (demoMode && account) {
      setLoadingDemo(true);
      await loadDemoData(account.id);
      await updateAccount({ onboarding_complete: true });
      setLoadingDemo(false);
    } else {
      await updateAccount({ onboarding_complete: true });
    }
    navigate("/dashboard");
  };

  const questions = [
    { label: "What's your business name?", type: "text" as const },
    { label: "What sector are you in?", type: "pills" as const, options: sectors },
    { label: "How many employees?", type: "pills" as const, options: employeeRanges },
    { label: "What's your monthly payroll? (€)", type: "number" as const },
    { label: "Payroll frequency?", type: "pills" as const, options: frequencies },
    { label: "Which day is payday?", type: "pills" as const, options: days },
  ];

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-12">
      <FloatLogo size="large" />

      {/* Progress dots */}
      <div className="mt-6 flex gap-2">
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            className={`h-2 w-2 rounded-full transition-colors ${
              s <= step ? "bg-primary" : "bg-border"
            }`}
          />
        ))}
      </div>

      <div className="mt-12 w-full max-w-md animate-fade-in-up">
        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="text-center space-y-6">
            <h1 className="text-3xl font-bold text-foreground">Welcome to Float.</h1>
            <p className="text-muted-foreground">Your AI CFO is ready. Set up in 60 seconds.</p>
            <Button onClick={() => setStep(2)} size="lg" className="mt-4">
              Get Started →
            </Button>
          </div>
        )}

        {/* Step 2: Business Details */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in-up" key={questionIndex}>
            <h2 className="text-xl font-semibold text-foreground">{questions[questionIndex].label}</h2>
            {questions[questionIndex].type === "text" && (
              <form onSubmit={(e) => { e.preventDefault(); handleBusinessDetailNext(businessName); }}>
                <Input
                  autoFocus
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. The Cobblestone Kitchen"
                />
                <Button type="submit" className="mt-4 w-full" disabled={!businessName}>Continue</Button>
              </form>
            )}
            {questions[questionIndex].type === "number" && (
              <form onSubmit={(e) => { e.preventDefault(); handleBusinessDetailNext(payroll); }}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">€</span>
                  <Input
                    autoFocus
                    type="number"
                    className="pl-7 font-mono"
                    value={payroll}
                    onChange={(e) => setPayroll(e.target.value)}
                    placeholder="8400"
                  />
                </div>
                <Button type="submit" className="mt-4 w-full" disabled={!payroll}>Continue</Button>
              </form>
            )}
            {questions[questionIndex].type === "pills" && (
              <div className="flex flex-wrap gap-2">
                {questions[questionIndex].options?.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleBusinessDetailNext(opt)}
                    className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:border-primary hover:bg-primary/5 transition-colors"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Connect Monzo */}
        {step === 3 && (
          <div className="text-center space-y-6 animate-fade-in-up">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-float-monzo/10">
              <span className="text-3xl font-bold text-float-monzo">M</span>
            </div>
            <h2 className="text-xl font-semibold text-foreground">Connect your Monzo account</h2>
            <div className="space-y-3 text-left">
              {[
                { icon: Eye, text: "Read-only access to your transactions" },
                { icon: Shield, text: "Bank-grade encryption" },
                { icon: Unplug, text: "Disconnect anytime" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Icon size={16} className="text-float-green" />
                  {text}
                </div>
              ))}
            </div>
            <Button onClick={handleConnectMonzo} size="lg" className="w-full bg-float-monzo hover:bg-float-monzo/90 text-primary-foreground">
              Connect Monzo →
            </Button>
            <button onClick={() => { setStep(5); }} className="text-sm text-muted-foreground hover:text-foreground">
              Skip for now
            </button>
          </div>
        )}

        {/* Step 4: Syncing */}
        {step === 4 && (
          <div className="space-y-6 animate-fade-in-up">
            <h2 className="text-xl font-semibold text-foreground text-center">Setting up your dashboard...</h2>
            <div className="space-y-3">
              {syncSteps.map((s, i) => (
                <div key={s} className="flex items-center gap-3 text-sm">
                  {i <= syncIndex ? (
                    <Check size={16} className="text-float-green" />
                  ) : (
                    <Loader2 size={16} className={`text-muted-foreground ${i === syncIndex + 1 ? "animate-spin" : ""}`} />
                  )}
                  <span className={i <= syncIndex ? "text-foreground" : "text-muted-foreground"}>{s}</span>
                </div>
              ))}
            </div>
            {syncIndex >= syncSteps.length - 1 && (
              <Button onClick={() => setStep(5)} className="w-full mt-4">
                Continue →
              </Button>
            )}
          </div>
        )}

        {/* Step 5: Demo Mode */}
        {step === 5 && (
          <div className="space-y-6 animate-fade-in-up">
            <h2 className="text-xl font-semibold text-foreground text-center">You're all set!</h2>
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Use demo data</p>
                  <p className="text-xs text-muted-foreground">Load The Cobblestone Kitchen scenario for testing</p>
                </div>
                <Switch checked={demoMode} onCheckedChange={setDemoMode} />
              </div>
            </div>
            <Button onClick={handleEnterDashboard} size="lg" className="w-full" disabled={loadingDemo}>
              {loadingDemo ? "Loading demo data..." : "Enter Dashboard →"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

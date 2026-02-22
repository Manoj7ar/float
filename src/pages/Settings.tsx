import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, type Account } from "@/hooks/useAccount";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { TopBar } from "@/components/TopBar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Building2, Calendar, CreditCard, Globe, Link2, LogOut, Save, ShieldCheck, Trash2, Unplug, Users } from "lucide-react";
import { formatCurrency, getCurrencySymbol } from "@/lib/format";

const sectors = ["restaurant", "agency", "clinic", "construction", "retail", "other"] as const;
const frequencies = ["weekly", "biweekly", "monthly"] as const;
const days = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
const currencies = ["EUR", "GBP", "USD"] as const;

const frequencyMultipliers: Record<(typeof frequencies)[number], number> = {
  weekly: 52,
  biweekly: 26,
  monthly: 12,
};

type SettingsForm = {
  businessName: string;
  sector: string;
  employeeCount: string;
  payrollAmount: string;
  payrollFrequency: string;
  payrollDay: string;
  currency: string;
};

function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatPayrollInput(value: number | null | undefined) {
  const payroll = (value ?? 0) / 100;
  if (Number.isInteger(payroll)) return String(payroll);
  return payroll.toFixed(2).replace(/\.?0+$/, "");
}

function buildSettingsForm(account: Account | null): SettingsForm {
  return {
    businessName: account?.business_name ?? "",
    sector: account?.sector ?? "restaurant",
    employeeCount: String(account?.employee_count ?? 0),
    payrollAmount: formatPayrollInput(account?.payroll_amount),
    payrollFrequency: account?.payroll_frequency ?? "biweekly",
    payrollDay: account?.payroll_day ?? "friday",
    currency: account?.currency ?? "EUR",
  };
}

function formsMatch(a: SettingsForm, b: SettingsForm) {
  return (
    a.businessName === b.businessName &&
    a.sector === b.sector &&
    a.employeeCount === b.employeeCount &&
    a.payrollAmount === b.payrollAmount &&
    a.payrollFrequency === b.payrollFrequency &&
    a.payrollDay === b.payrollDay &&
    a.currency === b.currency
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { account, updateAccount } = useAccount();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [disconnectingMonzo, setDisconnectingMonzo] = useState(false);

  const [form, setForm] = useState<SettingsForm>(() => buildSettingsForm(account));
  const [savedForm, setSavedForm] = useState<SettingsForm>(() => buildSettingsForm(account));

  useEffect(() => {
    const nextForm = buildSettingsForm(account);
    setForm(nextForm);
    setSavedForm(nextForm);
  }, [account]);

  const parsedEmployeeCount = Number.parseInt(form.employeeCount, 10);
  const safeEmployeeCount = Number.isNaN(parsedEmployeeCount) ? 0 : Math.max(0, parsedEmployeeCount);

  const parsedPayrollAmount = Number.parseFloat(form.payrollAmount);
  const safePayrollAmount = Number.isNaN(parsedPayrollAmount) ? 0 : Math.max(0, parsedPayrollAmount);
  const safePayrollAmountInCents = Math.round(safePayrollAmount * 100);

  const selectedFrequency = frequencies.includes(form.payrollFrequency as (typeof frequencies)[number])
    ? (form.payrollFrequency as (typeof frequencies)[number])
    : "biweekly";
  const annualPayroll = safePayrollAmountInCents * frequencyMultipliers[selectedFrequency];
  const monthlyPayroll = Math.round(annualPayroll / 12);

  const trimmedBusinessName = form.businessName.trim();
  const hasChanges = useMemo(() => !formsMatch(form, savedForm), [form, savedForm]);
  const canSave = trimmedBusinessName.length > 0 && hasChanges && !saving;

  const updateField = <K extends keyof SettingsForm>(field: K, value: SettingsForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!account) return;
    setSaving(true);
    try {
      const nextValues: SettingsForm = {
        ...form,
        businessName: trimmedBusinessName,
        employeeCount: String(safeEmployeeCount),
        payrollAmount: formatPayrollInput(safePayrollAmountInCents),
      };

      const result = await updateAccount({
        business_name: nextValues.businessName,
        sector: nextValues.sector,
        employee_count: safeEmployeeCount,
        payroll_amount: safePayrollAmountInCents,
        payroll_frequency: nextValues.payrollFrequency,
        payroll_day: nextValues.payrollDay,
        currency: nextValues.currency,
      });

      if (!result) {
        throw new Error("Unable to save settings right now.");
      }

      setForm(nextValues);
      setSavedForm(nextValues);
      toast({ title: "Settings saved", description: "Your business details are up to date." });
    } catch {
      toast({
        title: "Could not save settings",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/auth");
    } catch {
      toast({
        title: "Sign out failed",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDisconnectMonzo = async () => {
    setDisconnectingMonzo(true);
    try {
      const result = await updateAccount({
        monzo_connected: false,
        monzo_access_token: null,
        monzo_account_id: null,
      });

      if (!result) {
        throw new Error("Disconnect failed.");
      }

      toast({ title: "Monzo disconnected", description: "Transaction sync has been turned off." });
    } catch {
      toast({
        title: "Could not disconnect Monzo",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDisconnectingMonzo(false);
    }
  };

  return (
    <>
      <TopBar title="Settings" subtitle="Business profile, payroll, and integrations" />

      <div className="mx-auto w-full max-w-6xl space-y-6 p-4 lg:p-6">
        <Card className="animate-fade-in-up border-primary/20 bg-gradient-to-r from-primary/10 via-card to-card" style={{ animationDelay: "40ms" }}>
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">{form.businessName || "Your business profile"}</p>
              <p className="text-xs text-muted-foreground">Signed in as {user?.email ?? "Unknown user"}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={hasChanges ? "border-primary/30 bg-primary/10 text-primary" : "border-float-green/30 bg-float-green/10 text-float-green"}
                >
                  {hasChanges ? "Unsaved changes" : "All changes saved"}
                </Badge>
                <Badge variant="outline" className={account?.monzo_connected ? "border-float-green/30 bg-float-green/10 text-float-green" : "bg-muted text-muted-foreground"}>
                  {account?.monzo_connected ? "Monzo connected" : "Monzo not connected"}
                </Badge>
              </div>
            </div>
            <Button onClick={handleSave} disabled={!canSave} className="sm:min-w-40">
              <Save size={15} />
              {saving ? "Saving..." : hasChanges ? "Save changes" : "Saved"}
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card className="animate-fade-in-up" style={{ animationDelay: "80ms" }}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building2 size={16} className="text-primary" />
                  <CardTitle className="text-base font-semibold">Business details</CardTitle>
                </div>
                <CardDescription>Core information used for your account and reporting.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="business-name">Business name</Label>
                  <Input
                    id="business-name"
                    value={form.businessName}
                    onChange={(e) => updateField("businessName", e.target.value)}
                    placeholder="The Cobblestone Kitchen"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Sector</Label>
                    <Select value={form.sector} onValueChange={(value) => updateField("sector", value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sectors.map((item) => (
                          <SelectItem key={item} value={item}>
                            {toTitleCase(item)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1">
                      <Users size={12} />
                      Employees
                    </Label>
                    <Input
                      inputMode="numeric"
                      type="number"
                      min={0}
                      value={form.employeeCount}
                      onChange={(e) => updateField("employeeCount", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1">
                      <Globe size={12} />
                      Currency
                    </Label>
                    <Select value={form.currency} onValueChange={(value) => updateField("currency", value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item} ({getCurrencySymbol(item)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="animate-fade-in-up" style={{ animationDelay: "130ms" }}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CreditCard size={16} className="text-primary" />
                  <CardTitle className="text-base font-semibold">Payroll configuration</CardTitle>
                </div>
                <CardDescription>
                  Current payroll: {formatCurrency(account?.payroll_amount ?? 0, account?.currency)} - {toTitleCase(account?.payroll_frequency ?? "biweekly")} - {toTitleCase(account?.payroll_day ?? "friday")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="payroll-amount">Payroll amount</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-mono text-muted-foreground">
                      {getCurrencySymbol(form.currency)}
                    </span>
                    <Input
                      id="payroll-amount"
                      className="pl-8 font-mono tabular-nums"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      type="number"
                      value={form.payrollAmount}
                      onChange={(e) => updateField("payrollAmount", e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1">
                      <Calendar size={12} />
                      Frequency
                    </Label>
                    <Select value={form.payrollFrequency} onValueChange={(value) => updateField("payrollFrequency", value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {frequencies.map((item) => (
                          <SelectItem key={item} value={item}>
                            {toTitleCase(item)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Payday</Label>
                    <Select value={form.payrollDay} onValueChange={(value) => updateField("payrollDay", value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {days.map((item) => (
                          <SelectItem key={item} value={item}>
                            {toTitleCase(item)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                  <p className="text-xs font-medium text-muted-foreground">Payroll preview</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <p className="text-sm text-foreground">
                      Monthly estimate: <span className="font-semibold">{formatCurrency(monthlyPayroll, form.currency)}</span>
                    </p>
                    <p className="text-sm text-foreground">
                      Annual run rate: <span className="font-semibold">{formatCurrency(annualPayroll, form.currency)}</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="animate-fade-in-up" style={{ animationDelay: "180ms" }}>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Profile summary</CardTitle>
                <CardDescription>Quick view of the details currently in this form.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Business</span>
                  <span className="max-w-[65%] text-right font-medium text-foreground">{trimmedBusinessName || "-"}</span>
                </div>
                <Separator />
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Sector</span>
                  <span className="font-medium text-foreground">{toTitleCase(form.sector)}</span>
                </div>
                <Separator />
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Employees</span>
                  <span className="font-medium text-foreground tabular-nums">{safeEmployeeCount}</span>
                </div>
                <Separator />
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Payroll</span>
                  <span className="font-medium text-foreground">{formatCurrency(safePayrollAmountInCents, form.currency)}</span>
                </div>
                <Separator />
                <div className="flex items-start justify-between gap-3">
                  <span className="text-muted-foreground">Schedule</span>
                  <span className="text-right font-medium text-foreground">
                    {toTitleCase(form.payrollFrequency)} on {toTitleCase(form.payrollDay)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="animate-fade-in-up" style={{ animationDelay: "220ms" }}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-float-monzo/10">
                      <span className="text-sm font-bold text-float-monzo">M</span>
                    </div>
                    <CardTitle className="text-base font-semibold">Monzo connection</CardTitle>
                  </div>
                  <Badge variant="outline" className={account?.monzo_connected ? "border-float-green/30 bg-float-green/10 text-float-green" : "bg-muted text-muted-foreground"}>
                    {account?.monzo_connected ? "Connected" : "Not connected"}
                  </Badge>
                </div>
                <CardDescription>
                  Secure transaction sync with read-only account access.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-float-green" />
                    Bank-grade encryption with no payment write access.
                  </div>
                </div>
                {account?.monzo_connected ? (
                  <Button
                    variant="outline"
                    onClick={handleDisconnectMonzo}
                    disabled={disconnectingMonzo}
                    className="w-full text-float-red hover:text-float-red"
                  >
                    <Unplug size={14} />
                    {disconnectingMonzo ? "Disconnecting..." : "Disconnect Monzo"}
                  </Button>
                ) : (
                  <Button
                    className="w-full bg-float-monzo text-primary-foreground hover:bg-float-monzo/90"
                    onClick={() =>
                      toast({
                        title: "Monzo setup",
                        description: "Connect Monzo from onboarding while the direct flow is being finalized.",
                      })
                    }
                  >
                    <Link2 size={14} />
                    Connect Monzo
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="animate-fade-in-up border-destructive/25" style={{ animationDelay: "260ms" }}>
              <CardHeader>
                <CardTitle className="text-base font-semibold text-destructive">Danger zone</CardTitle>
                <CardDescription>High-impact account actions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Sign out</p>
                    <p className="text-xs text-muted-foreground">End your current session on this device.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleSignOut}>
                    <LogOut size={14} />
                    Sign out
                  </Button>
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Delete account</p>
                    <p className="text-xs text-muted-foreground">Permanent and irreversible. Contact support to proceed.</p>
                  </div>
                  <Button variant="destructive" size="sm" disabled>
                    <Trash2 size={14} />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <p className="pb-8 text-center text-xs text-muted-foreground">
          Signed in as {user?.email}
        </p>
      </div>
    </>
  );
}

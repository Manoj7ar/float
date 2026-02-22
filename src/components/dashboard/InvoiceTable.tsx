import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { formatCurrency, daysOverdue, getInvoiceStatusColor } from "@/lib/format";
import {
  Phone,
  CreditCard,
  Check,
  FileText,
  Plus,
  Pencil,
  Save,
  Download,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { InvoiceUploadDialog } from "./InvoiceUploadDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Invoice = Tables<"invoices">;

interface InvoiceTableProps {
  invoices: Invoice[];
  onChase: () => void;
  onRefresh?: () => void;
  payrollAtRisk: boolean;
}

export function InvoiceTable({ invoices, onChase, onRefresh, payrollAtRisk }: InvoiceTableProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPhone, setEditPhone] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const sorted = useMemo(() => {
    return [...invoices].sort((a, b) => {
      const order: Record<string, number> = { overdue: 0, chasing: 1, unpaid: 2, upcoming: 3, paid: 4 };
      return (order[a.status ?? "unpaid"] ?? 2) - (order[b.status ?? "unpaid"] ?? 2);
    });
  }, [invoices]);

  const totals = useMemo(() => {
    const open = sorted.filter((inv) => inv.status !== "paid");
    const overdue = sorted.filter((inv) => inv.status === "overdue");
    return {
      openCount: open.length,
      overdueCount: overdue.length,
      outstanding: open.reduce((sum, inv) => sum + inv.amount, 0),
      overdueAmount: overdue.reduce((sum, inv) => sum + inv.amount, 0),
    };
  }, [sorted]);

  const startEdit = (inv: Invoice) => {
    setEditingId(inv.id);
    setEditPhone(inv.client_phone ?? "");
  };

  const savePhone = async (id: string) => {
    const { error } = await supabase
      .from("invoices")
      .update({ client_phone: editPhone.trim() })
      .eq("id", id);

    if (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to save phone number" });
    } else {
      toast({ title: "Saved", description: "Phone number updated" });
      onRefresh?.();
    }

    setEditingId(null);
  };

  const handleChase = (inv: Invoice) => {
    if (!inv.client_phone) {
      toast({
        variant: "destructive",
        title: "No phone number",
        description: "Add a phone number first by clicking the pencil icon",
      });
      return;
    }

    const isResolver = inv.invoice_number === "INV-047" && payrollAtRisk;
    if (isResolver) {
      onChase();
      return;
    }

    navigate("/calls", { state: { autoCallInvoice: inv } });
  };

  const handleDownloadPdf = async (inv: Invoice) => {
    setDownloadingId(inv.id);

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-invoice-pdf`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ invoice_id: inv.id, account_id: inv.account_id }),
      });

      if (!resp.ok) throw new Error("Failed to generate invoice");
      const html = await resp.text();
      const blob = new Blob([html], { type: "text/html" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${inv.invoice_number || "invoice"}.html`;
      a.click();
      URL.revokeObjectURL(a.href);

      toast({
        title: "Invoice downloaded",
        description: "Open the HTML file and use Print -> Save as PDF",
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Card className="flex flex-col overflow-hidden border-border/60 bg-gradient-to-b from-card via-card to-accent/15 shadow-sm">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/70 bg-background/70">
              <FileText size={14} className="text-muted-foreground" />
            </div>
            <CardTitle className="text-sm font-semibold">Invoices</CardTitle>
          </div>

          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 border-border/70 bg-background/70 text-xs"
              onClick={() => setUploadOpen(true)}
            >
              <FileText size={12} className="mr-1" /> Upload
            </Button>
            <Button size="sm" className="h-7 text-xs">
              <Plus size={12} className="mr-1" /> Add
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {totals.openCount} open
          </span>
          <span className="inline-flex items-center rounded-full border border-float-red/20 bg-float-red/10 px-2 py-0.5 text-[10px] font-semibold text-float-red">
            {totals.overdueCount} overdue
          </span>
          <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {formatCurrency(totals.outstanding)} outstanding
          </span>
          {payrollAtRisk && (
            <span className="inline-flex items-center gap-1 rounded-full border border-float-amber/20 bg-float-amber/10 px-2 py-0.5 text-[10px] font-semibold text-float-amber">
              <AlertTriangle size={10} />
              Payroll at risk
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 pt-0">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-background/40 py-12 text-center">
            <FileText className="mb-2 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No invoices yet</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Add invoices or load demo data</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/60">
            <Table>
              <TableHeader className="[&_tr]:border-border/70 bg-background/70">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10 text-[10px] uppercase tracking-[0.12em]">Client</TableHead>
                  <TableHead className="h-10 text-[10px] uppercase tracking-[0.12em]">Phone</TableHead>
                  <TableHead className="h-10 text-right text-[10px] uppercase tracking-[0.12em]">Amount</TableHead>
                  <TableHead className="h-10 text-[10px] uppercase tracking-[0.12em]">Due</TableHead>
                  <TableHead className="h-10 text-[10px] uppercase tracking-[0.12em]">Status</TableHead>
                  <TableHead className="h-10 text-right text-[10px] uppercase tracking-[0.12em]">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="[&_tr]:border-border/60">
                {sorted.map((inv) => {
                  const overdueDays = inv.due_date ? daysOverdue(inv.due_date) : 0;
                  const isResolver = inv.invoice_number === "INV-047" && payrollAtRisk;
                  const isEditing = editingId === inv.id;

                  return (
                    <TableRow
                      key={inv.id}
                      className={`group ${isResolver ? "bg-float-red/[0.03] hover:bg-float-red/[0.05]" : "hover:bg-background/80"}`}
                    >
                      <TableCell className="py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{inv.client_name}</p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {inv.invoice_number}
                            {isResolver && (
                              <span className="ml-1 inline-flex items-center gap-1 font-medium text-float-red">
                                <Sparkles size={9} />
                                Resolves payroll risk
                              </span>
                            )}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell className="py-3">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editPhone}
                              onChange={(e) => setEditPhone(e.target.value)}
                              placeholder="+44..."
                              className="h-7 w-28 text-xs"
                              onKeyDown={(e) => e.key === "Enter" && savePhone(inv.id)}
                              autoFocus
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => savePhone(inv.id)}
                            >
                              <Save size={12} />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">
                              {inv.client_phone || "-"}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                              onClick={() => startEdit(inv)}
                            >
                              <Pencil size={10} />
                            </Button>
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="py-3 text-right font-mono text-sm font-semibold tabular-nums">
                        {formatCurrency(inv.amount)}
                      </TableCell>

                      <TableCell className="py-3">
                        <span className="text-xs text-muted-foreground">
                          {inv.due_date ? format(new Date(inv.due_date), "MMM d") : "-"}
                        </span>
                        {overdueDays > 0 && inv.status === "overdue" && (
                          <span className="ml-1 text-[10px] font-medium text-float-red">+{overdueDays}d</span>
                        )}
                      </TableCell>

                      <TableCell className="py-3">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] font-medium ${getInvoiceStatusColor(inv.status ?? "unpaid", inv.due_date)}`}
                        >
                          {inv.status === "paid" && <Check size={9} className="mr-0.5" />}
                          {(inv.status ?? "unpaid").charAt(0).toUpperCase() + (inv.status ?? "unpaid").slice(1)}
                        </Badge>
                      </TableCell>

                      <TableCell className="py-3 text-right">
                        <div className="flex justify-end gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                          {inv.status === "overdue" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[10px] text-float-red"
                              onClick={() => handleChase(inv)}
                            >
                              <Phone size={11} className="mr-0.5" /> Chase
                            </Button>
                          )}
                          {inv.status !== "paid" && (
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] text-primary">
                              <CreditCard size={11} className="mr-0.5" /> Link
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[10px] text-muted-foreground"
                            onClick={() => handleDownloadPdf(inv)}
                            disabled={downloadingId === inv.id}
                          >
                            <Download size={11} className="mr-0.5" /> PDF
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {totals.overdueAmount > 0 && (
              <div className="flex items-center justify-between border-t border-border/70 bg-background/70 px-4 py-2">
                <p className="text-[10px] text-muted-foreground">
                  Overdue exposure that can be recovered this cycle
                </p>
                <p className="font-mono text-xs font-semibold text-float-red tabular-nums">
                  {formatCurrency(totals.overdueAmount)}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <InvoiceUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={() => onRefresh?.()}
      />
    </Card>
  );
}

import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface InvoiceUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: () => void;
}

export function InvoiceUploadDialog({ open, onOpenChange, onUploaded }: InvoiceUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setStatus("uploading");
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-invoice`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Upload failed");

      setResult(data);
      setStatus("success");
      onUploaded();
    } catch (e: any) {
      setErrorMsg(e.message || "Upload failed");
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null);
    setStatus("idle");
    setResult(null);
    setErrorMsg("");
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Upload Invoice</DialogTitle>
          <DialogDescription className="text-xs">
            Upload a PDF or image — AI will extract the invoice details automatically.
          </DialogDescription>
        </DialogHeader>

        {status === "idle" && (
          <div className="space-y-4">
            <button
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-accent/30 p-8 transition-colors hover:border-primary/30 hover:bg-accent/50"
            >
              {file ? (
                <>
                  <FileText size={28} className="text-primary" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                  </div>
                </>
              ) : (
                <>
                  <Upload size={28} className="text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">Drop invoice here or click to browse</p>
                    <p className="text-xs text-muted-foreground">PDF, PNG, JPG supported</p>
                  </div>
                </>
              )}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button onClick={handleUpload} disabled={!file} className="w-full">
              <Upload size={14} className="mr-2" /> Extract with AI
            </Button>
          </div>
        )}

        {status === "uploading" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">AI is reading your invoice…</p>
            <p className="text-xs text-muted-foreground">Extracting client, amount, dates</p>
          </div>
        )}

        {status === "success" && result && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 py-4">
              <CheckCircle size={32} className="text-float-green" />
              <p className="text-sm font-semibold text-foreground">Invoice Created</p>
            </div>
            <div className="rounded-xl border border-border bg-accent/30 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Client</span>
                <span className="font-medium">{result.extracted?.client_name || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice #</span>
                <span className="font-mono text-xs">{result.extracted?.invoice_number || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-mono font-semibold">{formatCurrency(result.extracted?.amount || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date</span>
                <span>{result.extracted?.due_date || "—"}</span>
              </div>
            </div>
            <Button onClick={() => handleClose(false)} className="w-full">
              Done
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 py-4">
              <AlertCircle size={32} className="text-float-red" />
              <p className="text-sm font-semibold text-foreground">Extraction Failed</p>
              <p className="text-xs text-muted-foreground text-center">{errorMsg}</p>
            </div>
            <Button variant="outline" onClick={reset} className="w-full">
              Try Again
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

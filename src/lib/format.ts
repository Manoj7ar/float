const CURRENCY_CONFIG: Record<string, { symbol: string; locale: string; code: string }> = {
  EUR: { symbol: "€", locale: "en-IE", code: "EUR" },
  GBP: { symbol: "£", locale: "en-GB", code: "GBP" },
  USD: { symbol: "$", locale: "en-US", code: "USD" },
};

function getCurrencyConfig(currency?: string) {
  return CURRENCY_CONFIG[currency || "EUR"] || CURRENCY_CONFIG.EUR;
}

export function formatCurrency(pence: number, currency?: string): string {
  const config = getCurrencyConfig(currency);
  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: config.code,
  }).format(pence / 100);
}

export function formatCurrencyShort(pence: number, currency?: string): string {
  const config = getCurrencyConfig(currency);
  const value = pence / 100;
  if (value >= 1000) {
    return `${config.symbol}${(value / 1000).toFixed(1)}k`;
  }
  return `${config.symbol}${value.toFixed(0)}`;
}

export function getCurrencySymbol(currency?: string): string {
  return getCurrencyConfig(currency).symbol;
}

export function daysOverdue(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export function getInvoiceStatusColor(status: string, dueDate?: string | null): string {
  if (status === "paid") return "text-float-green bg-float-green/10";
  if (status === "chasing") return "text-float-amber bg-float-amber/10";
  if (status === "overdue") {
    const days = dueDate ? daysOverdue(dueDate) : 0;
    return days > 14
      ? "text-float-red bg-float-red/10"
      : "text-float-amber bg-float-amber/10";
  }
  if (status === "unpaid") return "text-primary bg-primary/10";
  return "text-muted-foreground bg-muted";
}

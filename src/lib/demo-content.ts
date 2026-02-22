import { addDays, format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Invoice = Tables<"invoices">;
type Insight = Tables<"ai_insights">;
type Projection = Tables<"cashflow_projections">;
type Incident = Tables<"incidents">;
type Call = Tables<"calls">;
type ChatMessage = Tables<"chat_messages">;

const DEMO_TODAY = new Date("2026-02-21T12:00:00Z");

export function isDemoId(id: string | null | undefined) {
  return typeof id === "string" && id.startsWith("demo-");
}

export function getDemoInvoices(accountId: string): Invoice[] {
  return [
    {
      id: "demo-inv-047",
      account_id: accountId,
      client_name: "TechCorp Dublin",
      client_phone: "+35312345678",
      client_email: "accounts@techcorp.ie",
      invoice_number: "INV-047",
      amount: 240000,
      invoice_date: "2026-01-28",
      due_date: "2026-02-11",
      status: "overdue",
      created_at: "2026-01-28T10:00:00Z",
      paid_at: null,
      stripe_payment_intent_id: null,
      stripe_payment_link: null,
    },
    {
      id: "demo-inv-051",
      account_id: accountId,
      client_name: "EventsPro Ireland",
      client_phone: "+35319876543",
      client_email: "finance@eventspro.ie",
      invoice_number: "INV-051",
      amount: 180000,
      invoice_date: "2026-02-05",
      due_date: "2026-02-19",
      status: "overdue",
      created_at: "2026-02-05T10:00:00Z",
      paid_at: null,
      stripe_payment_intent_id: null,
      stripe_payment_link: null,
    },
    {
      id: "demo-inv-053",
      account_id: accountId,
      client_name: "Studio North",
      client_phone: "+35315443322",
      client_email: "ops@studionorth.ie",
      invoice_number: "INV-053",
      amount: 125000,
      invoice_date: "2026-02-09",
      due_date: "2026-02-24",
      status: "unpaid",
      created_at: "2026-02-09T10:00:00Z",
      paid_at: null,
      stripe_payment_intent_id: null,
      stripe_payment_link: null,
    },
    {
      id: "demo-inv-044",
      account_id: accountId,
      client_name: "Harbor Ventures",
      client_phone: "+35316677889",
      client_email: "payables@harborventures.ie",
      invoice_number: "INV-044",
      amount: 98000,
      invoice_date: "2026-01-20",
      due_date: "2026-02-03",
      status: "paid",
      created_at: "2026-01-20T10:00:00Z",
      paid_at: "2026-02-06T14:12:00Z",
      stripe_payment_intent_id: null,
      stripe_payment_link: null,
    },
  ];
}

export function getDemoInsights(accountId: string): Insight[] {
  return [
    {
      id: "demo-insight-1",
      account_id: accountId,
      type: "critical",
      title: "Payroll at risk - EUR 2,200 shortfall",
      message:
        "Friday payroll is EUR 8,400 and projected cash is EUR 6,200. Collecting INV-047 today covers the gap.",
      action_label: "Fix it now",
      action_type: "fix_it",
      dismissed: false,
      created_at: "2026-02-21T09:30:00Z",
    },
    {
      id: "demo-insight-2",
      account_id: accountId,
      type: "warning",
      title: "Thursday cost pressure",
      message:
        "Supplier payments and utilities cluster on Thursday. Keep at least EUR 950 buffer by Wednesday night.",
      action_label: null,
      action_type: null,
      dismissed: false,
      created_at: "2026-02-21T09:45:00Z",
    },
    {
      id: "demo-insight-3",
      account_id: accountId,
      type: "info",
      title: "Late payment pattern detected",
      message:
        "TechCorp has paid 3 of the last 4 invoices late, with an average delay of 12 days.",
      action_label: null,
      action_type: null,
      dismissed: false,
      created_at: "2026-02-21T10:15:00Z",
    },
    {
      id: "demo-insight-4",
      account_id: accountId,
      type: "opportunity",
      title: "Friday revenue remains strongest",
      message:
        "Friday intake is running about 34% above your weekday average. Plan recovery calls before noon Friday.",
      action_label: null,
      action_type: null,
      dismissed: false,
      created_at: "2026-02-21T10:40:00Z",
    },
  ];
}

export function getDemoProjections(accountId: string): Projection[] {
  const startBalance = 620000;
  const values: Projection[] = [];
  let running = startBalance;

  for (let i = 0; i <= 30; i += 1) {
    const date = addDays(DEMO_TODAY, i);
    const day = date.getDay();

    if (day === 5 || day === 6) running += 165000;
    else if (day !== 0) running += 55000;

    if (day === 1) running -= 45000;
    if (day === 3) running -= 28000;
    if (format(date, "yyyy-MM-dd") === "2026-02-27") running -= 840000;
    if (date.getDate() === 1) running -= 320000;

    values.push({
      id: `demo-proj-${format(date, "yyyyMMdd")}`,
      account_id: accountId,
      projection_date: format(date, "yyyy-MM-dd"),
      projected_balance: running,
      is_below_payroll_threshold: running < 840000,
      is_below_zero: running < 0,
    });
  }

  return values;
}

export function getDemoIncidents(accountId: string): Incident[] {
  return [
    {
      id: "demo-incident-payroll",
      account_id: accountId,
      severity: "P1",
      title: "Payroll shortfall before Friday run",
      description:
        "Projected cash before payroll is EUR 6,200 against EUR 8,400 required.",
      status: "open",
      shortfall_amount: 220000,
      opened_at: "2026-02-21T10:00:00Z",
      closed_at: null,
      events: [
        {
          type: "DETECTED",
          timestamp: "2026-02-21T10:00:00Z",
          message: "Shortfall of EUR 2,200 detected for next payroll.",
        },
        {
          type: "STRATEGY_COMPUTED",
          timestamp: "2026-02-21T10:01:00Z",
          message: "Collecting INV-047 is the fastest path to full payroll coverage.",
        },
      ],
    },
    {
      id: "demo-incident-card-outage",
      account_id: accountId,
      severity: "P2",
      title: "Card terminal outage recovered",
      description:
        "A payment gateway outage reduced lunchtime revenue for 47 minutes.",
      status: "resolved",
      shortfall_amount: 62000,
      opened_at: "2026-02-14T11:19:00Z",
      closed_at: "2026-02-14T13:02:00Z",
      events: [
        {
          type: "DETECTED",
          timestamp: "2026-02-14T11:19:00Z",
          message: "Drop in card acceptance rate detected.",
        },
        {
          type: "CALL_COMPLETED",
          timestamp: "2026-02-14T11:41:00Z",
          message: "Provider support confirmed fix window and reroute steps.",
        },
        {
          type: "RESOLVED",
          timestamp: "2026-02-14T13:02:00Z",
          message: "Terminal traffic fully restored and backlog processed.",
        },
      ],
    },
  ];
}

export function getDemoCalls(accountId: string): Call[] {
  return [
    {
      id: "demo-call-1",
      account_id: accountId,
      invoice_id: "demo-inv-044",
      client_name: "Harbor Ventures",
      client_phone: "+35316677889",
      status: "completed",
      initiated_at: "2026-02-06T10:02:00Z",
      completed_at: "2026-02-06T10:07:22Z",
      duration_seconds: 322,
      outcome: "Client requested updated invoice copy and paid same day.",
      transcript:
        "Assistant confirmed invoice details, sent payment link, and received verbal commitment for same-day payment.",
    },
    {
      id: "demo-call-2",
      account_id: accountId,
      invoice_id: "demo-inv-051",
      client_name: "EventsPro Ireland",
      client_phone: "+35319876543",
      status: "failed",
      initiated_at: "2026-02-20T09:18:00Z",
      completed_at: "2026-02-20T09:18:32Z",
      duration_seconds: 32,
      outcome: "No answer after two retry attempts.",
      transcript: "Call dropped to voicemail and no callback was received.",
    },
    {
      id: "demo-call-3",
      account_id: accountId,
      invoice_id: "demo-inv-047",
      client_name: "TechCorp Dublin",
      client_phone: "+35312345678",
      status: "in-progress",
      initiated_at: "2026-02-21T10:08:00Z",
      completed_at: null,
      duration_seconds: null,
      outcome: null,
      transcript: null,
    },
  ];
}

export function getDemoChatMessages(accountId: string): ChatMessage[] {
  return [
    {
      id: "demo-chat-1",
      account_id: accountId,
      role: "assistant",
      content:
        "Welcome back. I loaded a demo scenario so you can explore cashflow, calls, and incident workflows.",
      created_at: "2026-02-21T09:00:00Z",
    },
    {
      id: "demo-chat-2",
      account_id: accountId,
      role: "user",
      content: "What is my biggest risk this week?",
      created_at: "2026-02-21T09:00:18Z",
    },
    {
      id: "demo-chat-3",
      account_id: accountId,
      role: "assistant",
      content:
        "Payroll on Friday is the key risk. You are short by about EUR 2,200 unless INV-047 is collected.",
      created_at: "2026-02-21T09:00:42Z",
    },
  ];
}


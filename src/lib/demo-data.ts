import { supabase } from "@/integrations/supabase/client";
import { addDays, subDays, format } from "date-fns";

export async function loadDemoData(accountId: string) {
  const today = new Date("2026-02-21");

  // Update account to demo scenario
  await supabase.from("accounts").update({
    business_name: "The Cobblestone Kitchen",
    sector: "restaurant",
    employee_count: 8,
    payroll_amount: 840000,
    payroll_frequency: "biweekly",
    payroll_day: "friday",
    monzo_connected: true,
    risk_level: "critical",
    payroll_at_risk: true,
  }).eq("id", accountId);

  // Invoices
  await supabase.from("invoices").insert([
    {
      account_id: accountId,
      client_name: "TechCorp Dublin",
      client_phone: "+35312345678",
      client_email: "accounts@techcorp.ie",
      invoice_number: "INV-047",
      amount: 240000,
      invoice_date: "2026-01-28",
      due_date: "2026-02-11",
      status: "overdue",
    },
    {
      account_id: accountId,
      client_name: "EventsPro Ireland",
      client_phone: "+35319876543",
      invoice_number: "INV-051",
      amount: 180000,
      invoice_date: "2026-02-05",
      due_date: "2026-02-19",
      status: "overdue",
    },
  ]);

  // AI Insights
  await supabase.from("ai_insights").insert([
    {
      account_id: accountId,
      type: "critical",
      title: "Payroll at Risk — €2,200 Shortfall",
      message: "Your next payroll of €8,400 is due Friday Feb 27. Your balance of €6,200 leaves a €2,200 shortfall. TechCorp Dublin owes €2,400 on INV-047 — collecting this today resolves the crisis.",
      action_label: "Fix It Now",
      action_type: "fix_it",
    },
    {
      account_id: accountId,
      type: "warning",
      title: "Thursday Cost Pressure",
      message: "Your produce delivery (€450) and dry goods invoice (€280) both land Thursday — the same day your balance is at its lowest before payroll.",
    },
    {
      account_id: accountId,
      type: "info",
      title: "TechCorp Dublin Payment Pattern",
      message: "TechCorp Dublin has been late on 3 of their last 4 invoices. Average delay: 12 days past due date.",
    },
    {
      account_id: accountId,
      type: "opportunity",
      title: "Friday Revenue Strength",
      message: "Your Friday revenue averages €3,840 — 34% above your daily average. Tuesday is your weakest day at €1,920.",
    },
  ]);

  // Incident
  await supabase.from("incidents").insert({
    account_id: accountId,
    severity: "P1",
    title: "Payroll Crisis — €2,200 Shortfall",
    description: "Next payroll of €8,400 due Friday Feb 27. Current balance €6,200 creates €2,200 shortfall.",
    status: "open",
    shortfall_amount: 220000,
    events: [
      { type: "DETECTED", timestamp: "2026-02-21T10:00:00Z", message: "Payroll shortfall of €2,200 detected" },
      { type: "STRATEGY_COMPUTED", timestamp: "2026-02-21T10:01:00Z", message: "Collecting INV-047 (€2,400) from TechCorp Dublin resolves crisis" },
    ],
  });

  // Generate 90 days of transactions
  const transactions = [];
  for (let i = 90; i >= 0; i--) {
    const date = subDays(today, i);
    const dayOfWeek = date.getDay();
    const dayStr = format(date, "yyyy-MM-dd");
    const dayOfMonth = date.getDate();

    // Skip Sundays
    if (dayOfWeek === 0) continue;

    // Daily card income
    let income = 0;
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      income = 320000 + Math.floor(Math.random() * 90000); // €3200-€4100
    } else {
      income = 180000 + Math.floor(Math.random() * 60000); // €1800-€2400
    }

    transactions.push({
      id: `txn-income-${dayStr}`,
      account_id: accountId,
      amount: income,
      merchant_name: "Card Terminal",
      category: "income",
      description: "Daily card revenue",
      is_income: true,
      created: `${dayStr}T18:00:00Z`,
    });

    // Weekly produce on Monday
    if (dayOfWeek === 1) {
      transactions.push({
        id: `txn-produce-${dayStr}`,
        account_id: accountId,
        amount: -45000,
        merchant_name: "Fresh Produce Supplies",
        category: "supplies",
        description: "Weekly produce delivery",
        is_income: false,
        created: `${dayStr}T08:00:00Z`,
      });
    }

    // Weekly dry goods on Wednesday
    if (dayOfWeek === 3) {
      transactions.push({
        id: `txn-drygoods-${dayStr}`,
        account_id: accountId,
        amount: -28000,
        merchant_name: "Dry Goods Wholesale",
        category: "supplies",
        description: "Weekly dry goods",
        is_income: false,
        created: `${dayStr}T09:00:00Z`,
      });
    }

    // Rent on 1st
    if (dayOfMonth === 1) {
      transactions.push({
        id: `txn-rent-${dayStr}`,
        account_id: accountId,
        amount: -320000,
        merchant_name: "Dublin Property Management",
        category: "rent",
        description: "Monthly rent",
        is_income: false,
        created: `${dayStr}T07:00:00Z`,
      });
    }

    // Biweekly payroll on alternating Fridays
    if (dayOfWeek === 5) {
      const weekNum = Math.floor(i / 7);
      if (weekNum % 2 === 0) {
        transactions.push({
          id: `txn-payroll-${dayStr}`,
          account_id: accountId,
          amount: -840000,
          merchant_name: "Payroll",
          category: "payroll",
          description: "Staff payroll - 8 employees",
          is_income: false,
          created: `${dayStr}T06:00:00Z`,
        });
      }
    }

    // Monthly utilities on 15th
    if (dayOfMonth === 15) {
      transactions.push({
        id: `txn-utilities-${dayStr}`,
        account_id: accountId,
        amount: -38000,
        merchant_name: "Electric Ireland",
        category: "utilities",
        description: "Monthly utilities",
        is_income: false,
        created: `${dayStr}T10:00:00Z`,
      });
    }
  }

  // Insert transactions in batches
  for (let i = 0; i < transactions.length; i += 50) {
    await supabase.from("transactions").insert(transactions.slice(i, i + 50));
  }

  // 30-day cashflow projection
  const projections = [];
  let balance = 620000;
  for (let i = 0; i <= 30; i++) {
    const date = addDays(today, i);
    const dayOfWeek = date.getDay();
    const dayOfMonth = date.getDate();

    if (dayOfWeek !== 0) {
      // Income
      if (dayOfWeek === 5 || dayOfWeek === 6) {
        balance += 360000;
      } else {
        balance += 210000;
      }

      // Expenses
      if (dayOfWeek === 1) balance -= 45000;
      if (dayOfWeek === 3) balance -= 28000;
      if (dayOfMonth === 1) balance -= 320000;
      if (dayOfMonth === 15) balance -= 38000;

      // Payroll on Feb 27
      if (format(date, "yyyy-MM-dd") === "2026-02-27") {
        balance -= 840000;
      }
    }

    projections.push({
      account_id: accountId,
      projection_date: format(date, "yyyy-MM-dd"),
      projected_balance: balance,
      is_below_payroll_threshold: balance < 840000,
      is_below_zero: balance < 0,
    });
  }

  await supabase.from("cashflow_projections").insert(projections);
}

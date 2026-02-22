# Susquehanna: Best Use of Data (Hackathon Submission Notes)

## Core data thesis

Float is a data-driven AI CFO for small businesses. The product value comes from combining multiple operational and financial datasets into one decision layer:

- transactions
- invoices
- cashflow projections
- calls
- incidents
- AI insights
- account settings (payroll amount, business profile, currency)

The result is a system that does more than display data: it transforms data into action and recommendations.

## What "Best Use of Data" looks like in Float

### 1. Unified operational + finance data model

Float uses Supabase/Postgres as the central source of truth, with typed access in the frontend (`src/integrations/supabase/types.ts`).

This allows the app to connect:

- money movement (`transactions`)
- receivables (`invoices`)
- operational disruptions (`incidents`)
- outreach activity (`calls`)
- derived AI insights (`ai_insights`)

That cross-domain data model is what enables the AI CFO behavior.

### 2. Real-time product behavior from live data

Supabase Realtime is used across major workflows (documented in README and visible in page code):

- Dashboard updates (invoices / insights / incidents)
- Calls page updates
- Incidents page updates

This means the app reacts to operational changes without refreshes, which is important for collections and incident handling demos.

### 3. Data -> analytics -> AI outputs

Float computes and packages business context before calling AI:

- `weekly-digest` aggregates:
  - weekly income/expenses
  - overdue invoices
  - paid invoices
  - new incidents
  - spending by category
- `smart-chase` builds invoice summaries for chase prioritization
- `analyze-anomalies` uses transaction data for anomaly detection
- `/chat` injects incident and call history learnings into Claude context

This is strong data usage because the model gets structured, domain-relevant signals rather than raw records.

## Concrete data-driven features in the product

- Dashboard KPI cards + cashflow forecast (`/dashboard`)
- Cashflow drilldown and payroll threshold risk visualization
- Invoice sorting, status tracking, and payment workflows
- Calls queue prioritized around overdue invoices
- Incidents page with event timelines and learning summaries
- AI chat that references prior incidents and call outcomes
- Weekly digest generation from aggregated financial/activity data

## Data quality and demo readiness

Float includes a smart demo fallback strategy so judges can see data-heavy workflows even without production credentials:

- demo invoices
- demo calls
- demo incidents
- demo chat context and scenarios

This is a strong hackathon move because it preserves the "data product" experience under imperfect integration conditions.

## Why this fits Susquehanna's "Best Use of Data"

- Data is central to product behavior, not just reporting.
- Multiple datasets are fused into a single decisioning layer.
- AI outputs are grounded in business context and historical events.
- The system supports real-time updates and operational actions.
- Data powers revenue recovery (calls + Stripe), risk visibility (incidents), and CFO advice (Claude).

## Judge demo script (data-focused)

1. Show `/dashboard` KPIs + cashflow forecast and explain payroll threshold logic.
2. Show `/incidents` and highlight event-based learning + aggregated insights.
3. Show `/chat` and ask a question that benefits from incident/call history context.
4. Show `/calls` and explain how invoice/call/payment data links together.
5. Mention `weekly-digest` / anomaly analysis as data-to-AI pipelines in Supabase functions.

## Tech implementation highlights supporting the data story

- Supabase Postgres + typed models
- Supabase Realtime subscriptions
- Supabase Edge Functions for data aggregation and AI orchestration
- schema support for invoice Stripe fields + incident event histories
- structured JSON outputs from Claude-backed functions


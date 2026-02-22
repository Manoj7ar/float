<p align="center">
  <img src="ChatGPT%20Image%20Feb%2020,%202026,%2005_14_43%20PM.png" alt="Float logo" width="180" />
</p>

<h1 align="center">Float - AI CFO for Small Businesses</h1>

<p align="center">
  Hackathon-ready fintech operations platform for cashflow visibility, AI analysis, invoice collection, and voice call automation.
</p>

---

## What This Is

Float is a full-stack AI CFO app built for small businesses that need help with:

- cashflow forecasting
- payroll risk awareness
- overdue invoice collections
- incident tracking + AI learnings
- conversational finance support

It combines a React frontend with Supabase (Auth, Postgres, Realtime, Edge Functions) and an AI + voice automation stack (Claude, Twilio, ElevenLabs).

## Why It's Hackathon-Ready

- End-to-end product flow: auth -> onboarding -> dashboard -> AI chat -> calls -> incidents
- Real AI features running in Supabase Edge Functions (Claude-powered)
- Voice collections workflow via Twilio + ElevenLabs
- Demo fallback mode so the app still feels complete without production data
- Clean frontend structure (React + Tailwind + shadcn/Radix)
- Easy local startup (`npm install && npm run dev`)

## Key Product Features

### 1. Dashboard (`/dashboard`)
- KPI cards (balance, payroll coverage, outstanding invoices, runway)
- Cashflow projection chart
- Invoice table and invoice PDF generation
- Smart Chase (AI ranking of debtors to prioritize)
- Weekly Digest (AI-generated financial summary)

### 2. AI Chat (`/chat`)
- Streaming chat UI powered by Supabase Edge Function `chat`
- Claude-backed responses with account context
- Pulls learnings from incidents + call history into assistant context
- Demo fallback chat content if no account/chat data exists
- Chat-initiated debt collection call runs (bulk debtor calling intent)

### 3. Calls (`/calls`)
- Overdue invoice call queue
- Single-call and bulk call initiation
- Live/realtime call history updates
- Call outcomes, transcripts, status, and duration review

### 4. Incidents (`/incidents`)
- Incident timeline and severity tracking
- AI learnings display
- Operational context around cashflow/payroll issues

### 5. Settings (`/settings`)
- Business profile and finance settings
- Payroll and integration status controls

## Architecture (Codebase Analysis)

### Frontend
- `src/pages/` -> route-level screens (`Dashboard`, `Chat`, `Calls`, `Incidents`, `Settings`, `Auth`, `Onboarding`)
- `src/components/dashboard/` -> dashboard widgets (KPI cards, cashflow chart, weekly digest, smart chase, invoice table)
- `src/components/ui/` -> reusable UI primitives (shadcn/Radix-based)
- `src/hooks/` -> auth/account/toast/mobile hooks
- `src/integrations/supabase/` -> typed Supabase client + generated DB types
- `src/lib/` -> formatting, demo content/data helpers

### Backend (Supabase Edge Functions)
- `supabase/functions/chat` -> Claude streaming assistant
- `supabase/functions/_shared/claude.ts` -> shared Claude client + SSE adapter + JSON parsing helpers
- `supabase/functions/analyze-anomalies` -> AI anomaly detection on transactions
- `supabase/functions/smart-chase` -> AI debtor prioritization
- `supabase/functions/weekly-digest` -> AI weekly finance digest
- `supabase/functions/extract-invoice` -> AI invoice field extraction (PDF/image)
- `supabase/functions/make-call` -> Twilio outbound call initiation
- `supabase/functions/twilio-media-stream` -> Twilio <-> ElevenLabs audio bridge
- `supabase/functions/twilio-status-callback` -> call status sync
- `supabase/functions/send-payment-link` / `process-card-payment` -> collections payment workflows
- `supabase/functions/monzo-webhook` -> transaction ingestion hooks

### Data Layer (Supabase)
Core tables used by the app include:

- `accounts`
- `transactions`
- `invoices`
- `calls`
- `chat_messages`
- `incidents`
- `ai_insights`
- `cashflow_projections`

Realtime is actively used for parts of the UX (e.g. calls/invoices/incidents/insights).

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- React Router
- Tailwind CSS
- Radix UI / shadcn patterns
- Recharts
- React Query

### Backend / Platform
- Supabase (Auth, Postgres, Realtime, Edge Functions)
- Supabase CLI

### AI + Automation
- Anthropic Claude (Edge Functions)
- Twilio (voice calls)
- ElevenLabs (voice agent + TTS)
- Stripe (payments)

## Project Structure

```text
src/
  components/
    dashboard/
    ui/
  hooks/
  integrations/supabase/
  lib/
  pages/
supabase/
  config.toml
  migrations/
  functions/
    _shared/claude.ts
    chat/
    analyze-anomalies/
    smart-chase/
    weekly-digest/
    extract-invoice/
    generate-invoice-pdf/
    make-call/
    twilio-media-stream/
    twilio-status-callback/
    elevenlabs-conversation-token/
    tts-audio/
    process-card-payment/
    send-payment-link/
    monzo-webhook/
```

## Local Development (Fast Start)

### Prerequisites
- Node.js 18+
- npm
- Supabase CLI (optional but recommended for functions/migrations)

### Install + run

```bash
npm install
npm run dev
```

Vite dev server runs on:
- `http://localhost:8080`

### Useful scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run test
```

## Frontend Environment Variables (`.env`)

Required:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Optional:

- `VITE_ELEVENLABS_AGENT_ID` (fallback exists in code)

Example:

```env
VITE_SUPABASE_PROJECT_ID="your-project-ref"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
```

## Supabase Edge Function Secrets (Project Secrets)

### AI (Claude)
- `ANTHROPIC_API_KEY` (required)
- `ANTHROPIC_MODEL` (optional, defaults to `claude-sonnet-4-5`)
- `ANTHROPIC_VERSION` (optional, defaults to `2023-06-01`)

### Voice / Calls
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_AGENT_ID` (optional fallback exists)

### Payments / Email
- `STRIPE_SECRET_KEY`
- `APP_BASE_URL` or `FRONTEND_URL`
- `EMAIL_PROVIDER` (`resend` or `sendgrid`)
- `EMAIL_FROM`
- `RESEND_API_KEY` (if using Resend)
- `SENDGRID_API_KEY` (if using SendGrid)

### Supabase managed/runtime
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Supabase Setup & Deployment

### 1. Link project

```bash
supabase link --project-ref <your-project-ref>
```

This repo is currently configured in `supabase/config.toml` with:
- `cchznuyuomvcpftqtmnw`

### 2. Push database migrations

```bash
supabase db push --linked -p "<db-password>"
```

### 3. Set secrets

```bash
supabase secrets set --project-ref <your-project-ref> \
  ANTHROPIC_API_KEY="..." \
  ANTHROPIC_MODEL="claude-sonnet-4-5" \
  ELEVENLABS_API_KEY="..." \
  TWILIO_ACCOUNT_SID="..." \
  TWILIO_AUTH_TOKEN="..." \
  TWILIO_PHONE_NUMBER="..." \
  STRIPE_SECRET_KEY="..."
```

### 4. Deploy Edge Functions

Deploy all:

```bash
supabase functions deploy --project-ref <your-project-ref> --use-api
```

Or deploy core AI functions only:

```bash
supabase functions deploy chat smart-chase weekly-digest analyze-anomalies extract-invoice --project-ref <your-project-ref>
```

## AI Stack (What Powers What)

- `chat` -> Claude-powered streaming assistant with incident + call context memory
- `smart-chase` -> Claude ranks overdue/unpaid invoices by chase priority
- `weekly-digest` -> Claude generates executive finance summary JSON
- `analyze-anomalies` -> Claude detects unusual transaction patterns and writes AI insights
- `extract-invoice` -> Claude extracts invoice fields from uploaded docs (PDF/images)

## Voice Calling Flow (Collections)

1. User triggers calls from `/calls` or via AI chat intent
2. `make-call` creates Twilio outbound call
3. Twilio streams audio to `twilio-media-stream`
4. ElevenLabs conversational agent handles live voice interaction
5. `twilio-status-callback` updates call outcome/duration
6. Call records become visible in realtime on `/calls`

## Demo Mode / Fallback Data

The app is designed to remain demoable even without live banking or production rows.

Fallback/demo behavior exists for:
- dashboard data
- AI chat history/content
- incidents
- invoice/call flows (demo scenarios where applicable)

This is ideal for hackathon demos and judge walkthroughs.

## Suggested Demo Script (Hackathon)

1. Open `/dashboard`
2. Show KPI cards + cashflow projection
3. Run **Smart Chase** and **Weekly Digest**
4. Open `/chat` and ask:
   - "Can I afford payroll this month?"
   - "Call our debtors and get our money"
5. Open `/calls` and show queue + call history
6. Open `/incidents` and explain AI learnings / past issues

## Known Notes / Practical Caveats

- Some UI areas still include hardcoded visual styles tuned for the current light-first design.
- Voice calling requires real Twilio + ElevenLabs credentials and reachable Supabase functions.
- Large production bundles are currently generated (Vite build warns about chunk size).
- Supabase function auth settings in `supabase/config.toml` intentionally disable JWT verification for several endpoints; review before production hardening.

## Security / Ops Notes

- Do not store real API keys in git or plaintext docs.
- Use `supabase secrets set` for all server-side credentials.
- If a key was ever pasted into chat/logs, rotate it before production/demo day.

## License / Ownership

Hackathon project codebase for Float AI CFO prototype. Add your final license here before public release.

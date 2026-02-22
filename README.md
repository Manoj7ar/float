# Float - AI CFO Platform

Float is a full-stack finance operations app for small businesses. It combines cashflow analytics, AI incident handling, smart invoice collections, and voice call automation.

This repository contains:
- A React + Vite frontend (`src/`)
- Supabase database migrations (`supabase/migrations/`)
- Supabase Edge Functions for AI, invoice extraction, call workflows, and payment processing (`supabase/functions/`)

## What The App Does

- Auth + onboarding flow for business setup
- Dashboard with:
- KPI cards
- Cashflow forecast
- Invoice table and upload
- Benchmark panel
- AI chat assistant with streaming responses
- Calls workspace for AI-assisted collections
- Incident timeline and AI learning summary
- Settings for business profile, payroll, currency, and integration status
- Demo fallback mode when live data is unavailable

## Tech Stack

- Frontend: React 18, TypeScript, Vite, React Router
- UI: Tailwind CSS, Radix UI, lucide-react, shadcn patterns
- Data/Auth: Supabase (Postgres, Realtime, Auth, Edge Functions)
- AI: Anthropic Claude (via Supabase Edge Functions)
- Voice/Telephony: ElevenLabs + Twilio
- Payments: Stripe (Edge Function)
- Testing: Vitest + Testing Library

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
    monzo-webhook/
```

## Database Model

Main tables (public schema):
- `accounts`
- `transactions`
- `invoices`
- `ai_insights`
- `incidents`
- `cashflow_projections`
- `chat_messages`
- `calls`

RLS is enabled on all core tables with user-scoped policies via `auth.uid()`.

Realtime publication includes:
- `invoices`
- `incidents`
- `calls`
- `ai_insights`
- `cashflow_projections`

## Supabase Edge Functions

- `chat`: streaming Claude responses with account context
- `analyze-anomalies`: detects unusual transaction behavior and inserts AI insights
- `smart-chase`: ranks unpaid invoices by chase priority
- `weekly-digest`: generates weekly financial digest JSON
- `extract-invoice`: extracts invoice fields from PDF/image via Claude, inserts invoice
- `generate-invoice-pdf`: returns printable HTML invoice
- `make-call`: creates Twilio outbound call with TwiML stream bridge
- `twilio-media-stream`: WebSocket bridge between Twilio media stream and ElevenLabs conversational agent
- `twilio-status-callback`: updates call status and duration
- `elevenlabs-conversation-token`: creates ElevenLabs conversation token
- `tts-audio`: ElevenLabs text-to-speech proxy
- `process-card-payment`: Stripe card charge + invoice status update
- `monzo-webhook`: ingests Monzo transaction webhook events

## Environment Variables

### Frontend (`.env`)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_ELEVENLABS_AGENT_ID` (optional, defaults to in-code fallback)

### Supabase Edge Functions (project secrets)

- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL` (optional, defaults in `_shared/claude.ts`)
- `ANTHROPIC_VERSION` (optional, defaults in `_shared/claude.ts`)
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_AGENT_ID` (optional, defaults to in-code fallback)
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `STRIPE_SECRET_KEY`
- `SUPABASE_URL` (managed by Supabase)
- `SUPABASE_ANON_KEY` (managed by Supabase)
- `SUPABASE_SERVICE_ROLE_KEY` (managed by Supabase)

## Local Development

### Prerequisites

- Node.js 18+
- npm
- Supabase CLI (for DB/functions workflows)

### Install and run

```bash
npm install
npm run dev
```

Default Vite dev server is configured for:
- host: `::`
- port: `8080`

### Lint and tests

```bash
npm run lint
npm run test
```

## Supabase Setup and Deployment

### Link project

```bash
supabase link --project-ref <your-project-ref>
```

### Push migrations

```bash
supabase db push --linked -p "<db-password>"
```

### Set function secrets

```bash
supabase secrets set --project-ref <your-project-ref> \
  ANTHROPIC_API_KEY="..." \
  ELEVENLABS_API_KEY="..." \
  TWILIO_ACCOUNT_SID="..." \
  TWILIO_AUTH_TOKEN="..." \
  TWILIO_PHONE_NUMBER="..." \
  STRIPE_SECRET_KEY="..."
```

### Deploy functions

```bash
supabase functions deploy --project-ref <your-project-ref> --use-api
```

### Voice calling integration (Twilio + ElevenLabs)

1. Set required secrets in Supabase:

```bash
supabase secrets set --project-ref <your-project-ref> \
  ELEVENLABS_API_KEY="..." \
  ELEVENLABS_AGENT_ID="..." \
  TWILIO_ACCOUNT_SID="..." \
  TWILIO_AUTH_TOKEN="..." \
  TWILIO_PHONE_NUMBER="..."
```

2. Deploy call-related functions:

```bash
supabase functions deploy make-call --project-ref <your-project-ref> --use-api
supabase functions deploy twilio-media-stream --project-ref <your-project-ref> --use-api
supabase functions deploy twilio-status-callback --project-ref <your-project-ref> --use-api
supabase functions deploy elevenlabs-conversation-token --project-ref <your-project-ref> --use-api
```

## Notes

- The app uses demo fallback datasets for dashboard, chat, calls, and incidents when live rows are unavailable.
- `supabase/config.toml` is currently configured to project ref `cchznuyuomvcpftqtmnw`.
- Secrets should only be stored in Supabase secrets manager and secure local env storage.

# Best Use of Claude (Hackathon Submission Notes)

## What Claude does in Float

Claude is the core intelligence layer across the product. Float uses Claude for:

- streaming CFO chat answers
- invoice collection prioritization ("smart chase")
- anomaly detection on transactions
- weekly financial digest generation
- invoice field extraction from uploaded files (PDF/image)

This is not a single prompt feature. Claude is used as a shared platform capability across multiple workflows.

## Shared Claude integration architecture

Float centralizes Claude integration in:

- `supabase/functions/_shared/claude.ts`

This shared module provides:

- `claudeComplete(...)` for standard completions
- `claudeStreamAsOpenAiSse(...)` for streaming responses
- `parseJsonFromModel(...)` for robust JSON extraction (handles fenced code blocks and malformed wrappers)
- typed support for:
  - text
  - image (base64)
  - document (base64)

This reduces repeated prompt/transport code and makes new Claude features faster to ship.

## Where Claude is used in the codebase

- `supabase/functions/chat`
  - Streaming chat assistant for `/chat`
  - Claude output is converted to OpenAI-style SSE for frontend compatibility
- `supabase/functions/smart-chase`
  - Ranks unpaid invoices by likelihood-to-pay and urgency
- `supabase/functions/weekly-digest`
  - Generates structured weekly executive summary JSON
- `supabase/functions/analyze-anomalies`
  - Detects unusual transaction patterns and writes AI insights
- `supabase/functions/extract-invoice`
  - Extracts invoice fields from uploads (PDF/image)

## Why the Claude usage is strong (not superficial)

### 1. Context-aware chat, not generic chat

In `supabase/functions/chat`, Float enriches Claude prompts with real business context:

- recent incidents (severity, status, shortfall, events)
- recent call history (status, outcome, transcript snippets)

This lets Claude answer like an operational CFO assistant using prior learnings, not just current user text.

### 2. Claude is used for structured outputs, not only prose

Claude generates structured JSON for several workflows:

- weekly digest (summary, highlights, recommendations, risk score)
- smart chase rankings
- anomaly detection outputs
- invoice extraction fields

The shared JSON parsing helper makes the outputs resilient enough for hackathon demos.

### 3. Streaming UX for responsiveness

`claudeStreamAsOpenAiSse(...)` converts Claude streaming events into OpenAI-style SSE chunks. That enables a responsive chat experience without custom frontend streaming protocol work.

## Concrete user-facing experiences powered by Claude

- `/chat`: business questions about cashflow, invoices, and operational context
- Dashboard insights:
  - anomaly detection outputs (via `analyze-anomalies`)
  - smart chase ranking (function exists and is integrated into the product concept)
  - weekly digest generation (function exists and structured prompt/data pipeline is implemented)
- Invoice upload:
  - AI extraction from file uploads (`extract-invoice`)

## Claude model/config setup

From repo configuration/docs and shared client:

- `ANTHROPIC_API_KEY` (required)
- `ANTHROPIC_MODEL` (optional, defaults to `claude-sonnet-4-5`)
- `ANTHROPIC_VERSION` (optional, defaults to `2023-06-01`)

## Why this is hackathon-ready

- One shared Claude adapter powers multiple product surfaces.
- The same AI layer supports both:
  - conversational UX
  - structured operations workflows
- The system demonstrates business value, not just "AI chat":
  - collections prioritization
  - anomaly detection
  - executive summary generation
  - document understanding

## Judge demo script (Claude-focused)

1. Open `/chat` and ask about cashflow risk or overdue invoices.
2. Show that the assistant references incidents/call learnings contextually.
3. Show invoice upload and extraction flow.
4. Describe weekly digest and anomaly functions (structured JSON outputs).


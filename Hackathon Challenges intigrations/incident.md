# Best Adaptable Agent for Incident (Hackathon Submission Notes)

## What "Incident" means in Float

Float includes an incidents system for operational/finance risk events (cashflow pressure, payroll shortfall risk, card/payment issues, etc.) and uses AI learnings from those incidents across the product.

The `/incidents` page is explicitly framed as:

- "Powered by Incident.io"
- an incident operations workflow with AI learning/adaptation layered on top

## What the incident system does

Float's incident workflow covers:

- incident severity/status tracking (`P1/P2/P3`, open/investigating/mitigated/resolved/closed)
- event timeline logging per incident
- action transitions (start investigating, mitigate, resolve)
- AI learning summary aggregated from resolved incidents
- realtime updates via Supabase
- demo fallback incidents for hackathon demos

## Where it is implemented

- `src/pages/Incidents.tsx`
  - main incident operations UI
  - filters, search, sort, and status counts
  - realtime updates and optimistic state updates
  - incident timeline cards and actions
  - AI Learning Summary panel
- `src/lib/demo-content.ts`
  - demo incident scenarios for zero-data demo mode
- `supabase/migrations/...`
  - incidents table + policies + realtime publication

## Why this is an "adaptable agent" story

Float does not treat incidents as static tickets. It turns them into reusable learning context:

- incident events are captured and stored
- incident outcomes and patterns are aggregated in the Incidents page
- incident + call history is injected into the Claude chat system prompt (`supabase/functions/chat`)

So the agent becomes more useful over time by referencing:

- past incidents
- what happened
- what actions were taken
- what worked

This is the adaptation loop.

## How the adaptation loop works (practical)

1. Incident is created/tracked (severity, status, shortfall, events).
2. Human/AI actions add timeline events (investigation, mitigation, resolution).
3. Resolved incidents roll into an "AI Learning Summary".
4. Chat assistant pulls incident summaries and call outcomes into Claude context.
5. Future advice can reference past incidents and learned patterns.

## Incident.io angle (hackathon framing)

Float uses an Incident.io-style operational model and UX framing for incident response and post-incident learning.

Current build status:

- Strong product/workflow integration for incident operations + AI learning
- No direct Incident.io API integration is required for the core demo story

This still fits the "Best Adaptable Agent for Incident" theme because the key differentiator is how incidents become machine-usable memory for future decisions.

## Why judges should care

- Most hackathon incident features stop at status badges.
- Float turns incidents into data that improves future AI behavior.
- It connects incident operations to:
  - chat guidance
  - financial risk awareness
  - collections/call context

That makes the incident agent genuinely adaptable, not just reactive.


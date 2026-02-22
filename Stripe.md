# Best Stripe Integration (Hackathon Submission Notes)

## What Stripe does in Float

Stripe powers the payment collection path for overdue invoices. In Float, Stripe is not just a standalone checkout link. It is embedded into the recovery workflow used by:

- AI voice collection calls (via ElevenLabs + Twilio)
- manual "send payment link" actions
- invoice records and payment status tracking
- invoice PDF generation (optional pay-now button)

This makes Stripe part of an end-to-end receivables automation loop, not just a payment button.

## Where Stripe is used in the codebase

- `supabase/functions/send-payment-link/index.ts`
  - Creates Stripe Checkout Sessions
  - Stores `stripe_payment_link` on the invoice
  - Emails the payment link to the customer (Resend or SendGrid)
- `supabase/functions/process-card-payment/index.ts`
  - Creates a Stripe PaymentMethod and PaymentIntent
  - Marks the invoice as paid in Supabase on success
  - Stores `stripe_payment_intent_id`
- `supabase/functions/twilio-media-stream/index.ts`
  - Lets the ElevenLabs voice agent call Stripe payment tools during live calls
  - Supports both `process_payment` and `send_payment_link` tool calls
- `supabase/functions/generate-invoice-pdf/index.ts`
  - Adds a "Pay Now" CTA to generated invoice HTML when `stripe_payment_link` exists
- `src/pages/Calls.tsx`
  - UI action to send a payment link from the call workflow

## End-to-end Stripe flow (what the judges can demo)

### Flow A: AI call -> Stripe payment link

1. User opens `/calls` and starts an overdue invoice collection call.
2. `make-call` triggers Twilio, which connects to `twilio-media-stream`.
3. `twilio-media-stream` opens an ElevenLabs conversation websocket and gives the agent invoice/customer context.
4. If the debtor asks for a link, the voice agent calls the `send_payment_link` tool.
5. `twilio-media-stream` forwards that to `supabase/functions/send-payment-link`.
6. `send-payment-link` creates a Stripe Checkout Session and returns `session.url`.
7. The link is stored on the invoice (`stripe_payment_link`) and emailed to the customer.
8. The voice agent confirms success in the live call.

### Flow B: AI call -> card capture -> Stripe charge

1. The voice agent collects card details one field at a time during the call.
2. ElevenLabs emits a tool call for `process_payment`.
3. `twilio-media-stream` calls `supabase/functions/process-card-payment`.
4. That function creates a Stripe PaymentMethod + PaymentIntent.
5. On success, the invoice is updated to `paid` and `stripe_payment_intent_id` is saved.
6. The agent reports the payment result back to the customer in-call.

## Why this is a strong Stripe integration

- Stripe is embedded in an operational workflow (collections), not isolated checkout.
- Stripe is connected to AI decisioning and voice automation.
- Stripe outcomes update business data (`invoices`) immediately.
- Stripe links are reused in invoices/PDFs and follow-up email communication.
- Stripe supports both:
  - self-serve pay-later links (Checkout Session)
  - assisted payment during a live agent interaction (PaymentIntent)

## Data model + state tracked

The invoices schema includes Stripe-specific fields (visible in migrations/types):

- `stripe_payment_link`
- `stripe_payment_intent_id`

These fields allow Float to:

- store payment session URLs for reuse
- track successful payment intent references
- render payment CTA in generated invoice PDFs
- tie collection actions to payment outcomes

## Config / env needed for demo

Required (server-side):

- `STRIPE_SECRET_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Also used in `send-payment-link`:

- `EMAIL_FROM`
- one email provider:
  - `RESEND_API_KEY` or
  - `SENDGRID_API_KEY`

Optional but recommended:

- `APP_BASE_URL` or `FRONTEND_URL` (for success/cancel URLs)

## Hackathon-readiness notes

- Fast to demo: the payment link path works well even without a full live payment demo.
- Integrated storytelling: issue detected -> call placed -> payment requested -> Stripe link sent -> invoice updated.
- Clear technical depth: Checkout Sessions, PaymentIntents, data persistence, email delivery, and voice-agent tool use.

## Important production hardening note (honest disclosure)

`process-card-payment` currently accepts raw card details in a server function for hackathon/demo speed. For production, this should be replaced with a Stripe Elements / Payment Element or tokenized flow so card data never touches application servers.


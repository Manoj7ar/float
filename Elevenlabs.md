# Best Use of ElevenLabs (Hackathon Submission Notes)

## What ElevenLabs does in Float

ElevenLabs powers the voice intelligence layer in two ways:

- embedded conversational widget in the app UI
- real-time voice agent for overdue invoice collection calls (via Twilio bridge)

This gives Float both:

- an on-screen conversational assistant experience
- a phone-call automation channel for accounts receivable collections

## Where ElevenLabs is used in the codebase

- `src/components/ElevenLabsWidget.tsx`
  - App-wide embedded `elevenlabs-convai` widget (bottom-right)
  - Loads `@elevenlabs/convai-widget-embed` script
- `src/components/AppLayout.tsx`
  - Mounts the widget globally across authenticated pages
- `supabase/functions/elevenlabs-conversation-token`
  - Creates conversation tokens for client-side ConvAI usage
- `supabase/functions/tts-audio`
  - Uses ElevenLabs TTS endpoint for speech synthesis
- `supabase/functions/twilio-media-stream`
  - Real-time Twilio <-> ElevenLabs websocket bridge for phone calls

## Advanced integration: Twilio <-> ElevenLabs bridge

The strongest part of the ElevenLabs integration is `supabase/functions/twilio-media-stream/index.ts`.

What it does:

1. Receives Twilio media stream websocket events.
2. Requests a signed ElevenLabs ConvAI websocket URL.
3. Opens an ElevenLabs websocket session.
4. Sends dynamic variables (client name, invoice number, amount, due date, email).
5. Injects a conversation override prompt for a collections agent ("Aria").
6. Streams audio both directions:
   - Twilio -> ElevenLabs (with audio conversion when needed)
   - ElevenLabs -> Twilio
7. Handles ElevenLabs tool calls during the live conversation:
   - `process_payment`
   - `send_payment_link`

This is a real-time voice + tool orchestration integration, not just TTS playback.

## Why this is a strong ElevenLabs use case

- Uses ElevenLabs as an interactive agent, not only voice output.
- Uses dynamic conversation context per debtor/invoice/call.
- Integrates tool execution into the conversation loop.
- Bridges telephony audio formats (including conversion handling).
- Ties voice outcomes to business systems (Stripe + Supabase invoices/calls).

## Embedded widget usage (app-level assistant)

Float also includes an ElevenLabs ConvAI widget in the UI:

- fixed bottom-right placement across app pages
- configured by agent id
- script loaded once globally

This gives judges a fast way to see ElevenLabs in action even before a live call demo.

## Config / env needed

Frontend:

- `VITE_ELEVENLABS_AGENT_ID` (fallback exists in code)

Server-side:

- `ELEVENLABS_API_KEY`
- `ELEVENLABS_AGENT_ID` (optional fallback exists in code)

Also used in the telephony bridge flow:

- Twilio-related env vars and Supabase function endpoints

## Hackathon-ready demo angles

- Quick demo: open app and show embedded ElevenLabs widget in bottom-right.
- Advanced demo: show `/calls` flow and explain live voice collections agent with tool calls.
- Strong narrative: ElevenLabs is not isolated; it drives revenue recovery workflows.

## What makes this stand out to judges

Float uses ElevenLabs for an "action-taking voice agent" that can:

- converse with a debtor,
- collect payment details or send payment links,
- and close the loop with system updates.

That is a high-value operational use case, not a novelty voice feature.


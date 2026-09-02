# Voice Agent Test Bench

A small web app for **designing an AI phone-agent call script once and firing a
live test call to any number** across two providers — [Bland.ai](https://app.bland.ai/)
and [ElevenLabs](https://elevenlabs.io/). Built to iterate on an existing
production voice agent with three goals in mind:

1. **Agent quality** — structure the call (opening, questions, qualification,
   next steps) instead of a single blob prompt.
2. **Lower lag** — a Responsiveness control maps to each provider's latency
   knobs (model + interruption threshold).
3. **Background ambience** — office / call-center / café / restaurant noise
   (natively supported on Bland today).

## What you can configure

Everything is one **call script**, compiled into a provider-specific payload:

- **Agent identity** — agent name + business name
- **Objective** — the one-line goal that steers the whole call
- **Opening prompt** — the first thing the agent says
- **Questions** — ordered, each optionally marked *required*
- **Qualification criteria** — the rule that decides qualified vs. not
- **Next steps** — separate branches for **qualified** and **not qualified**
- **Delivery** — voice id, responsiveness (lag), background ambience

Expand **Compiled agent prompt** in the UI to see the exact instruction block
sent to both providers — so you're testing the *same* agent behaviour on each.

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev                  # http://localhost:3000
```

Enter a phone number in **E.164** format (e.g. `+14155551234`), pick a provider,
and hit **Send test call**.

## Provider setup

### Bland.ai (simplest)
Bland handles telephony itself, so a single API key is enough to place a real
call. Set `BLAND_API_KEY` in `.env.local`. Background ambience and the
responsiveness knobs (turbo model + interruption threshold) are applied here.

### ElevenLabs (needs a linked Twilio number)
ElevenLabs places outbound calls through a Twilio number linked to an agent:

1. Create an agent in the ElevenLabs **Conversational AI / Agents** dashboard and
   copy its **Agent ID** → `ELEVENLABS_AGENT_ID`.
2. In that agent's **Security** settings, allow overrides for **System prompt**
   and **First message** (and voice, if you use the Voice ID field). This app
   reuses one agent and overrides its prompt per call.
3. Link a Twilio number to the agent and copy the **Phone number ID** →
   `ELEVENLABS_AGENT_PHONE_NUMBER_ID`.
4. Set `ELEVENLABS_API_KEY`.

Background ambience is not applied on ElevenLabs yet (Bland-only feature).

## Project layout

```
src/
  app/
    page.tsx              # renders the builder
    layout.tsx
    globals.css
    api/call/route.ts     # POST /api/call — validates + dispatches to a provider
  components/
    CallBuilder.tsx       # the whole UI (client component)
  lib/
    types.ts              # CallScript domain model + defaults
    prompt.ts             # compiles a CallScript into one system prompt
    prompt.test.ts        # unit tests for the compiler
    bland.ts              # Bland.ai client
    elevenlabs.ts         # ElevenLabs client
```

## Scripts

```bash
npm run dev     # start dev server
npm run build   # production build + typecheck
npm test        # run compiler unit tests
```

## How the settings map to each provider

| UI control          | Bland.ai                                   | ElevenLabs                                  |
| ------------------- | ------------------------------------------ | ------------------------------------------- |
| Opening prompt      | `first_sentence`                           | `first_message` override                    |
| Whole script        | `task`                                     | `prompt.prompt` override                    |
| Responsiveness      | `model` (`turbo`/`base`) + `interruption_threshold` | (agent's own latency settings)     |
| Background ambience  | `background_track`                        | — (ignored)                                 |
| Voice id            | `voice`                                    | `tts.voice_id` override                     |

## Notes & next ideas

- API keys stay server-side (env vars); the browser only talks to `/api/call`.
- Natural next steps: pull call recordings/transcripts back for review, run the
  same script on both providers side-by-side and compare, and persist scripts.

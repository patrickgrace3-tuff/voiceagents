# Voice Agent Test Bench

A small web app for **designing an AI phone-agent call script once and firing a
live test call to any number** across four providers —
[Bland.ai](https://app.bland.ai/), [Vapi](https://vapi.ai/),
[ElevenLabs](https://elevenlabs.io/), and [Retell](https://retellai.com/).
Built to iterate on an existing production voice agent with three goals in mind:

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

### Vapi (nearly as plug-and-play as Bland)
Vapi compiles your whole call script into an inline "transient" assistant, so
you only need two things: `VAPI_API_KEY` and a `VAPI_PHONE_NUMBER_ID` (grab a
free Vapi number under **Phone Numbers**). It supports an `office` background
preset and maps Responsiveness to `startSpeakingPlan.waitSeconds`. Make sure an
LLM provider key is configured in your Vapi dashboard (defaults to OpenAI
`gpt-4o`; override with `VAPI_MODEL_PROVIDER` / `VAPI_MODEL`).

### Retell (needs a purchased number + dashboard agent)
Retell runs the prompt from an agent you build in its dashboard, so — unlike the
others — **the call script in this app isn't injected into a Retell call yet**.
Set `RETELL_API_KEY` and `RETELL_FROM_NUMBER` (a number you bought in Retell,
bound to an agent); optionally `RETELL_AGENT_ID` to override which agent answers.
Injecting the compiled prompt via Retell's agent API is a planned follow-up.

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

## Deploy to Render

This app has server-side API routes that hold your provider keys, so deploy it
as a **Web Service (Node)** — not a Static Site.

A [`render.yaml`](./render.yaml) blueprint is included. Easiest path:

1. Push this repo to GitHub (already done if you're reading this there).
2. In Render: **New → Blueprint**, connect the repo. Render reads `render.yaml`
   and creates the web service with the right build/start commands.
3. Render prompts for the four secret env vars (they're marked `sync: false`,
   so they never live in the repo):
   - `BLAND_API_KEY`
   - `ELEVENLABS_API_KEY`
   - `ELEVENLABS_AGENT_ID`
   - `ELEVENLABS_AGENT_PHONE_NUMBER_ID`
4. Deploy. Your app is at `https://<name>.onrender.com`.

Prefer not to use the blueprint? Create the service by hand with:

| Setting        | Value                          |
| -------------- | ------------------------------ |
| Environment    | Node                           |
| Build command  | `npm install && npm run build` |
| Start command  | `npm start`                    |
| Node version   | `22` (via `NODE_VERSION`)      |

then add the four env vars under **Environment**.

**Notes**
- The `start` script binds `0.0.0.0` on Render's `$PORT`, as Render requires.
- The **free** plan spins the service down when idle, so the first call after a
  quiet spell has a cold-start delay. Fine for a test bench; bump to a paid plan
  for always-on. (This is app cold-start, unrelated to in-call agent lag.)
- Env vars are read server-side only; the browser never sees your keys.

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
    vapi.ts               # Vapi client
    elevenlabs.ts         # ElevenLabs client
    retell.ts             # Retell client
```

## Scripts

```bash
npm run dev     # start dev server
npm run build   # production build + typecheck
npm test        # run compiler unit tests
```

## How the settings map to each provider

| UI control         | Bland.ai                                    | Vapi                                     | ElevenLabs               | Retell                    |
| ------------------ | ------------------------------------------- | ---------------------------------------- | ------------------------ | ------------------------- |
| Opening prompt     | `first_sentence`                            | `assistant.firstMessage`                 | `first_message` override | (dashboard agent)         |
| Whole script       | `task`                                      | `assistant.model.messages[system]`       | `prompt.prompt` override | (dashboard agent)         |
| Responsiveness     | `model` + `interruption_threshold`          | `startSpeakingPlan.waitSeconds`          | (agent settings)         | (dashboard agent)         |
| Background ambience | `background_track`                         | `backgroundSound` (`office`/off)         | — (ignored)              | (dashboard agent)         |
| Voice id           | `voice`                                     | `assistant.voice.voiceId` (11labs)       | `tts.voice_id` override  | (dashboard agent)         |

Bland and Vapi are the true plug-and-play, script-driven providers. ElevenLabs
needs a linked Twilio number; Retell runs its own dashboard agent (script
injection is a planned follow-up).

## Notes & next ideas

- API keys stay server-side (env vars); the browser only talks to `/api/call`.
- Natural next steps: pull call recordings/transcripts back for review, run the
  same script on multiple providers side-by-side and compare, persist scripts,
  wire dynamic variables (`{{lead_first_name}}` / `{{company_name}}`), and inject
  the compiled prompt into Retell via its agent API.

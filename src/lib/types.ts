// Shared domain model for a voice-agent call script.
// The same script is compiled into provider-specific payloads
// (Bland `task` string, ElevenLabs prompt override) so a single
// definition can be A/B tested across providers.

export type Provider = "bland" | "elevenlabs";

/** How fast/eager the agent is to respond. Maps to provider latency knobs. */
export type Responsiveness = "relaxed" | "balanced" | "snappy";

/** Ambient background audio mixed into the call. */
export type BackgroundTrack = "none" | "office" | "cafe" | "restaurant";

export interface ScriptQuestion {
  id: string;
  /** The question the agent should ask the person. */
  text: string;
  /** If true, the agent should not move on until it gets an answer. */
  required: boolean;
}

export interface CallScript {
  /** Name the agent introduces itself as. */
  agentName: string;
  /** The company / brand the agent is calling on behalf of. */
  businessName: string;

  /** One-line goal of the call (used to steer the whole conversation). */
  objective: string;

  /** The very first thing the agent says when the person picks up. */
  openingPrompt: string;

  /** Ordered list of questions the agent works through. */
  questions: ScriptQuestion[];

  /** Plain-language rule that decides if the person is qualified. */
  qualificationCriteria: string;
  /** What the agent does / says when the person IS qualified. */
  qualifiedNextSteps: string;
  /** What the agent does / says when the person is NOT qualified. */
  notQualifiedNextSteps: string;

  // ── Delivery settings ──────────────────────────────────────
  /** Provider voice id. Free-form so any provider voice works. */
  voice: string;
  responsiveness: Responsiveness;
  backgroundTrack: BackgroundTrack;
}

export interface PlaceCallRequest {
  provider: Provider;
  phoneNumber: string;
  script: CallScript;
}

export interface PlaceCallResult {
  ok: boolean;
  provider: Provider;
  /** Provider call id, when the call was accepted. */
  callId?: string;
  /** Human-readable status or error message. */
  message: string;
  /** Raw provider response, for debugging in the UI. */
  raw?: unknown;
}

export const EMPTY_SCRIPT: CallScript = {
  agentName: "Alex",
  businessName: "Acme Solar",
  objective:
    "Qualify the homeowner for a free solar savings assessment and book a follow-up if they're a good fit.",
  openingPrompt:
    "Hi, this is Alex calling from Acme Solar — do you have a quick minute?",
  questions: [
    { id: "q1", text: "Do you own your home?", required: true },
    { id: "q2", text: "Roughly what's your average monthly electric bill?", required: true },
    { id: "q3", text: "Is your roof mostly shaded or does it get good sun?", required: false },
  ],
  qualificationCriteria:
    "The person owns their home AND their monthly electric bill is $120 or more.",
  qualifiedNextSteps:
    "Let them know they're a great fit, and book a 15-minute assessment call with a specialist. Confirm the best day and time.",
  notQualifiedNextSteps:
    "Thank them politely, let them know we may reach out in the future, and end the call warmly. Do not book anything.",
  voice: "",
  responsiveness: "balanced",
  backgroundTrack: "office",
};

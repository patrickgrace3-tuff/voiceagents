// Shared domain model for a voice-agent call script.
// The same script is compiled into provider-specific payloads
// (Bland `task` string, ElevenLabs prompt override) so a single
// definition can be A/B tested across providers.

export type Provider = "bland" | "elevenlabs" | "vapi" | "retell";

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
  agentName: "Patrick",
  businessName: "Conversionia",
  objective:
    "Ask a couple of qualifying questions, then schedule a call with a recruiter.",
  openingPrompt:
    "Hi {{lead_first_name}} this is Patrick, your AI recruiter with {{company_name}}! I just got your short form and I've got a couple additional questions. After that, I'm happy to answer anything or connect you with a recruiter who can. Does that sound good?",
  questions: [
    { id: "q1", text: "Do you have a Class A CDL?", required: true },
    { id: "q2", text: "How much tractor trailer experience do you have?", required: true },
  ],
  qualificationCriteria:
    "The driver has a Class A CDL AND at least some verifiable tractor-trailer experience.",
  qualifiedNextSteps:
    "Get them scheduled with a recruiter. Confirm the best day and time, and let them know the recruiter will call them then.",
  notQualifiedNextSteps:
    "Let them know the next steps, and that a team member will reach out if they qualify. Thank them warmly. Do not schedule a recruiter call.",
  voice: "",
  responsiveness: "balanced",
  backgroundTrack: "office",
};

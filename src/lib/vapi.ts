import type { BackgroundTrack, CallScript, PlaceCallResult, Responsiveness } from "./types";
import { compilePrompt } from "./prompt";

const VAPI_CALL_URL = "https://api.vapi.ai/call";

export interface VapiConfig {
  apiKey: string;
  phoneNumberId: string;
  /** LLM the transient assistant runs on. Configure the matching provider key
   *  in your Vapi dashboard. Defaults to OpenAI gpt-4o. */
  modelProvider: string;
  model: string;
}

/** Vapi's `startSpeakingPlan.waitSeconds` — lower waits = snappier replies. */
function waitSeconds(responsiveness: Responsiveness): number {
  switch (responsiveness) {
    case "snappy":
      return 0.2;
    case "relaxed":
      return 0.8;
    case "balanced":
    default:
      return 0.4;
  }
}

/** Vapi ships an "office" ambience preset; other tracks fall back to off. */
function backgroundSound(track: BackgroundTrack): "off" | "office" {
  return track === "office" ? "office" : "off";
}

export async function placeVapiCall(
  phoneNumber: string,
  script: CallScript,
  config: VapiConfig,
): Promise<PlaceCallResult> {
  const assistant: Record<string, unknown> = {
    firstMessage: script.openingPrompt.trim(),
    model: {
      provider: config.modelProvider,
      model: config.model,
      messages: [{ role: "system", content: compilePrompt(script) }],
    },
    backgroundSound: backgroundSound(script.backgroundTrack),
    startSpeakingPlan: { waitSeconds: waitSeconds(script.responsiveness) },
  };

  // A voice id is only meaningful with a provider; assume ElevenLabs when given.
  if (script.voice.trim()) {
    assistant.voice = { provider: "11labs", voiceId: script.voice.trim() };
  }

  const body = {
    phoneNumberId: config.phoneNumberId,
    customer: { number: phoneNumber },
    assistant,
  };

  let res: Response;
  try {
    res = await fetch(VAPI_CALL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return {
      ok: false,
      provider: "vapi",
      message: `Network error reaching Vapi: ${(err as Error).message}`,
    };
  }

  const raw = await safeJson(res);

  if (!res.ok) {
    return {
      ok: false,
      provider: "vapi",
      message: extractError(raw) ?? `Vapi returned HTTP ${res.status}`,
      raw,
    };
  }

  const callId = (raw as { id?: string })?.id;
  const note =
    script.backgroundTrack !== "none" && script.backgroundTrack !== "office"
      ? ` Note: Vapi only has an "office" ambience preset, so "${script.backgroundTrack}" was sent as off.`
      : "";

  return {
    ok: true,
    provider: "vapi",
    callId,
    message:
      (callId ? `Call queued with Vapi (${callId}).` : "Call request accepted by Vapi.") + note,
    raw,
  };
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

function extractError(raw: unknown): string | undefined {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (typeof r.message === "string") return r.message;
    if (Array.isArray(r.message)) return r.message.join("; ");
    if (typeof r.error === "string") return r.error;
  }
  return undefined;
}

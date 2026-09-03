import type { CallScript, PlaceCallResult, Responsiveness } from "./types";
import { compilePrompt } from "./prompt";

const VAPI_CALL_URL = "https://api.vapi.ai/call";

export interface OpenAIConfig {
  /** Vapi is used purely as the telephony transport for the call. */
  vapiApiKey: string;
  vapiPhoneNumberId: string;
  /** OpenAI speech-to-speech model. Defaults to gpt-realtime-2 (their best).
   *  Must be a realtime model id Vapi accepts, e.g. gpt-realtime-2,
   *  gpt-realtime-2025-08-28, or gpt-realtime-mini-2025-12-15. */
  model: string;
  /** OpenAI Realtime voice id (e.g. marin, cedar, alloy). */
  voice: string;
}

/**
 * "OpenAI" provider — runs OpenAI's Realtime speech-to-speech model
 * (gpt-realtime, their highest-quality voice) on a real phone call.
 *
 * OpenAI's Realtime API has no telephony of its own, so we place the call
 * through Vapi (the same transport the Vapi provider uses) with the assistant's
 * model + voice both set to OpenAI. The caller hears OpenAI end to end; Vapi is
 * just the phone line.
 *
 * Requires your OpenAI API key to be configured in the Vapi dashboard under
 * Provider Keys so Vapi can reach the Realtime model on your behalf.
 */
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

export async function placeOpenAICall(
  phoneNumber: string,
  script: CallScript,
  config: OpenAIConfig,
): Promise<PlaceCallResult> {
  const voiceId = script.voice.trim() || config.voice;

  const assistant: Record<string, unknown> = {
    firstMessage: script.openingPrompt.trim(),
    // Speech-to-speech: the OpenAI Realtime model handles both the reasoning
    // and the voice.
    model: {
      provider: "openai",
      model: config.model,
      messages: [{ role: "system", content: compilePrompt(script) }],
    },
    voice: { provider: "openai", voiceId },
    startSpeakingPlan: { waitSeconds: waitSeconds(script.responsiveness) },
  };

  // Vapi can layer ambience over the stream; only "office" has a preset.
  if (script.backgroundTrack === "office") {
    assistant.backgroundSound = "office";
  }

  const body = {
    phoneNumberId: config.vapiPhoneNumberId,
    customer: { number: phoneNumber },
    assistant,
  };

  let res: Response;
  try {
    res = await fetch(VAPI_CALL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.vapiApiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return {
      ok: false,
      provider: "openai",
      message: `Network error placing the OpenAI call: ${(err as Error).message}`,
    };
  }

  const raw = await safeJson(res);

  if (!res.ok) {
    return {
      ok: false,
      provider: "openai",
      message:
        extractError(raw) ??
        `Call transport returned HTTP ${res.status} (check your OpenAI key is set in Vapi's Provider Keys).`,
      raw,
    };
  }

  const callId = (raw as { id?: string })?.id;
  const bgNote =
    script.backgroundTrack !== "none" && script.backgroundTrack !== "office"
      ? ` Note: only an "office" ambience preset is available, so "${script.backgroundTrack}" was sent as off.`
      : "";

  return {
    ok: true,
    provider: "openai",
    callId,
    message:
      (callId
        ? `Call queued on OpenAI ${config.model} (${callId}).`
        : `Call request accepted (OpenAI ${config.model}).`) + bgNote,
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

import type { CallScript, PlaceCallResult } from "./types";
import { compilePrompt } from "./prompt";

const ELEVENLABS_OUTBOUND_URL =
  "https://api.elevenlabs.io/v1/convai/twilio/outbound_call";

export interface ElevenLabsConfig {
  apiKey: string;
  agentId: string;
  agentPhoneNumberId: string;
}

/**
 * ElevenLabs places outbound calls through a Twilio number linked to an agent.
 * We reuse a single configured agent and override its prompt + first message
 * per call, so the same call script drives both providers.
 *
 * Note: overrides only take effect if the agent's Security settings allow
 * overriding "System prompt" and "First message" (and voice, if used).
 */
export async function placeElevenLabsCall(
  phoneNumber: string,
  script: CallScript,
  config: ElevenLabsConfig,
): Promise<PlaceCallResult> {
  const agentOverride: Record<string, unknown> = {
    prompt: { prompt: compilePrompt(script) },
    first_message: script.openingPrompt.trim(),
  };

  const conversationConfigOverride: Record<string, unknown> = {
    agent: agentOverride,
  };

  if (script.voice.trim()) {
    conversationConfigOverride.tts = { voice_id: script.voice.trim() };
  }

  const body = {
    agent_id: config.agentId,
    agent_phone_number_id: config.agentPhoneNumberId,
    to_number: phoneNumber,
    conversation_initiation_client_data: {
      conversation_config_override: conversationConfigOverride,
    },
  };

  let res: Response;
  try {
    res = await fetch(ELEVENLABS_OUTBOUND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": config.apiKey,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return {
      ok: false,
      provider: "elevenlabs",
      message: `Network error reaching ElevenLabs: ${(err as Error).message}`,
    };
  }

  const raw = await safeJson(res);

  if (!res.ok) {
    return {
      ok: false,
      provider: "elevenlabs",
      message: extractError(raw) ?? `ElevenLabs returned HTTP ${res.status}`,
      raw,
    };
  }

  // Success looks like { success: true, conversation_id, callSid }.
  const callId =
    (raw as { conversation_id?: string })?.conversation_id ??
    (raw as { callSid?: string })?.callSid;

  const note =
    script.backgroundTrack !== "none"
      ? " Note: background ambience isn't applied — it's a Bland-only feature for now."
      : "";

  return {
    ok: true,
    provider: "elevenlabs",
    callId,
    message:
      (callId
        ? `Call queued with ElevenLabs (${callId}).`
        : "Call request accepted by ElevenLabs.") + note,
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
    if (typeof r.detail === "string") return r.detail;
    if (r.detail && typeof r.detail === "object") {
      const d = r.detail as Record<string, unknown>;
      if (typeof d.message === "string") return d.message;
    }
    if (typeof r.message === "string") return r.message;
  }
  return undefined;
}

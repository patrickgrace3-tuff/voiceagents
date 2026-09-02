import type { CallScript, PlaceCallResult, Responsiveness } from "./types";
import { compilePrompt } from "./prompt";

const BLAND_CALLS_URL = "https://api.bland.ai/v1/calls";

/**
 * Bland exposes an `interruption_threshold` (ms of caller speech before the
 * agent yields the floor) and a model choice. Lower threshold + faster model
 * = snappier, lower-lag feel.
 */
function tuning(responsiveness: Responsiveness): {
  model: string;
  interruption_threshold: number;
} {
  switch (responsiveness) {
    case "snappy":
      return { model: "turbo", interruption_threshold: 50 };
    case "relaxed":
      return { model: "base", interruption_threshold: 150 };
    case "balanced":
    default:
      return { model: "turbo", interruption_threshold: 100 };
  }
}

export async function placeBlandCall(
  phoneNumber: string,
  script: CallScript,
  apiKey: string,
): Promise<PlaceCallResult> {
  const { model, interruption_threshold } = tuning(script.responsiveness);

  const body: Record<string, unknown> = {
    phone_number: phoneNumber,
    task: compilePrompt(script),
    first_sentence: script.openingPrompt.trim() || undefined,
    wait_for_greeting: true,
    model,
    interruption_threshold,
    // Bland accepts null to disable ambience.
    background_track:
      script.backgroundTrack === "none" ? null : script.backgroundTrack,
    record: true,
  };

  if (script.voice.trim()) {
    body.voice = script.voice.trim();
  }

  let res: Response;
  try {
    res = await fetch(BLAND_CALLS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: apiKey,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return {
      ok: false,
      provider: "bland",
      message: `Network error reaching Bland: ${(err as Error).message}`,
    };
  }

  const raw = await safeJson(res);

  if (!res.ok) {
    return {
      ok: false,
      provider: "bland",
      message: extractError(raw) ?? `Bland returned HTTP ${res.status}`,
      raw,
    };
  }

  // Successful Bland response looks like { status: "success", call_id: "..." }.
  const callId =
    (raw as { call_id?: string })?.call_id ??
    (raw as { callId?: string })?.callId;

  return {
    ok: true,
    provider: "bland",
    callId,
    message: callId
      ? `Call queued with Bland (call_id ${callId}).`
      : "Call request accepted by Bland.",
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
    if (typeof r.error === "string") return r.error;
    if (typeof r.errors === "string") return r.errors;
  }
  return undefined;
}

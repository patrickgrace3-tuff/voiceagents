import type { CallScript, PlaceCallResult } from "./types";

const RETELL_CALL_URL = "https://api.retellai.com/v2/create-phone-call";

export interface RetellConfig {
  apiKey: string;
  /** A number you purchased in Retell (E.164), bound to an agent. */
  fromNumber: string;
  /** Optional: override which agent answers this call. */
  agentId?: string;
}

/**
 * Retell places the call from a number that is already bound to an agent you
 * build in the Retell dashboard, so the *prompt lives on that agent* — unlike
 * Bland/Vapi, this app can't inject the compiled script inline (yet).
 *
 * We still pass the script's variable values as dynamic variables so a Retell
 * agent authored with {{lead_first_name}} / {{company_name}} placeholders fills
 * in correctly. Injecting the full prompt would require the Retell agent/LLM
 * update API — a planned follow-up.
 */
export async function placeRetellCall(
  phoneNumber: string,
  script: CallScript,
  config: RetellConfig,
): Promise<PlaceCallResult> {
  const body: Record<string, unknown> = {
    from_number: config.fromNumber,
    to_number: phoneNumber,
    retell_llm_dynamic_variables: {
      company_name: script.businessName,
      agent_name: script.agentName,
    },
  };
  if (config.agentId) {
    body.override_agent_id = config.agentId;
  }

  let res: Response;
  try {
    res = await fetch(RETELL_CALL_URL, {
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
      provider: "retell",
      message: `Network error reaching Retell: ${(err as Error).message}`,
    };
  }

  const raw = await safeJson(res);

  if (!res.ok) {
    return {
      ok: false,
      provider: "retell",
      message: extractError(raw) ?? `Retell returned HTTP ${res.status}`,
      raw,
    };
  }

  const callId = (raw as { call_id?: string })?.call_id;

  return {
    ok: true,
    provider: "retell",
    callId,
    message:
      (callId ? `Call queued with Retell (${callId}).` : "Call request accepted by Retell.") +
      " Note: Retell uses the prompt configured on its dashboard agent, not the script above.",
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
    if (typeof r.error_message === "string") return r.error_message;
    if (typeof r.message === "string") return r.message;
    if (typeof r.error === "string") return r.error;
  }
  return undefined;
}

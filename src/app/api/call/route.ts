import { NextResponse } from "next/server";
import type { PlaceCallRequest, PlaceCallResult, Provider } from "@/lib/types";
import { placeBlandCall } from "@/lib/bland";
import { placeElevenLabsCall } from "@/lib/elevenlabs";
import { placeVapiCall } from "@/lib/vapi";

export const runtime = "nodejs";

const PROVIDERS = new Set<Provider>(["bland", "elevenlabs", "vapi"]);

export async function POST(request: Request) {
  let payload: PlaceCallRequest;
  try {
    payload = (await request.json()) as PlaceCallRequest;
  } catch {
    return json({ ok: false, message: "Invalid JSON body." }, 400);
  }

  const { provider, phoneNumber, script } = payload ?? {};

  if (!PROVIDERS.has(provider)) {
    return json({ ok: false, message: "Unknown provider." }, 400);
  }
  if (!isValidPhone(phoneNumber)) {
    return json(
      {
        ok: false,
        provider,
        message: "Enter a phone number in E.164 format, e.g. +14155551234.",
      },
      400,
    );
  }
  if (!script || typeof script !== "object") {
    return json({ ok: false, provider, message: "Missing call script." }, 400);
  }

  if (provider === "bland") {
    const apiKey = process.env.BLAND_API_KEY;
    if (!apiKey) {
      return json(
        {
          ok: false,
          provider,
          message: "BLAND_API_KEY is not set on the server (.env.local).",
        },
        400,
      );
    }
    const result = await placeBlandCall(phoneNumber, script, apiKey);
    return json(result, result.ok ? 200 : 502);
  }

  if (provider === "elevenlabs") {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const agentId = process.env.ELEVENLABS_AGENT_ID;
    const agentPhoneNumberId = process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID;
    const missing = missingEnv({
      ELEVENLABS_API_KEY: apiKey,
      ELEVENLABS_AGENT_ID: agentId,
      ELEVENLABS_AGENT_PHONE_NUMBER_ID: agentPhoneNumberId,
    });
    if (missing) return json({ ok: false, provider, message: missing }, 400);
    const result = await placeElevenLabsCall(phoneNumber, script, {
      apiKey: apiKey!,
      agentId: agentId!,
      agentPhoneNumberId: agentPhoneNumberId!,
    });
    return json(result, result.ok ? 200 : 502);
  }

  if (provider === "vapi") {
    const apiKey = process.env.VAPI_API_KEY;
    const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
    const missing = missingEnv({
      VAPI_API_KEY: apiKey,
      VAPI_PHONE_NUMBER_ID: phoneNumberId,
    });
    if (missing) return json({ ok: false, provider, message: missing }, 400);
    const result = await placeVapiCall(phoneNumber, script, {
      apiKey: apiKey!,
      phoneNumberId: phoneNumberId!,
      modelProvider: process.env.VAPI_MODEL_PROVIDER || "openai",
      model: process.env.VAPI_MODEL || "gpt-4o",
    });
    return json(result, result.ok ? 200 : 502);
  }

  // Unreachable: provider was validated against PROVIDERS above.
  return json({ ok: false, provider, message: "Unknown provider." }, 400);
}

/** Returns an error message listing any blank env vars, or null if all set. */
function missingEnv(vars: Record<string, string | undefined>): string | null {
  const missing = Object.entries(vars)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  return missing.length
    ? `Missing server env: ${missing.join(", ")} (.env.local).`
    : null;
}

function json(body: Partial<PlaceCallResult> & { message: string }, status: number) {
  return NextResponse.json(body, { status });
}

/** Loose E.164 check: leading + and 8–15 digits. */
function isValidPhone(phone: unknown): phone is string {
  return typeof phone === "string" && /^\+[1-9]\d{7,14}$/.test(phone.trim());
}

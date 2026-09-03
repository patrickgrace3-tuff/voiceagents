"use client";

import { useMemo, useState } from "react";
import {
  EMPTY_SCRIPT,
  type BackgroundTrack,
  type CallScript,
  type PlaceCallResult,
  type Provider,
  type Responsiveness,
  type ScriptQuestion,
} from "@/lib/types";
import { compilePrompt } from "@/lib/prompt";

const PROVIDERS: { id: Provider; label: string; blurb: string }[] = [
  { id: "bland", label: "Bland.ai", blurb: "Self-contained · background noise" },
  { id: "vapi", label: "Vapi", blurb: "Inline assistant · background + latency" },
  { id: "elevenlabs", label: "ElevenLabs", blurb: "Via linked Twilio number" },
  { id: "openai", label: "OpenAI", blurb: "gpt-realtime speech-to-speech" },
];

const RESPONSIVENESS: { id: Responsiveness; label: string; hint: string }[] = [
  { id: "relaxed", label: "Relaxed", hint: "Waits longer, fewer interruptions" },
  { id: "balanced", label: "Balanced", hint: "Default" },
  { id: "snappy", label: "Snappy", hint: "Turbo model, lowest lag" },
];

const BACKGROUND: { id: BackgroundTrack; label: string }[] = [
  { id: "none", label: "None" },
  { id: "office", label: "Office / call center" },
  { id: "cafe", label: "Café" },
  { id: "restaurant", label: "Restaurant" },
];

/** Which providers apply which ambience, surfaced as an inline warning. */
function backgroundNote(provider: Provider, track: BackgroundTrack): string | null {
  if (track === "none") return null;
  switch (provider) {
    case "bland":
      return null; // full support
    case "vapi":
    case "openai":
      return track === "office"
        ? null
        : `Only an "office" ambience preset is available — "${track}" will be sent as off.`;
    case "elevenlabs":
      return "Background ambience isn't applied on ElevenLabs; it will be ignored.";
    default:
      return null;
  }
}

export default function CallBuilder() {
  const [provider, setProvider] = useState<Provider>("bland");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [script, setScript] = useState<CallScript>(EMPTY_SCRIPT);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<PlaceCallResult | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  const compiled = useMemo(() => compilePrompt(script), [script]);

  function patch(p: Partial<CallScript>) {
    setScript((s) => ({ ...s, ...p }));
  }

  function patchQuestion(id: string, p: Partial<ScriptQuestion>) {
    setScript((s) => ({
      ...s,
      questions: s.questions.map((q) => (q.id === id ? { ...q, ...p } : q)),
    }));
  }

  function addQuestion() {
    setScript((s) => ({
      ...s,
      questions: [
        ...s.questions,
        { id: `q${Date.now()}`, text: "", required: false },
      ],
    }));
  }

  function removeQuestion(id: string) {
    setScript((s) => ({
      ...s,
      questions: s.questions.filter((q) => q.id !== id),
    }));
  }

  async function sendCall() {
    setResult(null);
    setSending(true);
    try {
      const res = await fetch("/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, phoneNumber: phoneNumber.trim(), script }),
      });
      const data = (await res.json()) as PlaceCallResult;
      setResult(data);
    } catch (err) {
      setResult({
        ok: false,
        provider,
        message: `Request failed: ${(err as Error).message}`,
      });
    } finally {
      setSending(false);
    }
  }

  const phoneValid = /^\+[1-9]\d{7,14}$/.test(phoneNumber.trim());

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Voice Agent Test Bench</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Design one call script, then fire a live test to your phone across Bland.ai, Vapi, ElevenLabs and Open.ai.
        </p>
      </header>

      {/* Launch bar */}
      <div className="card mb-6 sticky top-4 z-10 backdrop-blur">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label">Provider</label>
              <div className="grid grid-cols-2 gap-2">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProvider(p.id)}
                    className={`rounded-lg border px-3 py-2 text-left transition ${
                      provider === p.id
                        ? "border-[var(--accent)] bg-[var(--accent)]/10"
                        : "border-[var(--border)] bg-[var(--panel-2)] hover:border-[var(--muted)]"
                    }`}
                  >
                    <div className="text-sm font-semibold">{p.label}</div>
                    <div className="text-[11px] leading-tight text-[var(--muted)]">{p.blurb}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="phone">
                Phone number to call (E.164)
              </label>
              <input
                id="phone"
                className="field-input"
                placeholder="+14155551234"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                inputMode="tel"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={sendCall}
            disabled={sending || !phoneValid}
            className="h-10 rounded-lg bg-[var(--accent)] px-6 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? "Calling…" : "Send test call"}
          </button>
        </div>

        {result && (
          <div
            className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
              result.ok
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                : "border-rose-500/40 bg-rose-500/10 text-rose-200"
            }`}
          >
            <span className="font-semibold">{result.ok ? "✓ " : "✗ "}</span>
            {result.message}
          </div>
        )}
      </div>

      {/* Builder grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: the conversation */}
        <section className="space-y-6">
          <div className="card">
            <div className="card-title">Agent identity</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label">Agent name</label>
                <input
                  className="field-input"
                  value={script.agentName}
                  onChange={(e) => patch({ agentName: e.target.value })}
                />
              </div>
              <div>
                <label className="field-label">Business name</label>
                <input
                  className="field-input"
                  value={script.businessName}
                  onChange={(e) => patch({ businessName: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="field-label">Objective</label>
              <textarea
                className="field-input min-h-[64px]"
                value={script.objective}
                onChange={(e) => patch({ objective: e.target.value })}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-title">Opening prompt</div>
            <label className="field-label">First thing the agent says</label>
            <textarea
              className="field-input min-h-[72px]"
              value={script.openingPrompt}
              onChange={(e) => patch({ openingPrompt: e.target.value })}
            />
          </div>

          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <div className="card-title mb-0">Questions</div>
              <button
                type="button"
                onClick={addQuestion}
                className="rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-2.5 py-1 text-xs font-medium hover:border-[var(--accent)]"
              >
                + Add question
              </button>
            </div>
            <div className="space-y-3">
              {script.questions.length === 0 && (
                <p className="text-sm text-[var(--muted)]">No questions yet.</p>
              )}
              {script.questions.map((q, i) => (
                <div key={q.id} className="flex items-start gap-2">
                  <span className="mt-2.5 w-5 text-right text-xs text-[var(--muted)]">{i + 1}.</span>
                  <div className="flex-1">
                    <input
                      className="field-input"
                      placeholder="What should the agent ask?"
                      value={q.text}
                      onChange={(e) => patchQuestion(q.id, { text: e.target.value })}
                    />
                    <label className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--muted)]">
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={(e) => patchQuestion(q.id, { required: e.target.checked })}
                      />
                      Required — don&apos;t move on without an answer
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeQuestion(q.id)}
                    className="mt-1.5 rounded-md px-2 py-1 text-xs text-[var(--muted)] hover:text-rose-300"
                    aria-label="Remove question"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Qualification &amp; next steps</div>
            <label className="field-label">Qualification criteria</label>
            <textarea
              className="field-input min-h-[56px]"
              value={script.qualificationCriteria}
              onChange={(e) => patch({ qualificationCriteria: e.target.value })}
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label">✓ If qualified</label>
                <textarea
                  className="field-input min-h-[96px]"
                  value={script.qualifiedNextSteps}
                  onChange={(e) => patch({ qualifiedNextSteps: e.target.value })}
                />
              </div>
              <div>
                <label className="field-label">✗ If not qualified</label>
                <textarea
                  className="field-input min-h-[96px]"
                  value={script.notQualifiedNextSteps}
                  onChange={(e) => patch({ notQualifiedNextSteps: e.target.value })}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Right: delivery + preview */}
        <section className="space-y-6">
          <div className="card">
            <div className="card-title">Delivery</div>
            <div className="grid gap-4">
              <div>
                <label className="field-label">
                  Voice ID{" "}
                  <span className="font-normal normal-case text-[var(--muted)]/70">
                    (optional — provider voice id)
                  </span>
                </label>
                <input
                  className="field-input"
                  placeholder={
                    provider === "bland"
                      ? "e.g. maya"
                      : provider === "openai"
                        ? "e.g. marin, cedar, alloy"
                        : "e.g. 21m00Tcm4TlvDq8ikWAM"
                  }
                  value={script.voice}
                  onChange={(e) => patch({ voice: e.target.value })}
                />
              </div>

              <div>
                <label className="field-label">Responsiveness (lag vs. patience)</label>
                <div className="grid grid-cols-3 gap-2">
                  {RESPONSIVENESS.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => patch({ responsiveness: r.id })}
                      className={`rounded-lg border px-2 py-2 text-center transition ${
                        script.responsiveness === r.id
                          ? "border-[var(--accent)] bg-[var(--accent)]/10"
                          : "border-[var(--border)] bg-[var(--panel-2)] hover:border-[var(--muted)]"
                      }`}
                    >
                      <div className="text-sm font-semibold">{r.label}</div>
                      <div className="text-[10px] leading-tight text-[var(--muted)]">{r.hint}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="field-label">Background ambience</label>
                <div className="grid grid-cols-2 gap-2">
                  {BACKGROUND.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => patch({ backgroundTrack: b.id })}
                      className={`rounded-lg border px-3 py-2 text-sm transition ${
                        script.backgroundTrack === b.id
                          ? "border-[var(--accent)] bg-[var(--accent)]/10"
                          : "border-[var(--border)] bg-[var(--panel-2)] hover:border-[var(--muted)]"
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
                {backgroundNote(provider, script.backgroundTrack) && (
                  <p className="mt-2 text-xs text-amber-300/80">
                    {backgroundNote(provider, script.backgroundTrack)}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <button
              type="button"
              onClick={() => setShowPrompt((v) => !v)}
              className="flex w-full items-center justify-between"
            >
              <span className="card-title mb-0">Compiled agent prompt</span>
              <span className="text-xs text-[var(--muted)]">{showPrompt ? "Hide" : "Show"}</span>
            </button>
            {showPrompt && (
              <pre className="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--background)] p-4 text-xs leading-relaxed text-[var(--muted)]">
                {compiled}
              </pre>
            )}
            {!showPrompt && (
              <p className="mt-3 text-xs text-[var(--muted)]">
                This is the exact instruction block sent to both providers — expand to review before calling.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

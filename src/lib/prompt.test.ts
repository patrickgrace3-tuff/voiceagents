import { test } from "node:test";
import assert from "node:assert/strict";
import { compilePrompt } from "./prompt.ts";
import { EMPTY_SCRIPT, type CallScript } from "./types.ts";

test("includes agent identity and objective", () => {
  const out = compilePrompt({
    ...EMPTY_SCRIPT,
    agentName: "Jamie",
    businessName: "Nimbus Roofing",
    objective: "Book a roof inspection.",
  });
  assert.match(out, /Jamie/);
  assert.match(out, /Nimbus Roofing/);
  assert.match(out, /Book a roof inspection\./);
});

test("numbers questions and flags required ones", () => {
  const script: CallScript = {
    ...EMPTY_SCRIPT,
    questions: [
      { id: "a", text: "Do you own your home?", required: true },
      { id: "b", text: "How old is your roof?", required: false },
    ],
  };
  const out = compilePrompt(script);
  assert.match(out, /1\. Do you own your home\?/);
  assert.match(out, /required — do not skip/);
  assert.match(out, /2\. How old is your roof\?/);
});

test("skips blank questions", () => {
  const out = compilePrompt({
    ...EMPTY_SCRIPT,
    questions: [
      { id: "a", text: "  ", required: false },
      { id: "b", text: "Real question?", required: false },
    ],
  });
  assert.match(out, /1\. Real question\?/);
  assert.doesNotMatch(out, /2\./);
});

test("renders both qualified and not-qualified branches", () => {
  const out = compilePrompt({
    ...EMPTY_SCRIPT,
    qualifiedNextSteps: "Book the demo.",
    notQualifiedNextSteps: "Thank and hang up.",
  });
  assert.match(out, /If they ARE qualified/);
  assert.match(out, /Book the demo\./);
  assert.match(out, /If they are NOT qualified/);
  assert.match(out, /Thank and hang up\./);
});

test("falls back gracefully on empty fields", () => {
  const out = compilePrompt({
    ...EMPTY_SCRIPT,
    agentName: "",
    businessName: "",
    objective: "",
    questions: [],
  });
  assert.match(out, /a friendly voice agent/);
  assert.match(out, /No specific questions/);
});

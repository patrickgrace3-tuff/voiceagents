import type { CallScript } from "./types";

/**
 * Compile a structured {@link CallScript} into a single system prompt.
 *
 * Both providers ultimately drive the LLM from one instruction block, so we
 * build a clear, sectioned prompt here and reuse it everywhere. Keeping this
 * in one place means the two providers are tested against the *same* agent
 * behaviour, which is the whole point of the bench.
 */
export function compilePrompt(script: CallScript): string {
  const {
    agentName,
    businessName,
    objective,
    questions,
    qualificationCriteria,
    qualifiedNextSteps,
    notQualifiedNextSteps,
  } = script;

  const questionLines = questions
    .filter((q) => q.text.trim().length > 0)
    .map((q, i) => `  ${i + 1}. ${q.text.trim()}${q.required ? "  (required — do not skip)" : ""}`)
    .join("\n");

  return [
    `# Role`,
    `You are ${orDefault(agentName, "a friendly voice agent")}, an AI phone agent calling on behalf of ${orDefault(
      businessName,
      "the business",
    )}. You are speaking with a person over the phone in real time.`,
    ``,
    `# Objective`,
    orDefault(objective, "Have a helpful, natural conversation with the person."),
    ``,
    `# How to speak`,
    `- Sound warm, human, and unhurried. Use short, natural sentences.`,
    `- One question or idea at a time. Never read a list out loud.`,
    `- Listen to the answer before moving on. Acknowledge what they say.`,
    `- If they're busy, offer to be quick or to call back — respect their time.`,
    `- Never say you're an AI unless directly asked. Do not invent facts.`,
    ``,
    `# Questions to work through`,
    questionLines.length > 0
      ? `Ask these naturally, in order, weaving them into the conversation:\n${questionLines}`
      : `(No specific questions — keep the conversation on objective.)`,
    ``,
    `# Qualification`,
    `A person is QUALIFIED when: ${orDefault(qualificationCriteria, "they express clear interest.")}`,
    ``,
    `## If they ARE qualified`,
    orDefault(qualifiedNextSteps, "Move them toward the next step and confirm the details."),
    ``,
    `## If they are NOT qualified`,
    orDefault(notQualifiedNextSteps, "Thank them politely and end the call warmly."),
    ``,
    `# Ending the call`,
    `Once the objective is met or the person wants to go, thank them by ${orDefault(
      businessName,
      "the business",
    )} and end the call politely.`,
  ].join("\n");
}

function orDefault(value: string, fallback: string): string {
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

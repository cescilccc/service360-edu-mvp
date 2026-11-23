// AI triage — the core AI feature.
// Reads a free-text complaint + meeting impact + room context and returns a
// structured, schema-validated triage. ALWAYS returns a valid result: on any
// model/schema failure it uses a deterministic fallback, so a ticket is never
// blocked by the AI.

import { z } from "zod";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import {
  ISSUE_TYPES,
  PRIORITIES,
  type IssueType,
  type MeetingImpact,
} from "./enums";
import { IMPACT_TO_PRIORITY } from "./sla-policy";

export const TriageResultSchema = z.object({
  issueType: z.enum(ISSUE_TYPES),
  suggestedPriority: z.enum(PRIORITIES),
  likelyCause: z.string().min(1).max(300),
  recurringIssue: z.boolean(),
  reasoning: z.string().min(1).max(400),
});
export type TriageResult = z.infer<typeof TriageResultSchema>;

export type TriageSource = "ai" | "fallback";

/** Triage result annotated with its source, set by the server (not the model). */
export interface TriagedResult extends TriageResult {
  source: TriageSource;
}

export interface TriageInput {
  issueTypeHint?: IssueType | null;
  description: string;
  meetingImpact: MeetingImpact;
  room: {
    name: string;
    roomType: string;
    assets: { brand: string | null; model: string | null }[];
  };
}

// Current, cost-appropriate default (Claude 5.x generation). Override with
// ANTHROPIC_MODEL. Haiku keeps per-triage cost low; use a Sonnet id for higher
// quality if desired.
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5";
const TIMEOUT_MS = 12_000;

const SYSTEM_PROMPT = `You triage audio-visual (AV) support issues for a managed-services team.
Classify the reported problem and set a priority using this SLA:
- P1 Critical: a live meeting is affected now, or a boardroom is fully down. Response 30 min, resolve in 4 hours.
- P2 High: a meeting starts within the hour, or major function lost. Response 1 hour, resolve in 8 business hours.
- P3 Medium: degraded but usable, meeting later today. Response 4 business hours, resolve in 2 business days.
- P4 Low: minor or cosmetic, no meeting impact. Response 1 business day, resolve in 3-5 business days.
Weigh the reporter's meeting-impact answer heavily when choosing priority.
Return concise, single-sentence likelyCause and reasoning. Set recurringIssue only if the text strongly implies a repeat fault.`;

function buildPrompt(input: TriageInput): string {
  const assets = input.room.assets
    .map((a) => [a.brand, a.model].filter(Boolean).join(" "))
    .filter(Boolean)
    .join(", ");
  return [
    `Room: ${input.room.name} (${input.room.roomType}).`,
    assets ? `Installed equipment: ${assets}.` : "",
    input.issueTypeHint ? `Reporter-selected issue type: ${input.issueTypeHint}.` : "",
    `Meeting impact: ${input.meetingImpact}.`,
    `Reporter description: "${input.description}"`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function fallbackTriage(input: TriageInput): TriagedResult {
  return {
    issueType: input.issueTypeHint ?? "OTHER",
    suggestedPriority: IMPACT_TO_PRIORITY[input.meetingImpact],
    likelyCause: "Automated triage unavailable; priority set by meeting impact.",
    recurringIssue: false,
    reasoning: "Fallback triage used (AI unavailable).",
    source: "fallback",
  };
}

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("triage timeout")), ms)
  );
}

export async function triage(input: TriageInput): Promise<TriagedResult> {
  if (!process.env.ANTHROPIC_API_KEY) return fallbackTriage(input);
  try {
    const result = (await Promise.race([
      generateObject({
        model: anthropic(MODEL),
        schema: TriageResultSchema,
        system: SYSTEM_PROMPT,
        prompt: buildPrompt(input),
        temperature: 0.1,
        maxTokens: 400, // cost control: triage output is small and structured
      }),
      timeout(TIMEOUT_MS),
    ])) as { object: unknown };
    const object = TriageResultSchema.parse(result.object);
    return { ...object, source: "ai" };
  } catch {
    return fallbackTriage(input);
  }
}

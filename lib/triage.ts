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

// --- Sanitized fallback diagnostics -----------------------------------------
// The classifier reads the provider message/body IN MEMORY only to map it to a
// bounded token from an explicit allowlist. It NEVER logs raw provider messages,
// response bodies, headers, request bodies, prompts, API keys, or personal data.

// Allowlist of Anthropic error categories we are willing to log verbatim. Any
// value outside this set is logged as "other".
const ALLOWED_ERROR_CATEGORIES = new Set<string>([
  "invalid_request_error",
  "authentication_error",
  "permission_error",
  "not_found_error",
  "request_too_large",
  "rate_limit_error",
  "api_error",
  "overloaded_error",
  "billing_error",
]);

// Ordered allowlist of parameter labels and the substrings that map to each.
// Only the label (left side) is ever logged — never the matched text.
const PARAM_CLASSIFIERS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["temperature", ["temperature"]],
  ["top_p", ["top_p"]],
  ["top_k", ["top_k"]],
  ["tool_choice", ["tool_choice", "forced tool"]],
  ["max_tokens", ["max_tokens"]],
  ["thinking", ["thinking", "effort"]],
  ["api_version", ["anthropic-version", "api version"]],
  ["model", ["model:", "not found", "does not exist"]],
];

type FallbackReason =
  | "api_400"
  | "api_other"
  | "timeout"
  | "no_object"
  | "unknown";

interface ClassifiedError {
  reason: FallbackReason;
  statusCode?: number;
  category: string; // allowlisted Anthropic category, else "other"
  rejectedParam: string; // allowlisted param label, else "unclassified"
}

function classifyTriageError(err: unknown): ClassifiedError {
  // Our own timeout error — a fixed constant string matched to a bounded label.
  if (err instanceof Error && err.message === "triage timeout") {
    return { reason: "timeout", category: "n/a", rejectedParam: "n/a" };
  }

  const e = err as {
    name?: string;
    statusCode?: number;
    responseBody?: string;
    data?: { error?: { type?: string; message?: string } };
  };

  // Read message/body IN MEMORY only to classify; neither is ever logged.
  const haystack = (
    e?.data?.error?.message ??
    e?.responseBody ??
    ""
  ).toLowerCase();

  const rawType = e?.data?.error?.type ?? "";
  const category = ALLOWED_ERROR_CATEGORIES.has(rawType) ? rawType : "other";

  let rejectedParam = "unclassified";
  for (const [label, needles] of PARAM_CLASSIFIERS) {
    if (needles.some((n) => haystack.includes(n))) {
      rejectedParam = label;
      break;
    }
  }

  let reason: FallbackReason = "unknown";
  if (e?.statusCode === 400) reason = "api_400";
  else if (typeof e?.statusCode === "number") reason = "api_other";
  else if (e?.name === "AI_NoObjectGeneratedError") reason = "no_object";

  return { reason, statusCode: e?.statusCode, category, rejectedParam };
}

/**
 * Logs ONLY bounded, allowlisted tokens describing why the AI path fell back:
 * the configured model id, a reason enum, the HTTP status code, an allowlisted
 * error category, and an allowlisted rejected-parameter label. No raw provider
 * message/body/headers, request body, prompt, key, or personal data is logged.
 */
function logTriageFallback(err: unknown): void {
  const c = classifyTriageError(err);
  console.error("[triage] AI path failed → fallback", {
    model: MODEL, // our own constant model id
    reason: c.reason, // bounded enum
    statusCode: c.statusCode, // number | undefined
    category: c.category, // allowlisted, else "other"
    rejectedParam: c.rejectedParam, // allowlisted, else "unclassified"
    timeoutMs: TIMEOUT_MS, // constant
  });
}

export async function triage(input: TriageInput): Promise<TriagedResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[triage] ANTHROPIC_API_KEY not set in this runtime → fallback");
    return fallbackTriage(input);
  }
  try {
    const result = (await Promise.race([
      generateObject({
        model: anthropic(MODEL),
        schema: TriageResultSchema,
        system: SYSTEM_PROMPT,
        prompt: buildPrompt(input),
        // No `temperature` / `top_p` / `top_k`: Claude 5.x models reject
        // non-default sampling params with HTTP 400. Determinism comes from the
        // forced-tool structured output and the bounded schema.
        maxTokens: 400, // cost control: triage output is small and structured
      }),
      timeout(TIMEOUT_MS),
    ])) as { object: unknown };
    const object = TriageResultSchema.parse(result.object);
    return { ...object, source: "ai" };
  } catch (err) {
    logTriageFallback(err);
    return fallbackTriage(input);
  }
}

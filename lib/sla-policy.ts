// SLA policy — ILLUSTRATIVE example values for an academic demo.
// These tiers are a common industry-style example, NOT a real client's SLA.
// Kept as configurable data; in a real deployment they would come from a
// signed SLA and move to a DB table.

import type { Priority, MeetingImpact } from "./enums";

export type ClockBasis = "CALENDAR" | "BUSINESS";

export interface SlaRule {
  responseMinutes: number;
  resolutionMinutes: number;
  clock: ClockBasis;
}

// Deterministic single values (any range is encoded to one value so deadlines
// are exactly testable). Minutes. ILLUSTRATIVE ONLY.
export const SLA_POLICY: Record<Priority, SlaRule> = {
  P1: { responseMinutes: 30, resolutionMinutes: 4 * 60, clock: "CALENDAR" },
  P2: { responseMinutes: 60, resolutionMinutes: 8 * 60, clock: "BUSINESS" },
  P3: {
    responseMinutes: 4 * 60,
    resolutionMinutes: 2 * 8 * 60, // 2 business days
    clock: "BUSINESS",
  },
  P4: {
    responseMinutes: 1 * 8 * 60, // 1 business day response
    resolutionMinutes: 5 * 8 * 60, // 5 business days
    clock: "BUSINESS",
  },
};

// Illustrative support coverage: Mon–Fri, 09:00–18:00. Timezone is a demo
// setting, not client-identifying.
export const COVERAGE = {
  timezone: "Asia/Manila",
  utcOffsetMinutes: 8 * 60, // UTC+8, no DST
  startHour: 9,
  endHour: 18,
  workDays: [1, 2, 3, 4, 5], // Mon–Fri (0 = Sun)
} as const;

export const AT_RISK_THRESHOLD = 0.75; // ≥75% of resolution window elapsed

// Deterministic fallback mapping when AI triage is unavailable.
export const IMPACT_TO_PRIORITY: Record<MeetingImpact, Priority> = {
  LIVE_NOW: "P1",
  WITHIN_HOUR: "P2",
  TODAY: "P3",
  NONE: "P4",
};

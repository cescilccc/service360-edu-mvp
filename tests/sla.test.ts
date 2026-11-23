import { describe, it, expect } from "vitest";
import {
  addBusinessMinutes,
  computeDeadlines,
  computeSlaState,
} from "../lib/sla";

// Manila is UTC+8. 2026-01-05 is a Monday; 09:00 Manila = 01:00 UTC.
const monday0900Utc = new Date("2026-01-05T01:00:00Z");

describe("computeDeadlines", () => {
  it("P1 uses a wall-clock: 30 min response, 4 h resolution", () => {
    const d = computeDeadlines("P1", monday0900Utc);
    expect(d.responseDueAt.toISOString()).toBe("2026-01-05T01:30:00.000Z");
    expect(d.resolutionDueAt.toISOString()).toBe("2026-01-05T05:00:00.000Z");
  });

  it("P2 resolution (8 business hours) from Mon 09:00 lands Mon 17:00 Manila", () => {
    const d = computeDeadlines("P2", monday0900Utc);
    expect(d.resolutionDueAt.toISOString()).toBe("2026-01-05T09:00:00.000Z");
  });

  it("business clock rolls over the overnight boundary", () => {
    // Mon 17:30 Manila = 09:30 UTC. +1 business hour -> Tue 09:30 Manila = Tue 01:30 UTC.
    const lateMon = new Date("2026-01-05T09:30:00Z");
    const d = computeDeadlines("P2", lateMon);
    expect(d.responseDueAt.toISOString()).toBe("2026-01-06T01:30:00.000Z");
  });

  it("business clock skips the weekend", () => {
    // Fri 17:00 Manila = 09:00 UTC (2026-01-09). +2 business hours -> Mon 10:00 Manila = Mon 02:00 UTC (2026-01-12).
    const friEod = new Date("2026-01-09T09:00:00Z");
    expect(addBusinessMinutes(friEod, 120).toISOString()).toBe(
      "2026-01-12T02:00:00.000Z"
    );
  });
});

describe("computeSlaState", () => {
  const base = {
    createdAt: new Date("2026-01-05T00:00:00Z"),
    resolutionDueAt: new Date("2026-01-05T04:00:00Z"), // 4-hour window
  };

  it("is ON_TRACK early in the window", () => {
    expect(computeSlaState(new Date("2026-01-05T01:00:00Z"), base)).toBe(
      "ON_TRACK"
    );
  });

  it("is AT_RISK at >= 75% elapsed", () => {
    expect(computeSlaState(new Date("2026-01-05T03:00:00Z"), base)).toBe(
      "AT_RISK"
    );
  });

  it("is BREACHED past due and unresolved", () => {
    expect(computeSlaState(new Date("2026-01-05T05:00:00Z"), base)).toBe(
      "BREACHED"
    );
  });

  it("is never BREACHED once resolved", () => {
    expect(
      computeSlaState(new Date("2026-01-05T05:00:00Z"), {
        ...base,
        resolvedAt: new Date("2026-01-05T03:00:00Z"),
      })
    ).toBe("ON_TRACK");
  });
});

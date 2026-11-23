import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the AI SDK so no live calls happen in CI.
vi.mock("@ai-sdk/anthropic", () => ({ anthropic: () => "mock-model" }));
const generateObject = vi.fn();
vi.mock("ai", () => ({
  generateObject: (...args: unknown[]) => generateObject(...args),
}));

import {
  TriageResultSchema,
  fallbackTriage,
  triage,
  type TriageInput,
} from "../lib/triage";

const baseInput: TriageInput = {
  description: "No sound from the ceiling speakers during our call",
  meetingImpact: "LIVE_NOW",
  room: { name: "10F Boardroom", roomType: "BOARDROOM", assets: [] },
};

describe("TriageResultSchema", () => {
  it("parses a valid result", () => {
    const parsed = TriageResultSchema.safeParse({
      issueType: "NO_AUDIO",
      suggestedPriority: "P1",
      likelyCause: "DSP muted or amp offline",
      recurringIssue: false,
      reasoning: "Live meeting with no audio",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a malformed result", () => {
    const parsed = TriageResultSchema.safeParse({
      issueType: "NOT_A_TYPE",
      suggestedPriority: "P9",
      recurringIssue: "nope",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("fallbackTriage", () => {
  it("maps meeting impact to priority deterministically", () => {
    expect(
      fallbackTriage({ ...baseInput, meetingImpact: "LIVE_NOW" })
        .suggestedPriority
    ).toBe("P1");
    expect(
      fallbackTriage({ ...baseInput, meetingImpact: "WITHIN_HOUR" })
        .suggestedPriority
    ).toBe("P2");
    expect(
      fallbackTriage({ ...baseInput, meetingImpact: "NONE" }).suggestedPriority
    ).toBe("P4");
  });
});

describe("triage()", () => {
  beforeEach(() => generateObject.mockReset());

  it("falls back when the model call throws", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    generateObject.mockRejectedValueOnce(new Error("boom"));
    const r = await triage({ ...baseInput, meetingImpact: "WITHIN_HOUR" });
    expect(r.suggestedPriority).toBe("P2");
    expect(r.reasoning).toContain("Fallback");
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("returns the model result when it is valid", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    generateObject.mockResolvedValueOnce({
      object: {
        issueType: "NO_AUDIO",
        suggestedPriority: "P1",
        likelyCause: "DSP muted",
        recurringIssue: false,
        reasoning: "Live meeting, no audio",
      },
    });
    const r = await triage(baseInput);
    expect(r.issueType).toBe("NO_AUDIO");
    expect(r.suggestedPriority).toBe("P1");
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("uses fallback when no API key is configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const r = await triage(baseInput);
    expect(r.suggestedPriority).toBe("P1"); // LIVE_NOW
    expect(generateObject).not.toHaveBeenCalled();
  });
});

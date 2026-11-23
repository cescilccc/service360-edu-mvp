"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ISSUE_TYPES,
  ISSUE_TYPE_LABELS,
  MEETING_IMPACTS,
  MEETING_IMPACT_LABELS,
  type IssueType,
  type MeetingImpact,
} from "@/lib/enums";

export function ReportForm({ roomToken }: { roomToken: string }) {
  const router = useRouter();
  const [issueTypeHint, setIssueTypeHint] = useState<IssueType | "">("");
  const [description, setDescription] = useState("");
  const [meetingImpact, setMeetingImpact] = useState<MeetingImpact | "">("");
  const [reporterName, setReporterName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    description.trim().length >= 3 && meetingImpact !== "" && !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomToken,
          issueTypeHint: issueTypeHint || null,
          description: description.trim(),
          meetingImpact,
          reporterName: reporterName.trim() || null,
        }),
      });
      if (!res.ok) {
        setError("Could not submit. Please try again.");
        setSubmitting(false);
        return;
      }
      const data = (await res.json()) as { ticketNumber: string };
      router.push(`/report/success?ticket=${encodeURIComponent(data.ticketNumber)}`);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-5">
      <div>
        <label className="block text-sm font-medium">What&apos;s wrong?</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {ISSUE_TYPES.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setIssueTypeHint(issueTypeHint === t ? "" : t)}
              className={`rounded-full border px-3 py-1 text-sm ${
                issueTypeHint === t
                  ? "border-brand bg-brand text-white"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              {ISSUE_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="desc" className="block text-sm font-medium">
          Describe the problem <span className="text-red-500">*</span>
        </label>
        <textarea
          id="desc"
          required
          minLength={3}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
          placeholder="e.g. The main display stays black when we connect HDMI."
        />
      </div>

      <div>
        <label className="block text-sm font-medium">
          Is a meeting affected? <span className="text-red-500">*</span>
        </label>
        <div className="mt-2 space-y-2">
          {MEETING_IMPACTS.map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="impact"
                value={m}
                checked={meetingImpact === m}
                onChange={() => setMeetingImpact(m)}
              />
              {MEETING_IMPACT_LABELS[m]}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          Your name (optional)
        </label>
        <input
          id="name"
          value={reporterName}
          onChange={(e) => setReporterName(e.target.value)}
          maxLength={120}
          className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit report"}
      </button>
    </form>
  );
}

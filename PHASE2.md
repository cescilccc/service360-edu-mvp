# Phase 2 — Spec and Architecture (summary)

Project: **Service360 (Academic Demo)** — an AV-native service desk with AI triage.

The assignment lists five Phase 2 deliverables. All five are complete.

| # | Assignment requirement | Deliverable | What it contains |
|---|---|---|---|
| 1 | Create architecture notes | `ARCHITECTURE.md` | System-context diagram, components, MVP data model, AI triage flow, SLA engine, deploy + security design. |
| 2 | Write spec.md | `spec.md` | Scope, user stories, data model, illustrative P1–P4 SLA rules, AI triage spec (with fallback), API routes, pages, 3 unit tests, env vars, acceptance criteria. |
| 3 | Create CLAUDE.md or agents.md | `CLAUDE.md` | Project overview, stack, commands, conventions, file layout, guardrails for the AI coding assistant. |
| 4 | Create .cursorrules | `.cursorrules` | The same hard rules, condensed for Cursor. |
| 5 | Revise the spec after review | `spec.md` §15 | Adversarial self-review with six revisions applied (see below). |

## Revisions applied after review (requirement 5)

1. SLA state made **computed at read time**, not stored — removes the need for a background job in the MVP.
2. **Mandatory AI fallback** added — `meetingImpact → priority`, so a ticket never fails to create if the AI is down.
3. SLA ranges encoded to **single deterministic values** (P1 response 30 min, P4 resolution 5 business days) so deadlines are exactly testable.
4. Issue type constrained to a **bounded enum** mapped to the covered AV systems.
5. Seed **cut to 3 rooms** (from a larger fictional estate) — enough variety to demo without over-scoping.
6. Reporter **auth removed** — public reporting path; only the coordinator view is auth-gated.

## Evidence to show for grading

- `spec.md` (note §15, which proves the "revise after review" step)
- `ARCHITECTURE.md`

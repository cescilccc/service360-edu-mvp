# Service360 (Academic Demo) — Build Spec

**One-liner:** An AV-native service desk where a client scans a room QR, describes a problem in plain words, and AI instantly classifies it and sets the right SLA priority — before a human touches it.

This spec is the **vertical slice** for the Week 4 mini-project, trimmed from the full Service360 platform concept. It uses fictional demonstration data only. Build exactly this; everything else is v2 (see §12).

> Build order: follow §11. Keep the app runnable and demoable at each step. Do not deploy or touch any live service until the build owner says so.

---

## 1. Goal & scope

Ship a live web app that does one thing end-to-end and does it well:

**Scan room QR → report issue → AI triage → ticket with live SLA timer → coordinator dashboard.**

In scope: QR-initiated public reporting, AI triage, SLA deadline computation + live status, a coordinator dashboard with auth, seed data from 3 fictional demo rooms.

Out of scope (v2): full asset register, engineer mobile app, preventive maintenance, spares, OEM cases, escalation automation, auto-generated monthly reports, multi-client, notifications.

---

## 2. Users & roles

- **Reporter** (client meeting host) — no login. Scans the QR and submits a report. May optionally leave a name/contact.
- **Coordinator** (AV support team) — authenticated. Sees the ticket list and SLA board, confirms or overrides the AI's priority, and moves ticket status.

---

## 3. User stories (acceptance-level)

1. As a reporter, when I scan a room's QR code, the report form opens with the site, floor, and room already identified — I never type the location.
2. As a reporter, I can pick an issue type, describe the problem, optionally attach a photo, and say whether a meeting is affected, then submit in under a minute.
3. As a reporter, on submit I get a ticket number and a confirmation screen.
4. As the system, on every submission I call AI triage to get an issue type, a suggested P1–P4 priority, a likely cause, and a recurring-issue flag — and I still create the ticket even if the AI call fails.
5. As the system, I set response and resolution deadlines from the priority using the real SLA rules.
6. As a coordinator, I log in and see all tickets with their live SLA state (On Track / At Risk / Breached), newest and most urgent first.
7. As a coordinator, I can accept the AI's suggested priority or override it, and I can move a ticket's status.

---

## 4. Tech stack (fixed for this project)

- **Framework:** Next.js 14 (App Router) + TypeScript.
- **UI:** Tailwind CSS (+ a few headless components as needed). Mobile-first — reporters are on phones.
- **DB + Auth:** Supabase (Postgres + Supabase Auth, email/password for the coordinator).
- **AI:** Vercel AI SDK (`ai` + `@ai-sdk/anthropic`), model Claude, called server-side with `generateObject`.
- **Validation:** zod (API input + AI output schema).
- **Deploy/CI:** Vercel + GitHub Actions.
- **Tests:** Vitest.

Pin exact versions in `package.json`. Do not call any LLM from the browser.

---

## 5. Data model

See ARCHITECTURE.md §3 for the diagram. Tables: `site`, `room`, `asset`, `ticket`. Provide the schema as a Supabase migration (`supabase/migrations/0001_init.sql`) and a seed script (`supabase/seed.sql` or `scripts/seed.ts`).

`ticket` fields the app must persist: `ticket_number`, `room_id`, `asset_id?`, `reporter_name?`, `reporter_contact?`, `source='QR'`, `issue_type`, `description`, `photo_url?`, `meeting_impact`, `priority`, `ai_suggested_priority`, `ai_suggested_issue_type`, `ai_likely_cause`, `ai_recurring_flag`, `ai_reasoning`, `status`, `created_at`, `response_due_at`, `resolution_due_at`, `responded_at?`, `resolved_at?`.

`ticket_number` format: `SR-YYYY-NNNNNN` (year + zero-padded sequence). It is generated **atomically by a Postgres sequence** used as the column default (see the migration), not counted in the app — so simultaneous submissions never collide.

### Enums

- `room_type`: `BOARDROOM | TRAINING_ROOM | MEETING_ROOM`
- `meeting_impact`: `LIVE_NOW | WITHIN_HOUR | TODAY | NONE`
- `priority`: `P1 | P2 | P3 | P4`
- `status`: `NEW | TRIAGED | IN_PROGRESS | RESOLVED | CLOSED`
- `issue_type` (picklist, maps to covered AV systems): `NO_DISPLAY | NO_AUDIO | CANT_JOIN_CALL | CAMERA_ISSUE | CONTENT_SHARING | TOUCH_PANEL | MIC_ISSUE | OTHER`

---

## 6. SLA rules (embed exactly)

Illustrative example SLA tiers (not a real client's SLA). Keep in one module `lib/sla-policy.ts` as a constant so it reads as configurable data.

| Priority | Response | Resolution | Clock |
|---|---|---|---|
| P1 — Critical | 30 min | 4 hours | calendar |
| P2 — High | 1 hour | 8 business hours | business |
| P3 — Medium | 4 business hours | 2 business days | business |
| P4 — Low | 1 business day | 5 business days | business |

**Business hours:** Mon–Fri, 09:00–18:00, `Asia/Manila`. Business-clock deadlines skip nights and weekends. P1 is wall-clock.

Functions in `lib/sla.ts` (pure, no I/O):

- `computeDeadlines(priority, createdAt): { responseDueAt, resolutionDueAt }`
- `computeSlaState(now, ticket): 'ON_TRACK' | 'AT_RISK' | 'BREACHED'`
  - `BREACHED` = `now > resolution_due_at` and not resolved.
  - `AT_RISK` = ≥75% of the resolution window elapsed and not resolved.
  - else `ON_TRACK` (or resolved).

---

## 7. AI triage spec

Module `lib/triage.ts`, function `triage(input): TriageResult`.

**Input:** `{ issueTypeHint?, description, meetingImpact, room: { name, roomType, assets: {brand, model}[] } }`

**Output schema (zod `TriageResult`):**

```ts
{
  issueType: IssueType,            // one of the issue_type enum
  suggestedPriority: 'P1'|'P2'|'P3'|'P4',
  likelyCause: string,             // one concise sentence
  recurringIssue: boolean,         // best-effort guess from context
  reasoning: string                // one concise sentence, for the coordinator
}
```

**Implementation:** `generateObject` (Vercel AI SDK) with the zod schema, a system prompt that includes the SLA table from §6 and instructs the model to weigh `meetingImpact` heavily for priority, and the room/asset context. Temperature low.

**Fallback (required):** wrap the call in try/catch with a timeout. On any failure or schema-parse error, return a deterministic result: `issueType = issueTypeHint ?? 'OTHER'`, `suggestedPriority` from `meetingImpact` (`LIVE_NOW→P1, WITHIN_HOUR→P2, TODAY→P3, NONE→P4`), `likelyCause = 'Automated triage unavailable; set by meeting impact.'`, `recurringIssue = false`. A ticket must never fail to create because of the AI.

The chosen `priority` stored on the ticket = the AI's `suggestedPriority` at creation; the coordinator can override later.

---

## 8. API routes

- `POST /api/report` — **public**. Body validated by zod: `{ roomToken, issueTypeHint?, description, meetingImpact, reporterName?, reporterContact?, photoUrl? }`. Resolve room by `qr_token`; run `triage`; `computeDeadlines`; insert ticket with the service role key; return `{ ticketNumber }`. Reject unknown token (404) and invalid body (400).
- `GET /api/tickets` — **auth**. Returns tickets with a computed `slaState` for each. Supports basic sort (urgency, then newest).
- `PATCH /api/tickets/:id` — **auth**. Allows updating `priority` (recomputes deadlines) and `status` (sets `responded_at` on first move off `NEW`, `resolved_at` on `RESOLVED`).

All server-side. Never expose the service role key or Anthropic key to the client.

**Abuse protection (public `POST /api/report`).** A best-effort in-memory rate limit (per IP, fixed window) runs **before** any AI call, returning `429` with `Retry-After` when exceeded — this caps AI-cost exposure from bursts or loops. Inputs are zod-validated and length-capped (description ≤ 1000 chars), enums are bounded, and the AI call has a timeout + deterministic fallback. Note: in-memory limiting is per serverless instance; production should use a shared store (Upstash/Vercel KV) plus a hard spend cap on the Anthropic account.

---

## 9. Pages / UI

- `/report?room=<token>` — public report form. Shows the resolved room header (site · floor · room). Fields: issue type (chips), description (required, length-capped), photo (optional), meeting impact (required). Submit → calls `/api/report`.
- `/report/success?ticket=<number>` — confirmation with the ticket number and a line on what happens next.
- `/login` — Supabase email/password sign-in for the coordinator.
- `/dashboard` — auth-gated. Ticket table + an SLA board summarising counts by state (On Track / At Risk / Breached) and by priority. Row actions: change priority, change status. Each row shows room, issue type, priority (with an "AI suggested" marker if unchanged), SLA state, age.

Keep styling clean and mobile-first for `/report`. Dashboard can be desktop-oriented.

---

## 10. Testing (≥3 unit tests, Vitest)

1. **SLA deadlines** — `computeDeadlines` returns correct response/resolution timestamps for each of P1–P4, including a business-hours case that correctly skips an overnight/weekend boundary.
2. **SLA state transitions** — `computeSlaState` returns `ON_TRACK`, `AT_RISK` (≥75% elapsed), and `BREACHED` (past due, unresolved) for crafted inputs, and never `BREACHED` once `resolved_at` is set.
3. **AI triage schema + fallback** — the zod `TriageResult` parses a valid sample and rejects a malformed one; and `triage` returns the deterministic fallback (correct `meetingImpact → priority`) when the model call is mocked to throw.

Mock the LLM in tests — no live API calls in CI.

---

## 11. Build order (keep runnable at each step; ≥5 meaningful commits)

1. **Scaffold** — Next.js 14 + TS + Tailwind; `lib/sla-policy.ts`, `lib/sla.ts`; Vitest set up. *(commit)*
2. **Data** — Supabase migration + seed (3 rooms, below); Supabase client wiring; `.env.example`. *(commit)*
3. **Report flow** — `/report` page + `POST /api/report` with SLA deadlines (AI stubbed). End-to-end ticket creation works. *(commit)*
4. **AI triage** — `lib/triage.ts` with `generateObject` + schema + fallback; wire into `/api/report`. *(commit)*
5. **Dashboard + auth** — `/login`, `/dashboard`, `GET/PATCH /api/tickets`, computed SLA state + board. *(commit)*
6. **Tests + polish** — the 3 unit tests, input validation, empty/error states, README. *(commit)*

### Seed data (3 fictional demo rooms)

- **GX-TOWER — Globex HQ Tower — Summit Boardroom** (`BOARDROOM`): Vistra `VV-65UHD` 65" display ×2; Acoustix `CV-200` conferencing bar; OptiCam `PTZ-4K` camera; Acoustix `CM-360` ceiling mic; Acoustix `DSP-440` processor.
- **GX-RIVER — Globex Riverside Campus — Horizon Training Room** (`TRAINING_ROOM`): Vistra `VV-86UHD` 86" display; Acoustix `AMP-120` amp; Acoustix `SP-20` speakers ×4; ConnectPro `BYOD-10` adapter.
- **GX-NORTH — Globex Northgate Office — Aspen Meeting Room** (`MEETING_ROOM`): Vistra `VV-55UHD` 55" display; Acoustix `CV-100` conferencing bar.

All names, codes, and equipment above are invented for this demo.

Generate a stable `qr_token` per room and print the QR deep-link `/, /report?room=<token>` for the demo.

---

## 12. v2 roadmap (explicitly not built now)

Full Client→Site→Building→Floor→Room→AvSystem→Equipment asset register; engineer mobile PWA (accept job, scan asset, checklist, photos, sign-off); preventive maintenance schedules; spares inventory; OEM cases; auto + manual escalations; auto-generated Monthly SLA Report; manager KPI dashboard; notifications; multi-client. Captured as the "v2 improvement" GitHub issue required by Phase 5. Source: the full Service360 platform concept.

---

## 13. Environment variables

`.env.example` (names only, never values):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server only
ANTHROPIC_API_KEY=              # server only
```

Never commit real values. `SUPABASE_SERVICE_ROLE_KEY` and `ANTHROPIC_API_KEY` are used only in server route handlers.

---

## 14. Acceptance criteria (definition of done)

- Live URL works in incognito; scanning/opening a seeded room's QR opens a pre-identified report form.
- Submitting creates a ticket with a number, an AI-suggested priority, and SLA deadlines; it still works if the AI is down (fallback).
- Coordinator can log in, see live SLA state, and override priority/status.
- `≥3` Vitest tests pass in GitHub Actions; lint, typecheck, and build pass.
- No secrets in the repo or client bundle; `.env.example` documents names only.
- README covers setup, env vars, run, test, and deploy; a 2-minute demo exists; a v2 GitHub issue is filed.

---

## 15. Spec review & revisions (adversarial pass)

Reviewed against "is this truly buildable in the mini-project window, and does it meet every course constraint?" Revisions applied to this spec:

1. **SLA state made computed, not stored** — removed the need for a background job in the MVP (the earlier full spec assumed an always-on evaluator). Keeps the slice shippable; v2 re-adds the scheduler for proactive alerts.
2. **Mandatory AI fallback added** — a deterministic `meetingImpact → priority` path so the AI is never on the critical path for ticket creation. Protects reliability and the live-demo.
3. **P1 response encoded at 30 min** (not the 15–30 range) and P4 resolution at 5 business days — ranges turned into single deterministic values so the SLA functions are testable with exact expected timestamps.
4. **Issue-type picklist constrained to an enum** mapped to the covered AV systems — keeps AI output bounded and the test assertions exact.
5. **Seed cut to 3 rooms** (from a larger fictional estate) — enough variety (two room types, varied equipment) to demo recurring-issue context without over-scoping data entry.
6. **Reporter auth removed** — public report path (no login) reduces friction and matches the differentiator; only the coordinator view is auth-gated.

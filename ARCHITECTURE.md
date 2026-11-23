# Service360 (Academic Demo) — Architecture Notes

Phase 2 deliverable. Scope is the **vertical slice** defined in the Phase 1 PRD: QR issue reporting → AI triage → ticket with a live SLA timer → coordinator dashboard. The full multi-site platform is deliberately out of scope (v2).

> These are design notes, not an instruction to deploy anything. No infrastructure is provisioned in Phase 2.

---

## 1. System context

```
                 ┌─────────────────────────────┐
   Client user   │   Printed room QR code       │
 (meeting host)  │   "HELIOS AV SUPPORT —        │
       │         │    Scan to Report an Issue"  │
       │ scans   └─────────────┬────────────────┘
       ▼                       │ /report?room=<token>
┌──────────────────────────────▼───────────────────────────┐
│                Service360 web app (Next.js on Vercel)      │
│                                                            │
│  Public report page ──► POST /api/report                  │
│                              │                             │
│                              ├─► AI Triage (Vercel AI SDK  │
│                              │     + Claude) → structured   │
│                              │     {issueType, priority,    │
│                              │      likelyCause, recurring} │
│                              │                             │
│                              ├─► SLA engine → response &    │
│                              │     resolution deadlines     │
│                              │                             │
│                              └─► insert ticket             │
│                                                            │
│  Coordinator dashboard (auth) ──► GET/PATCH /api/tickets  │
└──────────────┬──────────────────────────────┬────────────┘
               │                               │
               ▼                               ▼
     ┌───────────────────┐          ┌────────────────────┐
     │  Supabase Postgres │          │  Anthropic API     │
     │  + Supabase Auth   │          │  (Claude, server-  │
     │  (sites, rooms,    │          │   side only)       │
     │   assets, tickets) │          └────────────────────┘
     └───────────────────┘
```

Two human roles touch the system: the **reporter** (no login — scans and submits) and the **coordinator** (authenticated — triages and works tickets). Claude is called **server-side only**, so the API key never reaches the browser.

---

## 2. Components

| Component | Responsibility | Where it runs |
|---|---|---|
| Public report page | Render a room-aware report form from the QR token; submit the complaint | Next.js (client + server component) |
| `POST /api/report` | Orchestrate: triage → SLA deadlines → persist ticket; return ticket number | Next.js route handler (server) |
| AI triage service | Turn free text + meeting-impact into structured triage, validated by a schema | Server module, calls Claude via Vercel AI SDK |
| SLA engine | Pure functions: compute deadlines from priority; compute live SLA state | Server module (no I/O — unit-testable) |
| Coordinator dashboard | List tickets, show SLA board, let coordinator confirm/adjust priority and status | Next.js (auth-gated) |
| `GET/PATCH /api/tickets` | Read and update tickets for the coordinator | Next.js route handlers (server) |
| Data layer | Supabase Postgres via the Supabase JS client | Supabase (managed) |
| Auth | Supabase Auth (email/password) for the coordinator | Supabase (managed) |

---

## 3. Data model (MVP)

Only the tables the slice needs. The full Client→Site→Building→Floor→Room→AvSystem→Equipment hierarchy from the v2 spec is collapsed to the essentials here.

```
site (1) ───< room (1) ───< asset
                  │
                  └──< ticket >── (optional) asset
```

- **site** — `id`, `code` (e.g. `GX-TOWER`), `name`, `created_at`.
- **room** — `id`, `site_id → site`, `name`, `room_type` (`BOARDROOM | TRAINING_ROOM | MEETING_ROOM`), `floor`, `qr_token` (unique, opaque), `created_at`.
- **asset** — `id`, `room_id → room`, `brand`, `model`, `description`, `asset_tag` (unique). Used to give the AI room context and to support the recurring-issue flag.
- **ticket** — `id`, `ticket_number` (e.g. `SR-2026-000123`), `room_id → room`, `asset_id → asset` (nullable), `reporter_name`, `reporter_contact` (both nullable), `source` (`QR`), `issue_type`, `description`, `photo_url` (nullable), `meeting_impact` (`LIVE_NOW | WITHIN_HOUR | TODAY | NONE`), `priority` (`P1|P2|P3|P4`), `ai_suggested_priority`, `ai_suggested_issue_type`, `ai_likely_cause`, `ai_recurring_flag` (bool), `ai_reasoning`, `status` (`NEW | TRIAGED | IN_PROGRESS | RESOLVED | CLOSED`), `created_at`, `response_due_at`, `resolution_due_at`, `responded_at` (nullable), `resolved_at` (nullable).

`sla_state` (`ON_TRACK | AT_RISK | BREACHED`) is **computed at read time** by the SLA engine from `created_at`, the due timestamps, and `responded_at` / `resolved_at` — it is not stored, so it is always current without a background job (acceptable for the MVP; v2 adds a scheduled evaluator for alerts).

Row-Level Security: the `tickets` insert path for the public report is handled by a server route using the service role key; the browser never writes directly. The coordinator dashboard reads via an authenticated session.

---

## 4. AI triage flow (the core AI feature)

1. Client submits: selected `issue_type` (optional), free-text `description`, `meeting_impact`, and the `room` (resolved from the QR token, so the AI gets room type + installed assets).
2. Server builds a prompt with the room context and the **embedded P1–P4 SLA definitions**, and calls Claude through the Vercel AI SDK `generateObject` with a strict output schema (zod).
3. Claude returns `{ issueType, suggestedPriority, likelyCause, recurringIssue, reasoning }`.
4. The output is schema-validated. On any validation or API failure, a **deterministic fallback** maps `meeting_impact → priority` (`LIVE_NOW→P1`, `WITHIN_HOUR→P2`, `TODAY→P3`, `NONE→P4`) so a ticket is never blocked by the AI.
5. The SLA engine computes deadlines from the chosen priority; the ticket is inserted; the ticket number is returned.
6. The coordinator can override the AI's priority at triage — the AI **suggests**, the human **decides**.

This keeps the AI inside a workflow with real domain value and degrades gracefully, which matters for both reliability and the "not a chatbot wrapper" requirement.

---

## 5. SLA engine

Pure, side-effect-free, and the most heavily unit-tested part of the system. SLA values are **illustrative** (see `lib/sla-policy.ts`), not a real client's SLA.

- `computeDeadlines(priority, createdAt)` → `{ responseDueAt, resolutionDueAt }`.
  - P1 uses a **calendar clock** (critical — 15–30 min response, 4 hr resolution; we encode response at 30 min).
  - P2–P4 use a **business-hours clock**: Mon–Fri, 09:00–18:00, Asia/Manila. Time outside coverage does not count down. P2 = 1 hr response / 8 business hrs resolution; P3 = 4 business hrs / 2 business days; P4 = 1 business day / 3–5 business days (we encode 5).
- `computeSlaState(now, ticket)` → `ON_TRACK | AT_RISK | BREACHED`, where **At Risk** = ≥75% of the resolution window elapsed and not yet resolved; **Breached** = past `resolution_due_at` and not resolved.

The SLA values live in a single `sla-policy.ts` constant object so they read as configurable data, matching the v2 design where they'd move to a table.

---

## 6. Deployment architecture (target — not provisioned in Phase 2)

- **Host:** Vercel (Next.js native). Preview deploy per PR, production on `main`.
- **CI:** GitHub Actions runs lint → typecheck → unit tests → build on every push and PR. Deploy happens via the Vercel–GitHub integration after checks pass.
- **Data/Auth:** Supabase project (Postgres + Auth). Schema applied via a migration file in the repo.
- **Secrets:** `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-only env vars in Vercel; `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are public by design. Nothing secret is committed; `.env.example` documents the names only.
- **Monitoring:** Vercel Web Analytics for basic traffic, plus structured server logs on the triage route (latency, fallback-used flag).

---

## 7. Security & privacy notes

- Claude is called server-side only; the Anthropic key is never shipped to the client.
- The public report route accepts untrusted input: validate and length-cap `description` (≤ 1000 chars), constrain `issue_type` and `meeting_impact` to known enums, and treat the QR token as an opaque lookup key (no raw DB ids in URLs).
- **Rate limiting & AI-cost control:** a best-effort per-IP rate limit runs before the AI call (429 when exceeded), bounding burst/loop cost. In-memory limiting is per serverless instance; production should add a shared store (Upstash/Vercel KV) and a hard Anthropic spend cap.
- **Ticket numbers are generated atomically** by a Postgres sequence default — no app-side counting — so concurrent submissions cannot produce duplicates.
- Photo upload (optional) goes to a Supabase Storage bucket with a size/type limit; store only the URL on the ticket.
- Reporter contact is optional and minimal; no account is created for reporters.
- No secrets in the repo or in client bundles; CI includes a basic secret-scan step.

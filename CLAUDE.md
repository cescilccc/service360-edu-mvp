# CLAUDE.md — Service360 (Academic Demo)

Guidance for Claude Code / AI assistants working in this repo. Read `spec.md` and `ARCHITECTURE.md` before writing code; they are the source of truth. This is an **academic demonstration project built on fictional data** — not a production system and not tied to any real client.

## What this is

An AV-native service desk. A user scans a room QR, describes a problem, AI triages it (issue type + P1–P4 priority + likely cause + recurring flag), and a ticket opens with a live SLA timer. A coordinator triages and works tickets from a dashboard. This is a **vertical slice** for a course mini-project — build exactly what `spec.md` scopes, nothing more.

## Stack

Next.js 14 (App Router) + TypeScript · Tailwind CSS · Supabase (Postgres + Auth) · Vercel AI SDK (`ai` + `@ai-sdk/anthropic`, Claude) · zod · Vitest · deploy on Vercel with GitHub Actions.

## Commands

```bash
npm install
npm run dev          # local dev
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm run test         # vitest run
npm run build        # next build
```

Keep all five green before every commit.

## Project conventions

- **TypeScript strict.** No `any` on public function signatures. Validate all external input with zod.
- **Server-only secrets.** `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are used only in route handlers / server modules. Never import them into client components or `NEXT_PUBLIC_*`. Never call an LLM from the browser.
- **Pure SLA logic.** `lib/sla.ts` and `lib/sla-policy.ts` have no I/O so they stay unit-testable. SLA values live only in `sla-policy.ts` and are illustrative.
- **AI must degrade.** `lib/triage.ts` always returns a valid `TriageResult`; on any model/schema failure it uses the deterministic `meetingImpact → priority` fallback. A ticket must never fail to create because of the AI.
- **Enums are shared.** Define `priority`, `status`, `meeting_impact`, `room_type`, `issue_type` once (a `lib/enums.ts`) and reuse in zod schemas, the DB, and the UI.
- **No raw DB ids in public URLs.** Rooms are addressed by opaque `qr_token`.
- **Fictional data only.** Seeds and examples use invented sites, rooms, and equipment. Never add real client, location, or equipment information.
- **Mobile-first for `/report`.** Reporters are on phones. The dashboard can be desktop-first.

## File layout (target)

```
app/
  report/page.tsx            # public report form
  report/success/page.tsx
  login/page.tsx
  dashboard/page.tsx         # auth-gated
  api/report/route.ts        # POST (public)
  api/tickets/route.ts       # GET (auth)
  api/tickets/[id]/route.ts  # PATCH (auth)
lib/
  enums.ts  sla-policy.ts  sla.ts  triage.ts  supabase.ts  ticket-number.ts
supabase/
  migrations/0001_init.sql   seed.sql
tests/
  sla.test.ts  triage.test.ts
.env.example
```

## Guardrails — do NOT

- Do not add v2 features (asset register, engineer app, PM, spares, OEM, escalations, reports, notifications, multi-client). They are out of scope; see `spec.md` §12.
- Do not commit secrets or real env values. Update `.env.example` (names only) when you add a variable.
- Do not add real client/location/equipment data; keep all demo data fictional.
- Do not deploy, run migrations against a live project, or change any hosted service unless the human explicitly asks in this session.
- Do not make live LLM calls in tests — mock them.

## Definition of done per change

Lint + typecheck + tests + build pass; input validated; no secret leaked to the client; the relevant `spec.md` acceptance criterion is met. Make small, meaningful commits (the project needs ≥5).

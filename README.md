# Service360 (Academic Demo)

An AV-native service desk. A user scans a room QR code, describes a problem in plain words, and **AI triages it** — classifying the issue and setting the right SLA priority — before a human touches it. A coordinator then works the ticket from a dashboard with a live SLA board.

This is a Week 4 academic mini-project, built on **fictional demonstration data**. It is independent of any production system. The SLA tiers are **illustrative examples**, not a real client's SLA. The full multi-site platform (asset register, engineer app, preventive maintenance, reporting) is the v2 roadmap — see `spec.md` §12.

## The AI feature

On every report, `lib/triage.ts` calls Claude (via the Vercel AI SDK `generateObject`) with the room context and the illustrative P1–P4 SLA, and returns a **schema-validated** `{ issueType, suggestedPriority, likelyCause, recurringIssue, reasoning }`. If the model call fails, times out, or returns something off-schema, a **deterministic fallback** maps the reporter's meeting-impact answer to a priority — so a ticket is never blocked by the AI.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (Postgres + Auth) · Vercel AI SDK + Claude · zod · Vitest · Vercel + GitHub Actions.

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in your own values
```

Required environment variables (see `.env.example`):

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase anon key (browser auth) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Server writes/reads |
| `ANTHROPIC_API_KEY` | **server only** | Claude triage |

Never commit real values. Server-only keys are read only in route handlers / server modules and are never shipped to the browser.

### Database

Apply the schema and seed to your Supabase project:

```bash
# via the Supabase SQL editor or CLI
supabase/migrations/0001_init.sql
supabase/seed.sql
```

The seed creates 3 fictional demo rooms with QR tokens: `gx-summit-boardroom`, `gx-horizon-training`, `gx-aspen-meeting`.

Create a coordinator login in Supabase Auth (email/password), then **authorize it** by adding its email to the allow-list (a valid Supabase user is not authorized by default):

```sql
insert into coordinator (email) values ('you@example.com');
```

Only emails in the `coordinator` table can read/update tickets via the dashboard/API.

## Run

```bash
npm run dev        # http://localhost:3000
```

- Report a fault: `/report?room=gx-summit-boardroom`
- Coordinator dashboard: `/dashboard` (sign in at `/login`)

## Scripts

```bash
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm run test       # vitest (SLA engine + AI triage; AI is mocked)
npm run build      # next build
```

## Tests

`tests/sla.test.ts` covers SLA deadline computation (P1–P4, business-hours clock across overnight and weekend boundaries) and SLA state transitions. `tests/triage.test.ts` covers the triage output schema and the deterministic fallback. No live LLM calls run in CI.

## Deploy

Deploy on Vercel; connect the GitHub repo so `.github/workflows/ci.yml` (lint → typecheck → test → build) gates every push and PR. Set the four environment variables in the Vercel project. See `ARCHITECTURE.md` §6.

## Docs

- `spec.md` — the build spec (scope, data model, illustrative SLA rules, AI triage, acceptance criteria).
- `ARCHITECTURE.md` — system design, data model, AI/SLA flow, deployment.
- `CLAUDE.md` / `.cursorrules` — guardrails for AI coding assistants.

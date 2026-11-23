# Phase 3 — Build (summary)

Project: **Service360 (Academic Demo)**. The assignment lists five Phase 3 tasks. All five are complete.

| # | Assignment requirement | Status | Evidence |
|---|---|---|---|
| 1 | Scaffold the application | Done | Next.js 14 (App Router) + TypeScript + Tailwind + Vitest — commit `d37765b`. |
| 2 | Implement the core AI feature | Done | `lib/triage.ts` — Claude via Vercel AI SDK, zod-validated output, deterministic fallback — commit `a109618`. |
| 3 | At least 5 meaningful commits | Done (17) | See commit list below (7 build + 10 review fixes). |
| 4 | At least 3 unit tests | Done (2 files, 11 cases) | `tests/sla.test.ts`, `tests/triage.test.ts`. |
| 5 | Check secrets and input validation | Done | Secret scan clean; no `.env` tracked; `.env.example` holds names only; zod validation on every input route. |

## The core AI feature (requirement 2)

On every report, `triage()` sends the complaint + meeting-impact + room context to Claude and gets back a schema-validated `{ issueType, suggestedPriority, likelyCause, recurringIssue, reasoning }`, reasoning over the illustrative P1–P4 SLA. On any model/schema failure it falls back to a deterministic `meetingImpact → priority` map — so the AI adds domain value without being a single point of failure. Not a chatbot wrapper.

## Commits (requirement 3)

```
chore: scaffold Next.js 14 + TypeScript + Tailwind + Vitest
feat: SLA policy and engine (pure, business-hours clock) + shared enums
feat: Supabase schema, fictional demo seed (3 rooms), and clients
feat: AI triage via Vercel AI SDK with schema validation and deterministic fallback
feat: public QR report flow and POST /api/report with SLA deadlines
feat: coordinator dashboard, Supabase auth, and tickets API (GET/PATCH)
test: SLA + triage unit tests; add CI workflow, README, and docs
fix(ci): install dependencies without a committed lockfile
fix(ai): default to a current, supported Claude model id
fix: atomic ticket numbering + rate-limiting and input bounds on the public endpoint
docs: note atomic numbering, rate limiting, and illustrative SLA
fix(security+verify): least-privilege anon RLS, ai_source flag, maxTokens cost cap
docs: RLS least-privilege, ai_source verification, cost controls
feat(security): coordinator-only authorization for ticket APIs
test: coordinator authorization (unauthorized / authenticated / coordinator)
ci: restore npm ci (requires committed lockfile)
docs: coordinator authz, Windows setup, checklist
```

(17 commits — full hashes shown in `git log --oneline`.)

## Unit tests (requirement 4)

- `tests/sla.test.ts` — P1–P4 deadline computation, the business-hours clock across overnight and weekend boundaries, and On Track / At Risk / Breached state transitions.
- `tests/triage.test.ts` — triage output schema (accepts valid, rejects malformed), the deterministic fallback, and the `ai_source` flag. The LLM is mocked, so no live calls run in CI.
- `tests/authz.test.ts` — coordinator authorization: unauthorized (no/invalid token → UNAUTHENTICATED), ordinary authenticated user (→ FORBIDDEN), coordinator on the allow-list (→ AUTHORIZED), and bypass resistance (token claims don't matter).

## Secrets & input validation (requirement 5)

- No hardcoded secrets anywhere in the source (verified by scan).
- `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are read only in server route handlers; never shipped to the browser.
- `.env.example` documents variable names only; `.gitignore` excludes all `.env` files.
- Every external input is validated with zod (`lib/validation.ts`, used by `POST /api/report` and `PATCH /api/tickets/:id`); the public report route treats the QR token as an opaque lookup key.

## Note on verification

The tests and build are run by the GitHub Actions workflow (`.github/workflows/ci.yml`: lint → typecheck → test → build) on every push, and can be run locally with `npm install && npm run test && npm run build`.

-- Service360 (Academic Demo) schema

create type room_type as enum ('BOARDROOM', 'TRAINING_ROOM', 'MEETING_ROOM');
create type meeting_impact as enum ('LIVE_NOW', 'WITHIN_HOUR', 'TODAY', 'NONE');
create type priority as enum ('P1', 'P2', 'P3', 'P4');
create type ticket_status as enum ('NEW', 'TRIAGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
create type issue_type as enum (
  'NO_DISPLAY', 'NO_AUDIO', 'CANT_JOIN_CALL', 'CAMERA_ISSUE',
  'CONTENT_SHARING', 'TOUCH_PANEL', 'MIC_ISSUE', 'OTHER'
);

create table site (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table room (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references site(id) on delete cascade,
  name text not null,
  room_type room_type not null,
  floor text,
  qr_token text not null unique,
  created_at timestamptz not null default now()
);

create table asset (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references room(id) on delete cascade,
  brand text,
  model text,
  description text,
  asset_tag text unique,
  created_at timestamptz not null default now()
);

-- Atomic ticket numbering: the sequence guarantees unique numbers even under
-- simultaneous submissions (nextval is atomic). No application-side counting.
create sequence if not exists ticket_number_seq;

create table ticket (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique default (
    'SR-' || to_char((now() at time zone 'utc'), 'YYYY') || '-' ||
    lpad(nextval('ticket_number_seq')::text, 6, '0')
  ),
  room_id uuid not null references room(id),
  asset_id uuid references asset(id),
  reporter_name text,
  reporter_contact text,
  source text not null default 'QR',
  issue_type issue_type not null,
  description text not null,
  photo_url text,
  meeting_impact meeting_impact not null,
  priority priority not null,
  ai_suggested_priority priority,
  ai_suggested_issue_type issue_type,
  ai_likely_cause text,
  ai_recurring_flag boolean not null default false,
  ai_reasoning text,
  ai_source text,  -- 'ai' when the Claude call succeeded, 'fallback' otherwise
  status ticket_status not null default 'NEW',
  created_at timestamptz not null default now(),
  response_due_at timestamptz not null,
  resolution_due_at timestamptz not null,
  responded_at timestamptz,
  resolved_at timestamptz
);

create index ticket_room_idx on ticket(room_id);
create index ticket_created_idx on ticket(created_at desc);

-- RLS. All data access in this app goes through the SERVER using the service
-- role key (room lookups, ticket create, ticket reads/updates), which bypasses
-- RLS. The browser only uses the anon key for coordinator Auth (sign-in),
-- never to read these tables. So:
--   * the anon role is granted NO table access (least privilege), and
--   * authenticated policies are kept only as a safe default in case a future
--     feature queries directly from a signed-in browser session.
alter table site enable row level security;
alter table room enable row level security;
alter table asset enable row level security;
alter table ticket enable row level security;

-- Authenticated (coordinator) defaults. Not required by the current server-only
-- data path, but a sane baseline if direct client reads are added later.
create policy "auth read site" on site for select to authenticated using (true);
create policy "auth read room" on room for select to authenticated using (true);
create policy "auth read asset" on asset for select to authenticated using (true);
create policy "auth read ticket" on ticket for select to authenticated using (true);
create policy "auth update ticket" on ticket for update to authenticated using (true) with check (true);

-- No anon table policies: with RLS enabled and no policy, the anon role cannot
-- read site/room/asset/ticket directly. The public report page resolves rooms
-- server-side via the service role, so anon needs no table access at all.

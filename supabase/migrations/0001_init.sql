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

-- Coordinator allow-list. Authorization for the dashboard/ticket APIs checks
-- membership here (keyed on the Supabase-verified email), read with the service
-- role. Never trust client-supplied roles/metadata for authorization.
create table coordinator (
  email text primary key,
  created_at timestamptz not null default now()
);

-- RLS: deny ALL direct client access. Every data operation goes through the
-- SERVER using the service-role key (room lookups, ticket create, and the
-- coordinator-authorized ticket reads/updates), which bypasses RLS. The browser
-- uses the anon key ONLY for coordinator Auth (sign-in), never to read/write
-- these tables.
--
-- Therefore NO policies are defined for the anon or authenticated roles on any
-- table. With RLS enabled and no matching policy, both roles are denied direct
-- select/insert/update/delete. This is deliberate: it stops a signed-in (but
-- non-coordinator) user from reading or updating tickets directly from the
-- browser and bypassing the coordinator-only API authorization. Authorization
-- is enforced in the application routes via the `coordinator` allow-list.
alter table site enable row level security;
alter table room enable row level security;
alter table asset enable row level security;
alter table ticket enable row level security;
alter table coordinator enable row level security;

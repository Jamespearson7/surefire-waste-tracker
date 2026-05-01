-- ─────────────────────────────────────────────────────────────────────────────
-- Surefire Market — Team Growth / Badge Tracker Schema
-- Run this once in Supabase → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Team members
create table if not exists team_members (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz default now(),
  name             text not null,
  track            text not null check (track in ('BOH', 'FOH')),
  current_badge    text not null default 'boh_team_member',
  start_date       date,
  total_shifts     integer not null default 0,
  servsafe_active  boolean not null default false,
  servsafe_expiry  date,
  boh_hours        numeric not null default 0,
  foh_hours        numeric not null default 0,
  notes            text,
  active           boolean not null default true
);

-- Skill progress per member per badge
create table if not exists badge_progress (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz default now(),
  member_id      uuid not null references team_members(id) on delete cascade,
  badge_id       text not null,
  skill_key      text not null,
  count_done     integer not null default 0,
  completed      boolean not null default false,
  completed_date date,
  completed_by   text,
  unique(member_id, badge_id, skill_key)
);

-- Historical record of awarded badges
create table if not exists awarded_badges (
  id             uuid primary key default gen_random_uuid(),
  awarded_at     timestamptz default now(),
  member_id      uuid not null references team_members(id) on delete cascade,
  badge_id       text not null,
  awarded_by     text,
  shifts_at_award integer,
  pay_rate       text,
  notes          text
);

-- Indexes
create index if not exists idx_badge_progress_member on badge_progress(member_id);
create index if not exists idx_awarded_badges_member on awarded_badges(member_id);

-- Enable Row Level Security (open read/write via anon key — matches rest of app)
alter table team_members   enable row level security;
alter table badge_progress enable row level security;
alter table awarded_badges enable row level security;

create policy "allow_all_team_members"   on team_members   for all using (true) with check (true);
create policy "allow_all_badge_progress" on badge_progress for all using (true) with check (true);
create policy "allow_all_awarded_badges" on awarded_badges for all using (true) with check (true);

-- Add Toast integration column (run if upgrading from initial schema)
alter table team_members add column if not exists toast_guid text unique;
create index if not exists idx_team_members_toast_guid on team_members(toast_guid);

-- ── Attendance events & progress freeze (page 6 of growth path) ──────────────

create table if not exists attendance_events (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  member_id    uuid not null references team_members(id) on delete cascade,
  event_type   text not null check (event_type in ('ncns','callout','late','writeup','pip')),
  event_date   date not null default current_date,
  notes        text,
  logged_by    text,
  resolved     boolean not null default false,
  resolved_date date,
  resolved_by  text
);

create index if not exists idx_attendance_member on attendance_events(member_id);
create index if not exists idx_attendance_date   on attendance_events(event_date);

alter table team_members add column if not exists progress_frozen boolean not null default false;
alter table team_members add column if not exists freeze_reason   text;

alter table attendance_events enable row level security;
create policy "allow_all_attendance" on attendance_events for all using (true) with check (true);

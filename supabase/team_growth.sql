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

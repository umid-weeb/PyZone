-- Pyzone Arena (Pyzone Arena / Arena) production schema for Supabase Postgres.
-- This file is intentionally idempotent-ish for review; apply via Supabase SQL editor or migrations.

-- Extensions
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- =========================
-- Core profile tables
-- =========================

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username citext unique not null,
  display_name text,
  bio text,
  country text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_username on public.profiles (username);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- =========================
-- Problems + submissions (analytics-friendly)
-- =========================

-- If you already have problems in another schema/service, keep IDs consistent.
create table if not exists public.problems (
  id text primary key,
  slug text unique not null,
  title text not null,
  difficulty text not null check (difficulty in ('Easy','Medium','Hard','easy','medium','hard')),
  created_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_id text not null references public.problems(id) on delete restrict,
  submission_id text, -- external judge submission id, optional
  language text not null,
  status text not null default 'completed', -- queued/running/completed
  verdict text,
  runtime_ms int,
  memory_kb int,
  created_at timestamptz not null default now()
);

create index if not exists idx_submissions_user_created on public.submissions (user_id, created_at desc);
create index if not exists idx_submissions_user_problem on public.submissions (user_id, problem_id);
create index if not exists idx_submissions_problem_created on public.submissions (problem_id, created_at desc);

-- =========================
-- Aggregates (denormalized for scale)
-- =========================

create table if not exists public.user_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  solved_total int not null default 0,
  solved_easy int not null default 0,
  solved_medium int not null default 0,
  solved_hard int not null default 0,
  total_submissions int not null default 0,
  accepted_submissions int not null default 0,
  acceptance_rate numeric(5,2) generated always as (
    case when total_submissions = 0 then null
    else round((accepted_submissions::numeric / total_submissions::numeric) * 100, 2)
    end
  ) stored,
  last_submission_at timestamptz,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_user_stats_updated_at on public.user_stats;
create trigger trg_user_stats_updated_at
before update on public.user_stats
for each row execute function public.set_updated_at();

create table if not exists public.problem_stats (
  problem_id text primary key references public.problems(id) on delete cascade,
  total_submissions int not null default 0,
  accepted_submissions int not null default 0,
  acceptance_rate numeric(5,2) generated always as (
    case when total_submissions = 0 then null
    else round((accepted_submissions::numeric / total_submissions::numeric) * 100, 2)
    end
  ) stored,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_problem_stats_updated_at on public.problem_stats;
create trigger trg_problem_stats_updated_at
before update on public.problem_stats
for each row execute function public.set_updated_at();

-- =========================
-- Rating system (continuous practice)
-- =========================

create table if not exists public.ratings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rating int not null default 1200,
  max_rating int not null default 1200,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_ratings_updated_at on public.ratings;
create trigger trg_ratings_updated_at
before update on public.ratings
for each row execute function public.set_updated_at();

create table if not exists public.rating_history (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta int not null,
  rating_after int not null,
  reason text not null default 'submission',
  submission_id text,
  created_at timestamptz not null default now(),
  unique(user_id, submission_id)
);

create index if not exists idx_rating_history_user_created on public.rating_history (user_id, created_at desc);
create index if not exists idx_ratings_rating on public.ratings (rating desc);

-- =========================
-- Contests
-- =========================

create table if not exists public.contests (
  id text primary key,
  title text not null,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.contest_problems (
  id bigserial primary key,
  contest_id text not null references public.contests(id) on delete cascade,
  problem_id text not null references public.problems(id) on delete restrict,
  sort_order int not null default 0,
  unique(contest_id, problem_id)
);

create index if not exists idx_contest_problems_contest on public.contest_problems (contest_id, sort_order);

create table if not exists public.contest_entries (
  id bigserial primary key,
  contest_id text not null references public.contests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique(contest_id, user_id)
);

create index if not exists idx_contest_entries_contest on public.contest_entries (contest_id, joined_at);

create table if not exists public.contest_submissions (
  id bigserial primary key,
  contest_id text not null references public.contests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_id text not null references public.problems(id) on delete restrict,
  submission_id text,
  language text not null,
  verdict text,
  runtime_ms int,
  memory_kb int,
  created_at timestamptz not null default now()
);

create index if not exists idx_contest_submissions_lookup on public.contest_submissions (contest_id, user_id, created_at desc);

-- =========================
-- RLS
-- =========================

alter table public.profiles enable row level security;
alter table public.submissions enable row level security;
alter table public.user_stats enable row level security;
alter table public.problem_stats enable row level security;
alter table public.ratings enable row level security;
alter table public.rating_history enable row level security;
alter table public.contests enable row level security;
alter table public.contest_problems enable row level security;
alter table public.contest_entries enable row level security;
alter table public.contest_submissions enable row level security;

-- Profiles: public read, self write
drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read" on public.profiles
for select using (true);

drop policy if exists "profiles_self_write" on public.profiles;
create policy "profiles_self_write" on public.profiles
for insert with check (auth.uid() = user_id);

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Submissions: owner-only read/write (judge uses service role bypass)
drop policy if exists "submissions_owner_read" on public.submissions;
create policy "submissions_owner_read" on public.submissions
for select using (auth.uid() = user_id);

drop policy if exists "submissions_owner_insert" on public.submissions;
create policy "submissions_owner_insert" on public.submissions
for insert with check (auth.uid() = user_id);

-- Stats: owner can read own stats; public stats can be served via RPC/view later
drop policy if exists "user_stats_owner_read" on public.user_stats;
create policy "user_stats_owner_read" on public.user_stats
for select using (auth.uid() = user_id);

drop policy if exists "ratings_public_read" on public.ratings;
create policy "ratings_public_read" on public.ratings
for select using (true);

drop policy if exists "rating_history_owner_read" on public.rating_history;
create policy "rating_history_owner_read" on public.rating_history
for select using (auth.uid() = user_id);

-- problem_stats is public (useful for problem pages); safe to expose.
drop policy if exists "problem_stats_public_read" on public.problem_stats;
create policy "problem_stats_public_read" on public.problem_stats
for select using (true);

-- Contests: public read (platform content), entries/submissions owner-only
drop policy if exists "contests_public_read" on public.contests;
create policy "contests_public_read" on public.contests
for select using (true);

drop policy if exists "contest_problems_public_read" on public.contest_problems;
create policy "contest_problems_public_read" on public.contest_problems
for select using (true);

drop policy if exists "contest_entries_owner_read" on public.contest_entries;
create policy "contest_entries_owner_read" on public.contest_entries
for select using (auth.uid() = user_id);

drop policy if exists "contest_entries_owner_insert" on public.contest_entries;
create policy "contest_entries_owner_insert" on public.contest_entries
for insert with check (auth.uid() = user_id);

drop policy if exists "contest_submissions_owner_read" on public.contest_submissions;
create policy "contest_submissions_owner_read" on public.contest_submissions
for select using (auth.uid() = user_id);

drop policy if exists "contest_submissions_owner_insert" on public.contest_submissions;
create policy "contest_submissions_owner_insert" on public.contest_submissions
for insert with check (auth.uid() = user_id);

-- =========================
-- Storage (avatars) notes:
-- - Create bucket `avatars` as public.
-- - Use path `${auth.uid()}/...` for uploads.
-- - Policies:
--   - public read
--   - insert/update/delete only where `auth.uid()` matches first folder segment
-- =========================


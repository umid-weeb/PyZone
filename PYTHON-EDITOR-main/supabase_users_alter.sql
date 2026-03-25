-- Safe schema patch for existing `public.users` table.
-- Fixes: psycopg2.errors.UndefinedColumn: column users.email does not exist
-- Apply in Supabase SQL Editor. This preserves existing data.

alter table public.users
  add column if not exists email text;

alter table public.users
  add column if not exists display_name text;

alter table public.users
  add column if not exists avatar_url text;

alter table public.users
  add column if not exists bio text;

-- Optional: ensure created_at exists with default.
alter table public.users
  add column if not exists created_at timestamptz not null default now();

-- Add uniqueness for email.
-- Run only once; if constraint already exists, Supabase will report an error.
alter table public.users
  add constraint users_email_unique unique (email);


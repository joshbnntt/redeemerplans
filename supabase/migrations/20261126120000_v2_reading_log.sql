-- Per-plan reading progress, so a reader can follow more than one plan (step 1 of following plans).
-- Additive only: two new tables, and a one-time copy of existing check-offs into one of them.
-- `haveread` is left exactly as it is; the app keeps writing the church plan's check-offs there too,
-- so the current site and the admin Readers page keep working.

-- Which plan days each reader has read. `plan_id` is the plan's id (as in /api/v2/plans.json and
-- haveread.plan_slug); `day_n` is the 1-based day number, so it still means the same reading if a
-- reader later moves the plan to their own dates.
create table public.reading_log (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id text not null,
  day_n integer not null check (day_n > 0),
  read_at timestamptz not null default now(),
  primary key (user_id, plan_id, day_n)
);

-- The plans each reader follows (used from step 2). A reader with no row for the church plan
-- follows it; `following = false` hides it. `start_date` is set when the reader follows a plan at
-- their own pace (null = the plan's own dates).
create table public.user_plans (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id text not null,
  following boolean not null default true,
  start_date date,
  updated_at timestamptz not null default now(),
  primary key (user_id, plan_id)
);

-- Each reader can see and change only their own rows. Nothing is visible without signing in.
alter table public.reading_log enable row level security;
alter table public.user_plans enable row level security;

create policy "Readers manage their own reading log" on public.reading_log
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Readers manage their own plans" on public.user_plans
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.reading_log, public.user_plans from anon;
grant select, insert, update, delete on public.reading_log, public.user_plans to authenticated;

-- One-time copy of existing check-offs. haveread stores only a date ("MM/DD/YYYY"), sometimes with
-- the plan it was read in. Each date goes to the plan it was tagged with if that plan ran that day,
-- otherwise to the church plan running that day (the current plan first, then the newest). Dates no
-- plan covered stay in haveread only. Same rule as locateDate() in the app.
-- The dated church plans, from src/plan as of this migration:
with plans (plan_id, start_date, days, current) as (
  values
    ('2023-july-december-reading-plan', date '2023-07-03', 181, false),
    ('2023-january-june-reading-plan', date '2023-01-02', 181, false),
    ('2024-january-june-reading-plan', date '2024-01-01', 182, false),
    ('2024-july-2025-january-reading-plan', date '2024-07-01', 189, false),
    ('2025-january-july-reading-plan', date '2025-01-06', 181, false),
    ('2025-july-december-reading-plan', date '2025-07-07', 181, false),
    ('2026-bible-reading-plan', date '2026-01-01', 368, true)
),
checked as (
  -- One row per reader and date (haveread has a few duplicates); the earliest wins.
  select distinct on (h.user_id, h.plan_day)
    h.user_id, to_date(h.plan_day, 'MM/DD/YYYY') as d, h.plan_slug, coalesce(h.created_at, now()) as read_at
  from public.haveread h
  where h.plan_day ~ '^\d{2}/\d{2}/\d{4}$'
  order by h.user_id, h.plan_day, h.created_at
),
located as (
  select c.user_id, c.d, c.read_at,
    coalesce(
      (select p.plan_id from plans p
        where p.plan_id = c.plan_slug and c.d between p.start_date and p.start_date + p.days - 1),
      (select p.plan_id from plans p
        where c.d between p.start_date and p.start_date + p.days - 1
        order by p.current desc, p.start_date desc limit 1)
    ) as plan_id
  from checked c
)
insert into public.reading_log (user_id, plan_id, day_n, read_at)
select l.user_id, l.plan_id, (l.d - p.start_date) + 1, l.read_at
from located l
join plans p using (plan_id)
on conflict do nothing;

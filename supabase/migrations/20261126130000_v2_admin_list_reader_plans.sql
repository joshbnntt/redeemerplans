-- Editors can see each reader's progress per plan (from reading_log), which plans they follow and
-- any start date of their own (from user_plans), for the admin Readers page.
-- Additive only: one new read-only function, like list_readers().

create or replace function public.list_reader_plans()
returns table (
  user_id uuid,
  plan_id text,
  days integer[],
  last_read_at timestamptz,
  following boolean,
  start_date date
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_plan_editor() then
    raise exception 'Only editors can see readers' using errcode = '42501';
  end if;
  return query
    select
      coalesce(l.user_id, p.user_id),
      coalesce(l.plan_id, p.plan_id),
      coalesce(l.days, '{}'),
      l.last_read_at,
      p.following,
      p.start_date
    from (
      select r.user_id, r.plan_id, array_agg(r.day_n order by r.day_n) as days, max(r.read_at) as last_read_at
      from public.reading_log r
      group by r.user_id, r.plan_id
    ) l
    full join public.user_plans p on p.user_id = l.user_id and p.plan_id = l.plan_id;
end;
$$;
revoke all on function public.list_reader_plans() from public, anon;
grant execute on function public.list_reader_plans() to authenticated;

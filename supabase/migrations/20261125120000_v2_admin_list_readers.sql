-- Applied to the production project on 2026-11-25 (Supabase migration "v2_admin_list_readers").
-- Editors can see everyone with an account: when they joined, signed in and were last active,
-- whether they're still signed in anywhere, and which days they've checked off.
-- Additive only: one new read-only function.

create or replace function public.list_readers()
returns table (
  user_id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  last_active_at timestamptz,
  signed_in_devices integer,
  is_editor boolean,
  read_days text[],
  last_read_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_plan_editor() then
    raise exception 'Only editors can see readers' using errcode = '42501';
  end if;
  return query
    select
      u.id,
      u.email::text,
      u.created_at,
      u.last_sign_in_at,
      -- An open app refreshes its sign-in about hourly, so the latest refresh is a good "last seen".
      nullif(greatest(
        coalesce(s.last_refresh, '-infinity'),
        coalesce(u.last_sign_in_at, '-infinity'),
        coalesce(h.last_read_at, '-infinity')
      ), '-infinity'),
      coalesce(s.devices, 0)::integer,
      exists (
        select 1 from public.permissions p
        where p.user_id = u.id and p.permission = 'readingplan-edit' and p.granted
      ),
      coalesce(h.days, '{}'),
      h.last_read_at
    from auth.users u
    left join lateral (
      select count(*) as devices,
             max(greatest(coalesce(se.refreshed_at at time zone 'utc', se.created_at), se.updated_at, se.created_at)) as last_refresh
      from auth.sessions se
      where se.user_id = u.id and (se.not_after is null or se.not_after > now())
    ) s on true
    left join lateral (
      select array_agg(distinct hr.plan_day) filter (where hr.plan_day is not null) as days,
             max(hr.created_at) as last_read_at
      from public.haveread hr
      where hr.user_id = u.id
    ) h on true
    order by 5 desc nulls last, u.email;
end;
$$;
revoke all on function public.list_readers() from public, anon;
grant execute on function public.list_readers() to authenticated;

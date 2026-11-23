-- Applied to the production project on 2026-11-23 (Supabase migration "v2_admin_editors_and_drafts").
-- v2 admin: editors (reusing public.permissions 'readingplan-edit') and plan drafts.
-- Additive only: no existing table, column or policy is changed.

create or replace function public.is_plan_editor()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.permissions p
    where p.user_id = (select auth.uid()) and p.permission = 'readingplan-edit' and p.granted
  );
$$;
revoke all on function public.is_plan_editor() from public;
grant execute on function public.is_plan_editor() to authenticated;

create policy "Users can read their own permissions"
  on public.permissions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_plan_editor()));

create table public.plan_drafts (
  id uuid primary key default gen_random_uuid(),
  plan_id text,
  title text not null default '',
  data jsonb not null,
  base_sha text,
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index plan_drafts_plan_id_idx on public.plan_drafts (plan_id);
create index plan_drafts_updated_by_idx on public.plan_drafts (updated_by);
alter table public.plan_drafts enable row level security;
create policy "Editors manage drafts" on public.plan_drafts for all to authenticated
  using ((select public.is_plan_editor())) with check ((select public.is_plan_editor()));

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger plan_drafts_touch before update on public.plan_drafts
  for each row execute function public.touch_updated_at();

create or replace function public.list_plan_editors()
returns table (user_id uuid, email text, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_plan_editor() then
    raise exception 'Only editors can see editors' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, u.last_sign_in_at
    from public.permissions p join auth.users u on u.id = p.user_id
    where p.permission = 'readingplan-edit' and p.granted
    order by u.email;
end;
$$;
revoke all on function public.list_plan_editors() from public;
grant execute on function public.list_plan_editors() to authenticated;

create or replace function public.grant_plan_editor(editor_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if not public.is_plan_editor() then
    raise exception 'Only editors can add editors' using errcode = '42501';
  end if;
  select id into target from auth.users where lower(email) = lower(trim(editor_email));
  if target is null then
    raise exception 'No account for %. Ask them to sign in once first.', editor_email using errcode = 'P0002';
  end if;
  if exists (select 1 from public.permissions where user_id = target and permission = 'readingplan-edit') then
    update public.permissions set granted = true where user_id = target and permission = 'readingplan-edit';
  else
    insert into public.permissions (user_id, permission, granted) values (target, 'readingplan-edit', true);
  end if;
end;
$$;
revoke all on function public.grant_plan_editor(text) from public;
grant execute on function public.grant_plan_editor(text) to authenticated;

create or replace function public.revoke_plan_editor(editor_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_plan_editor() then
    raise exception 'Only editors can remove editors' using errcode = '42501';
  end if;
  if editor_id = (select auth.uid()) then
    raise exception 'You can''t remove yourself' using errcode = '42501';
  end if;
  update public.permissions set granted = false where user_id = editor_id and permission = 'readingplan-edit';
end;
$$;
revoke all on function public.revoke_plan_editor(uuid) from public;
grant execute on function public.revoke_plan_editor(uuid) to authenticated;

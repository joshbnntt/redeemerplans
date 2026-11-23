-- Applied to the production project on 2026-11-23 (Supabase migration "v2_admin_editor_invites").
-- Editors can invite someone who hasn't signed in yet; access switches on when their account is created.

create table public.plan_editor_invites (
  email text primary key check (email = lower(trim(email))),
  invited_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index plan_editor_invites_invited_by_idx on public.plan_editor_invites (invited_by);
alter table public.plan_editor_invites enable row level security;
create policy "Editors see invites" on public.plan_editor_invites for select to authenticated
  using ((select public.is_plan_editor()));
create policy "Editors cancel invites" on public.plan_editor_invites for delete to authenticated
  using ((select public.is_plan_editor()));

-- Add an editor: grants now if they have an account, otherwise saves an invite. Returns 'granted' or 'invited'.
drop function public.grant_plan_editor(text);
create function public.grant_plan_editor(editor_email text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  addr text := lower(trim(editor_email));
  target uuid;
begin
  if not public.is_plan_editor() then
    raise exception 'Only editors can add editors' using errcode = '42501';
  end if;
  if addr !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'That doesn''t look like an email address.' using errcode = '22023';
  end if;
  select id into target from auth.users where lower(email) = addr;
  if target is null then
    insert into public.plan_editor_invites (email) values (addr) on conflict (email) do nothing;
    return 'invited';
  end if;
  if exists (select 1 from public.permissions where user_id = target and permission = 'readingplan-edit') then
    update public.permissions set granted = true where user_id = target and permission = 'readingplan-edit';
  else
    insert into public.permissions (user_id, permission, granted) values (target, 'readingplan-edit', true);
  end if;
  delete from public.plan_editor_invites where email = addr;
  return 'granted';
end;
$$;
revoke all on function public.grant_plan_editor(text) from public, anon;
grant execute on function public.grant_plan_editor(text) to authenticated;

-- Lets the admin sign-in page decide whether it may create an account. Reveals only whether an invite is waiting.
create function public.is_editor_invite(editor_email text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.plan_editor_invites where email = lower(trim(editor_email)));
$$;
revoke all on function public.is_editor_invite(text) from public;
grant execute on function public.is_editor_invite(text) to anon, authenticated;

-- When an invited address gets an account, switch on editing access.
create function public.accept_editor_invite()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is not null and exists (select 1 from public.plan_editor_invites where email = lower(new.email)) then
    insert into public.permissions (user_id, permission, granted) values (new.id, 'readingplan-edit', true);
    delete from public.plan_editor_invites where email = lower(new.email);
  end if;
  return new;
end;
$$;
revoke all on function public.accept_editor_invite() from public, anon, authenticated;
create trigger on_auth_user_created_accept_editor_invite
  after insert on auth.users
  for each row execute function public.accept_editor_invite();

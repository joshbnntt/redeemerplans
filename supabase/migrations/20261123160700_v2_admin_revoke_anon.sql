-- Applied to the production project on 2026-11-23 (Supabase migration "v2_admin_revoke_anon").
-- Signed-out visitors never need the editor functions.
revoke execute on function public.is_plan_editor() from anon;
revoke execute on function public.list_plan_editors() from anon;
revoke execute on function public.grant_plan_editor(text) from anon;
revoke execute on function public.revoke_plan_editor(uuid) from anon;
revoke execute on function public.touch_updated_at() from anon, authenticated;

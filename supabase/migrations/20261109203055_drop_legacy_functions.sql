-- Leftovers from the schema this project had before the baseline. Both are
-- broken: is_platform_admin() compares against a 'platform' role that no longer
-- exists, and is_ws_member() reads public.workspace_members, which was dropped.
drop function if exists public.is_platform_admin();
drop function if exists public.is_ws_member(uuid);

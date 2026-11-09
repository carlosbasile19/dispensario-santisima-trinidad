-- Platform roles. Each clinic member has one role on their profile; a profile
-- with no role (role is null) can sign in but sees nothing of the platform.
-- Roles are assigned by administrators only, never by the member themselves.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role' and typnamespace = 'public'::regnamespace) then
    create type public.app_role as enum ('doctor', 'director', 'staff', 'admin');
  end if;
end $$;

alter table public.profiles add column if not exists role public.app_role;

-- The signed-in user's role. Security definer so RLS policies can call it
-- without recursing into the profiles policies.
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

revoke execute on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated;

-- Members may edit only their own name and photo. Without this, the existing
-- "update own row" policy would let anyone give themselves a role.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

-- Administrators see every profile (Miembros) and assign roles.
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles
  for select to authenticated
  using ((select public.current_app_role()) = 'admin');

create or replace function public.set_member_role(member_id uuid, new_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select public.current_app_role()) is distinct from 'admin' then
    raise exception 'Only administrators can assign roles' using errcode = '42501';
  end if;
  if member_id = (select auth.uid()) then
    raise exception 'Administrators cannot change their own role' using errcode = '42501';
  end if;
  update public.profiles set role = new_role where id = member_id;
end;
$$;

revoke execute on function public.set_member_role(uuid, public.app_role) from public, anon;
grant execute on function public.set_member_role(uuid, public.app_role) to authenticated;

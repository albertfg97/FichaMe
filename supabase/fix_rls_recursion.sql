-- Fix: "infinite recursion detected in policy for relation profiles".
-- Reemplaza las subconsultas auto-referenciadas a profiles por una función
-- security definer que NO vuelve a aplicar RLS.

create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

drop policy if exists "Users view own profile" on public.profiles;
create policy "Users view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Admins view all profiles" on public.profiles;
create policy "Admins view all profiles"
  on public.profiles for select
  using (public.is_admin());

drop policy if exists "Admins manage employees" on public.employees;
create policy "Admins manage employees"
  on public.employees for all
  using (public.is_admin());

drop policy if exists "Admins manage clockings" on public.clockings;
create policy "Admins manage clockings"
  on public.clockings for all
  using (public.is_admin());

drop policy if exists "Admins manage work shifts" on public.work_shifts;
create policy "Admins manage work shifts"
  on public.work_shifts for all
  using (public.is_admin());

drop policy if exists "Admins manage assigned shifts" on public.assigned_shifts;
create policy "Admins manage assigned shifts"
  on public.assigned_shifts for all
  using (public.is_admin());

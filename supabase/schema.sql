-- =============================================
-- FichaMe - Script completo de inicialización
-- Borra todo y recrea desde cero.
-- Ejecuta este script en el SQL Editor de Supabase.
-- =============================================

-- Limpiar objetos existentes en orden correcto de dependencia:
-- 0. Primero is_admin() con CASCADE: elimina de golpe todas sus policies
--    dependientes (exactamente lo que pide el HINT del error),
--    sin importar el estado en que esté la BD.
drop function if exists public.is_admin() cascade;

-- 1. Triggers (referencian funciones y tablas)
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_employee_pin_hash on public.employees;

-- 2. Tablas con CASCADE (CASCADE elimina también sus policies,
--    rompiendo la dependencia policy -> funciones automáticamente)
drop table if exists public.assigned_shifts cascade;
drop table if exists public.work_shifts cascade;
drop table if exists public.clockings cascade;
drop table if exists public.pin_attempts cascade;
drop table if exists public.kiosk_settings cascade;
drop table if exists public.employees cascade;
drop table if exists public.profiles cascade;

-- 3. Resto de funciones con CASCADE (is_admin ya no está)
drop function if exists public.handle_new_user() cascade;
drop function if exists public.hash_employee_pin() cascade;
drop function if exists public.verify_pin(text) cascade;
drop function if exists public.create_clocking(uuid, text, timestamptz) cascade;
drop function if exists public.get_last_clocking(uuid) cascade;
drop function if exists public.correct_clocking_time(uuid, timestamptz, uuid) cascade;
drop function if exists public.get_daily_overview(date) cascade;

-- Extensión para UUIDs y cifrado bcrypt
create extension if not exists "pgcrypto" with schema extensions;

-- =============================================
-- TABLA: profiles
-- =============================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text not null default '',
  role text not null default 'employee' check (role in ('admin', 'employee')),
  created_at timestamptz not null default now()
);

-- =============================================
-- TABLA: employees
-- =============================================
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique,
  phone text,
  position text default '',
  pin text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- =============================================
-- TABLA: pin_attempts
-- =============================================
create table public.pin_attempts (
  id bigint generated always as identity primary key,
  attempted_at timestamptz not null default now(),
  success boolean not null default false
);

create index idx_pin_attempts_time
  on public.pin_attempts (attempted_at);

-- =============================================
-- TABLA: clockings
-- =============================================
create table public.clockings (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete cascade not null,
  type text not null constraint ck_clockings_type check (type in ('in', 'out', 'absence')),
  absence_reason text constraint ck_clockings_absence_reason
    check (absence_reason is null or absence_reason in ('sickness', 'vacation', 'unspecified')),
  clocked_at timestamptz not null default now(),
  original_time timestamptz,
  corrected_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index idx_clockings_employee_time
  on public.clockings (employee_id, clocked_at desc);

-- =============================================
-- TABLA: work_shifts
-- =============================================
create table public.work_shifts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- =============================================
-- TABLA: assigned_shifts
-- =============================================
create table public.assigned_shifts (
  employee_id uuid references public.employees(id) on delete cascade not null,
  shift_id uuid references public.work_shifts(id) on delete cascade not null,
  primary key (employee_id, shift_id)
);

-- =============================================
-- TABLA: kiosk_settings
-- =============================================
create table public.kiosk_settings (
  id int primary key default 1 check (id = 1),
  title text not null default 'FichaMe',
  subtitle text not null default 'Introduce tu código para fichar',
  logo_url text,
  brand_color text not null default '#1F7A50',
  holiday_region text,
  holiday_province text,
  holiday_city text,
  updated_at timestamptz not null default now()
);

insert into public.kiosk_settings (id) values (1);

-- =============================================
-- TABLA: holidays
-- Días festivos generales. En esos días (además de
-- sábados y domingos) el kiosco no permite fichar.
-- =============================================
create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  name text not null default '',
  created_at timestamptz not null default now()
);

create index idx_holidays_date
  on public.holidays (date);

-- =============================================
-- RLS (Row Level Security)
-- =============================================
alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.clockings enable row level security;
alter table public.work_shifts enable row level security;
alter table public.assigned_shifts enable row level security;
alter table public.pin_attempts enable row level security;
alter table public.kiosk_settings enable row level security;
alter table public.holidays enable row level security;

-- Helper: comprueba si el usuario autenticado es admin.
-- security definer para evitar infinite recursion en RLS de profiles.
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

-- Profiles
create policy "Users view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admins view all profiles"
  on public.profiles for select
  using (public.is_admin());

-- Employees
create policy "Admins manage employees"
  on public.employees for all
  using (public.is_admin());

-- Clockings
create policy "Admins manage clockings"
  on public.clockings for all
  using (public.is_admin());

-- Work shifts
create policy "Admins manage work shifts"
  on public.work_shifts for all
  using (public.is_admin());

create policy "Authenticated users view work shifts"
  on public.work_shifts for select
  using (auth.role() = 'authenticated');

-- Assigned shifts
create policy "Admins manage assigned shifts"
  on public.assigned_shifts for all
  using (public.is_admin());

create policy "Authenticated users view assigned shifts"
  on public.assigned_shifts for select
  using (auth.role() = 'authenticated');

-- Pin attempts
create policy "Admins view pin attempts"
  on public.pin_attempts for select
  using (public.is_admin());

-- Kiosk settings
create policy "Anyone view kiosk settings"
  on public.kiosk_settings for select
  using (true);

create policy "Admins manage kiosk settings"
  on public.kiosk_settings for all
  using (public.is_admin());

-- Holidays
create policy "Anyone view holidays"
  on public.holidays for select
  using (true);

create policy "Admins manage holidays"
  on public.holidays for all
  using (public.is_admin());

-- =============================================
-- TRIGGER: crear perfil automáticamente al registrarse
-- =============================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''), 'employee');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================
-- TRIGGER: hashear PIN con bcrypt al insertar/editar
-- =============================================
create or replace function public.hash_employee_pin()
returns trigger
language plpgsql
security definer set search_path = public, extensions
as $$
begin
  if TG_OP = 'INSERT' or new.pin is distinct from old.pin then
    if new.pin not like '$2%' then
      if exists (
        select 1 from public.employees e
        where e.id is distinct from new.id
          and e.pin = crypt(new.pin, e.pin)
      ) then
        raise exception using
          errcode = '23505',
          message = 'Ya existe un empleado con ese PIN';
      end if;
      new.pin := crypt(new.pin, gen_salt('bf'));
    end if;
  end if;
  return new;
end;
$$;

create trigger on_employee_pin_hash
  before insert or update of pin on public.employees
  for each row execute procedure public.hash_employee_pin();

-- =============================================
-- FUNCIONES RPC
-- =============================================

-- Verificar PIN de un empleado (con rate limiting anti fuerza bruta)
create or replace function public.verify_pin(
  p_pin text
)
returns json
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  emp record;
  failed_count int;
  oldest_failure timestamptz;
  retry_seconds int;
begin
  delete from public.pin_attempts
  where attempted_at < now() - interval '1 day';

  select count(*), min(attempted_at)
  into failed_count, oldest_failure
  from public.pin_attempts
  where success = false
    and attempted_at > now() - interval '10 minutes';

  if failed_count >= 8 and oldest_failure is not null then
    retry_seconds := greatest(
      0,
      600 - round(extract(epoch from (now() - oldest_failure)))
    );
    return json_build_object(
      'error', 'too_many_attempts',
      'retry_after', retry_seconds
    );
  end if;

  select * into emp
  from public.employees
  where is_active = true
    and pin = crypt(p_pin, pin)
  limit 1;

  if not found then
    insert into public.pin_attempts (success) values (false);
    return json_build_object('error', 'invalid_pin');
  end if;

  insert into public.pin_attempts (success) values (true);

  return json_build_object(
    'id', emp.id,
    'name', emp.name,
    'position', emp.position
  );
end;
$$;

-- Registrar un fichaje (entrada, salida o ausencia)
create or replace function public.create_clocking(
  p_employee_id uuid,
  p_type text,
  p_clocked_at timestamptz default now(),
  p_absence_reason text default null
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  new_clocking record;
  emp_exists boolean;
  v_reason text;
begin
  select exists (
    select 1 from public.employees
    where id = p_employee_id and is_active = true
  ) into emp_exists;

  if not emp_exists then
    raise exception 'Empleado no encontrado o inactivo';
  end if;

  if p_type = 'absence' then
    v_reason := coalesce(p_absence_reason, 'unspecified');
  else
    v_reason := null;
  end if;

  insert into public.clockings (employee_id, type, absence_reason, clocked_at)
  values (p_employee_id, p_type, v_reason, p_clocked_at)
  returning * into new_clocking;

  return json_build_object(
    'id', new_clocking.id,
    'employee_id', new_clocking.employee_id,
    'type', new_clocking.type,
    'absence_reason', new_clocking.absence_reason,
    'clocked_at', new_clocking.clocked_at
  );
end;
$$;

-- Obtener el último fichaje de entrada/salida de un empleado.
-- Las ausencias no se tienen en cuenta para no romper el ciclo.
create or replace function public.get_last_clocking(
  p_employee_id uuid
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  last_c record;
begin
  select * into last_c
  from public.clockings
  where employee_id = p_employee_id
    and type in ('in', 'out')
  order by clocked_at desc
  limit 1;

  if not found then
    return json_build_object('error', 'no_clockings');
  end if;

  return json_build_object(
    'id', last_c.id,
    'type', last_c.type,
    'clocked_at', last_c.clocked_at
  );
end;
$$;

-- Corregir la hora de un fichaje (solo admin)
create or replace function public.correct_clocking_time(
  p_clocking_id uuid,
  p_new_time timestamptz,
  p_admin_id uuid
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  updated record;
  is_admin boolean;
begin
  select exists (
    select 1 from public.profiles
    where id = p_admin_id and role = 'admin'
  ) into is_admin;

  if not is_admin then
    raise exception 'Solo los administradores pueden corregir fichajes';
  end if;

  update public.clockings
  set clocked_at = p_new_time,
      corrected_by = p_admin_id
  where id = p_clocking_id
  returning * into updated;

  if not found then
    return null;
  end if;

  return json_build_object(
    'id', updated.id,
    'clocked_at', updated.clocked_at,
    'corrected', true
  );
end;
$$;

-- Estadísticas diarias
create or replace function public.get_daily_overview(
  p_date date default current_date
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  total_employees int;
  clocked_in int;
  clocked_out int;
begin
  select count(*) into total_employees
  from public.employees where is_active = true;

  select count(distinct employee_id) into clocked_in
  from public.clockings
  where type = 'in' and clocked_at::date = p_date;

  select count(distinct employee_id) into clocked_out
  from public.clockings
  where type = 'out' and clocked_at::date = p_date;

  return json_build_object(
    'date', p_date,
    'total_employees', total_employees,
    'clocked_in', clocked_in,
    'clocked_out', clocked_out,
    'pending', total_employees - clocked_out
  );
end;
$$;

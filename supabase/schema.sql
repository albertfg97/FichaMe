-- =============================================
-- FichaMe - Esquema de Supabase (PostgreSQL)
-- Ejecuta este script en el SQL Editor de Supabase
-- =============================================

-- Extensión para UUIDs
create extension if not exists "pgcrypto";

-- =============================================
-- TABLA: profiles
-- Perfiles de usuario. Cada usuario se crea con
-- Supabase Auth. Si es admin, role = 'admin',
-- si es empleado, role = 'employee'.
-- =============================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text not null default '',
  role text not null default 'employee' check (role in ('admin', 'employee')),
  created_at timestamptz not null default now()
);

-- =============================================
-- TABLA: employees
-- Empleados de la empresa. Tienen un código PIN
-- que el admin les asigna para fichar.
-- =============================================
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique,
  phone text,
  position text default '',
  pin text not null,              -- Código PIN numérico para fichar
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- =============================================
-- TABLA: clockings (fichajes)
-- Registro de entradas/salidas de cada empleado.
-- type: 'in' = entrada, 'out' = salida
-- =============================================
create table if not exists public.clockings (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete cascade not null,
  type text not null check (type in ('in', 'out')),
  clocked_at timestamptz not null default now(),
  original_time timestamptz,       -- Hora original si el admin la corrigió
  corrected_by uuid references public.profiles(id),  -- Admin que corrigió
  created_at timestamptz not null default now()
);

-- Índice para búsquedas rápidas por empleado y fecha
create index if not exists idx_clockings_employee_time
  on public.clockings (employee_id, clocked_at desc);

-- =============================================
-- TABLA: work_shifts (turnos)
-- Configuración opcional de horarios de trabajo
-- =============================================
create table if not exists public.work_shifts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- =============================================
-- TABLA: assigned_shifts
-- Asignación de empleados a turnos
-- =============================================
create table if not exists public.assigned_shifts (
  employee_id uuid references public.employees(id) on delete cascade not null,
  shift_id uuid references public.work_shifts(id) on delete cascade not null,
  primary key (employee_id, shift_id)
);

-- =============================================
-- RLS (Row Level Security)
-- =============================================

alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.clockings enable row level security;
alter table public.work_shifts enable row level security;
alter table public.assigned_shifts enable row level security;

-- Profiles: solo el usuario puede ver/editar su propio perfil; admins ven todos
create policy "Users view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admins view all profiles"
  on public.profiles for select
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

-- Employees: solo admins pueden gestionar empleados
create policy "Admins manage employees"
  on public.employees for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

-- Clockings: admins pueden gestionar todos los fichajes
create policy "Admins manage clockings"
  on public.clockings for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

-- Work shifts: admins gestionan
create policy "Admins manage work shifts"
  on public.work_shifts for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

create policy "Authenticated users view work shifts"
  on public.work_shifts for select
  using (auth.role() = 'authenticated');

create policy "Admins manage assigned shifts"
  on public.assigned_shifts for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

create policy "Authenticated users view assigned shifts"
  on public.assigned_shifts for select
  using (auth.role() = 'authenticated');

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================
-- FUNCIONES RPC
-- =============================================

-- Verificar PIN de un empleado
-- Devuelve el empleado si el PIN es correcto y está activo
create or replace function public.verify_pin(
  p_pin text
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  emp record;
begin
  select * into emp
  from public.employees
  where pin = p_pin and is_active = true
  limit 1;

  if not found then
    return null;
  end if;

  return json_build_object(
    'id', emp.id,
    'name', emp.name,
    'position', emp.position,
    'employee_code', emp.pin
  );
end;
$$;

-- Registrar un fichaje (entrada o salida)
-- Devuelve el fichaje creado
create or replace function public.create_clocking(
  p_employee_id uuid,
  p_type text,
  p_clocked_at timestamptz default now()
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  new_clocking record;
  emp_exists boolean;
begin
  -- Verificar que el empleado existe y está activo
  select exists (
    select 1 from public.employees
    where id = p_employee_id and is_active = true
  ) into emp_exists;

  if not emp_exists then
    raise exception 'Empleado no encontrado o inactivo';
  end if;

  insert into public.clockings (employee_id, type, clocked_at)
  values (p_employee_id, p_type, p_clocked_at)
  returning * into new_clocking;

  return json_build_object(
    'id', new_clocking.id,
    'employee_id', new_clocking.employee_id,
    'type', new_clocking.type,
    'clocked_at', new_clocking.clocked_at
  );
end;
$$;

-- Obtener el último fichaje de un empleado
-- Útil para saber si debe marcar entrada o salida
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
  -- Verificar que el usuario es admin
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

-- Estadísticas diarias: número de empleados que ficharon hoy
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

-- =============================================
-- FichaMe - Esquema de Supabase (PostgreSQL)
-- Ejecuta este script en el SQL Editor de Supabase
-- =============================================

-- Extensión para UUIDs y cifrado bcrypt (crypt/gen_salt).
-- En Supabase pgcrypto suele vivir en el esquema `extensions`,
-- por eso se fuerza ese esquema aquí y en el search_path de las funciones.
create extension if not exists "pgcrypto" with schema extensions;

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
  pin text not null,              -- Código PIN numérico para fichar (se guarda como hash bcrypt)
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- =============================================
-- TABLA: pin_attempts
-- Registro de intentos de PIN para rate limiting
-- anti fuerza bruta. Solo se accede desde la
-- función security definer verify_pin().
-- =============================================
create table if not exists public.pin_attempts (
  id bigint generated always as identity primary key,
  attempted_at timestamptz not null default now(),
  success boolean not null default false
);

-- Crea índices para el barrido de intentos recientes
create index if not exists idx_pin_attempts_time
  on public.pin_attempts (attempted_at);

-- Hash del PIN en inserciones/actualizaciones.
-- El PIN se guarda como hash bcrypt (pgcrypto) y jamás en texto plano.
create or replace function public.hash_employee_pin()
returns trigger
language plpgsql
security definer set search_path = public, extensions
as $$
begin
  if TG_OP = 'INSERT' or new.pin is distinct from old.pin then
    -- Solo trata PINs en texto plano (no vuelve a hashear ya-hasheados)
    if new.pin not like '$2%' then
      -- Unicidad: verificar contra hashes existentes sin descifrarlos
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

drop trigger if exists on_employee_pin_hash on public.employees;
create trigger on_employee_pin_hash
  before insert or update of pin on public.employees
  for each row execute procedure public.hash_employee_pin();

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
-- TABLA: kiosk_settings
-- Configuración visual del kiosco (título, logo).
-- Solo existe una fila (id fijo = 1).
-- =============================================
create table if not exists public.kiosk_settings (
  id int primary key default 1 check (id = 1),
  title text not null default 'FichaMe',
  subtitle text not null default 'Introduce tu código para fichar',
  logo_url text,
  brand_color text not null default '#1F7A50',
  updated_at timestamptz not null default now()
);

insert into public.kiosk_settings (id) values (1)
  on conflict (id) do nothing;

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

-- Helper: comprueba si el usuario autenticado es admin.
-- Corre con security definer para NO volver a aplicar RLS sobre profiles
-- y así evitar la "infinite recursion detected in policy".
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

-- Profiles: solo el usuario puede ver/editar su propio perfil; admins ven todos
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

-- Employees: solo admins pueden gestionar empleados
drop policy if exists "Admins manage employees" on public.employees;
create policy "Admins manage employees"
  on public.employees for all
  using (public.is_admin());

-- Clockings: admins pueden gestionar todos los fichajes
drop policy if exists "Admins manage clockings" on public.clockings;
create policy "Admins manage clockings"
  on public.clockings for all
  using (public.is_admin());

-- Work shifts: admins gestionan
drop policy if exists "Admins manage work shifts" on public.work_shifts;
create policy "Admins manage work shifts"
  on public.work_shifts for all
  using (public.is_admin());

drop policy if exists "Authenticated users view work shifts" on public.work_shifts;
create policy "Authenticated users view work shifts"
  on public.work_shifts for select
  using (auth.role() = 'authenticated');

drop policy if exists "Admins manage assigned shifts" on public.assigned_shifts;
create policy "Admins manage assigned shifts"
  on public.assigned_shifts for all
  using (public.is_admin());

drop policy if exists "Authenticated users view assigned shifts" on public.assigned_shifts;
create policy "Authenticated users view assigned shifts"
  on public.assigned_shifts for select
  using (auth.role() = 'authenticated');

-- Pin attempts: solo admins ven el histórico de intentos
drop policy if exists "Admins view pin attempts" on public.pin_attempts;
create policy "Admins view pin attempts"
  on public.pin_attempts for select
  using (public.is_admin());

-- Kiosk settings: anyone can read, solo admins pueden editar
drop policy if exists "Anyone view kiosk settings" on public.kiosk_settings;
create policy "Anyone view kiosk settings"
  on public.kiosk_settings for select
  using (true);

drop policy if exists "Admins manage kiosk settings" on public.kiosk_settings;
create policy "Admins manage kiosk settings"
  on public.kiosk_settings for all
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================
-- FUNCIONES RPC
-- =============================================

-- Verificar PIN de un empleado
-- Devuelve el empleado si el PIN es correcto y está activo.
-- Comprime contra el hash bcrypt. Incluye rate limiting
-- anti fuerza bruta: más de 8 fallos en 10 min bloquea 5 min.
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
  -- Limpieza básica del histórico
  delete from public.pin_attempts
  where attempted_at < now() - interval '1 day';

  -- Rate limiting: cuenta fallos recientes
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

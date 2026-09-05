-- =============================================
-- FichaMe - Migración: ausencias + días festivos
-- No destructiva: conserva los datos existentes.
-- Ejecuta este script en el SQL Editor de Supabase.
-- =============================================

-- 1. Ampliar clockings.type con 'absence' + columna absence_reason
alter table public.clockings
  drop constraint if exists clockings_type_check;

alter table public.clockings
  drop constraint if exists ck_clockings_type;

alter table public.clockings
  add constraint ck_clockings_type check (type in ('in', 'out', 'absence'));

alter table public.clockings
  add column if not exists absence_reason text
    constraint ck_clockings_absence_reason
    check (absence_reason is null or absence_reason in ('sickness', 'vacation', 'unspecified'));

-- 2. Tabla de días festivos
create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_holidays_date
  on public.holidays (date);

alter table public.holidays enable row level security;

drop policy if exists "Anyone view holidays" on public.holidays;
create policy "Anyone view holidays"
  on public.holidays for select
  using (true);

drop policy if exists "Admins manage holidays" on public.holidays;
create policy "Admins manage holidays"
  on public.holidays for all
  using (public.is_admin());

-- 3. RPC create_clocking: soporta 'absence' + motivo
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

-- 4. RPC get_last_clocking: ignora ausencias para no romper el ciclo
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
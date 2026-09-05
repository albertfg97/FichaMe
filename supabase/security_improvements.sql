-- =============================================
-- FichaMe - Seguridad y mejoras
-- (1) PIN cifrados con bcrypt
-- (2) Rate limiting anti fuerza bruta en el kiosco
-- Ejecuta este script en el SQL Editor de Supabase
-- sobre una BD que ya tenga el schema original.
-- Es idempotente: se puede re-ejecutar sin riesgo.
-- =============================================

-- Extensión (por si no está en la BD)
create extension if not exists "pgcrypto";

-- =============================================
-- (2) TABLA: pin_attempts + RLS
-- =============================================
create table if not exists public.pin_attempts (
  id bigint generated always as identity primary key,
  attempted_at timestamptz not null default now(),
  success boolean not null default false
);

create index if not exists idx_pin_attempts_time
  on public.pin_attempts (attempted_at);

alter table public.pin_attempts enable row level security;

drop policy if exists "Admins view pin attempts" on public.pin_attempts;
create policy "Admins view pin attempts"
  on public.pin_attempts for select
  using (public.is_admin());

-- =============================================
-- (1) Hashear PINs existentes (texto plano -> bcrypt)
-- Solo toca los PINs que no parecen ya hasheados.
-- =============================================
update public.employees
set pin = crypt(pin, gen_salt('bf'))
where pin not like '$2%';

-- =============================================
-- (1) Trigger que hashea el PIN al insertar/editar
-- =============================================
create or replace function public.hash_employee_pin()
returns trigger
language plpgsql
security definer set search_path = public
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

drop trigger if exists on_employee_pin_hash on public.employees;
create trigger on_employee_pin_hash
  before insert or update of pin on public.employees
  for each row execute procedure public.hash_employee_pin();

-- =============================================
-- (2) verify_pin: verifica contra hash + rate limiting
-- =============================================
create or replace function public.verify_pin(
  p_pin text
)
returns json
language plpgsql
security definer set search_path = public
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
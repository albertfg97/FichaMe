// Types compartidos para toda la app

export type Role = 'admin' | 'employee';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  created_at: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  position: string;
  pin: string;
  is_active: boolean;
  created_at: string;
}

export interface Clocking {
  id: string;
  employee_id: string;
  type: ClockingType;
  absence_reason?: AbsenceReason | null;
  clocked_at: string;
  original_time?: string | null;
  corrected_by?: string | null;
  created_at: string;
  employee_name?: string; // Join con empleados si se hace query
}

export type ClockingType = 'in' | 'out' | 'absence';

export type AbsenceReason = 'sickness' | 'vacation' | 'unspecified';

export const CLOCKING_TYPE_LABELS: Record<ClockingType, string> = {
  in: 'Entrada',
  out: 'Salida',
  absence: 'Ausencia',
};

export const CLOCKING_TYPE_COLORS: Record<ClockingType, string> = {
  in: 'text-emerald-600 bg-emerald-50',
  out: 'text-rose-600 bg-rose-50',
  absence: 'text-amber-600 bg-amber-50',
};

export const ABSENCE_REASON_LABELS: Record<AbsenceReason, string> = {
  sickness: 'Enfermedad',
  vacation: 'Vacaciones',
  unspecified: 'No especificado',
};

export const ABSENCE_REASONS: AbsenceReason[] = ['sickness', 'vacation', 'unspecified'];

export function clockingLabel(type: ClockingType, reason?: AbsenceReason | null): string {
  if (type === 'absence') {
    const r = reason ? ABSENCE_REASON_LABELS[reason] : ABSENCE_REASON_LABELS.unspecified;
    return `Ausencia · ${r}`;
  }
  return CLOCKING_TYPE_LABELS[type];
}

export interface WorkShift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

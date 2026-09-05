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
  type: 'in' | 'out';
  clocked_at: string;
  original_time?: string | null;
  corrected_by?: string | null;
  created_at: string;
  employee_name?: string; // Join con empleados si se hace query
}

export type ClockingType = 'in' | 'out';

export const CLOCKING_TYPE_LABELS: Record<ClockingType, string> = {
  in: 'Entrada',
  out: 'Salida',
};

export const CLOCKING_TYPE_COLORS: Record<ClockingType, string> = {
  in: 'text-emerald-600 bg-emerald-50',
  out: 'text-rose-600 bg-rose-50',
};

export interface WorkShift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

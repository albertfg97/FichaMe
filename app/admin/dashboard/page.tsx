'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Clocking } from '@/lib/types';
import { clockingLabel } from '@/lib/types';
import {
  IconUsers,
  IconLogout,
  IconLogout2,
  IconClockHour4,
  IconArrowUpRight,
  IconCalendarOff,
} from '@tabler/icons-react';

interface DailyOverview {
  date: string;
  total_employees: number;
  clocked_in: number;
  clocked_out: number;
  pending: number;
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<DailyOverview | null>(null);
  const [recentClockings, setRecentClockings] = useState<Clocking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: overviewData } = await supabase.rpc('get_daily_overview', {
        p_date: new Date().toISOString().slice(0, 10),
      });

      if (overviewData) setOverview(overviewData);

      const { data: latestClockings } = await supabase
        .from('clockings')
        .select('*, employees(name)')
        .order('clocked_at', { ascending: false })
        .limit(8);

      if (latestClockings) {
        const mapped: Clocking[] = latestClockings.map((c: any) => ({
          ...c,
          employee_name: c.employees?.name ?? 'Desconocido',
        }));
        setRecentClockings(mapped);
      }

      setLoading(false);
    }
    load();
  }, []);

  const today = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl capitalize ">
          Inicio
        </h1>
        <p className="text-stone-500 text-sm capitalize ">
          {today}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl h-28 animate-pulse bg-stone-100 "
            />
          ))}
        </div>
      ) : (
        overview && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Empleados"
              value={overview.total_employees}
              sub="en plantilla"
              Icon={IconUsers}
              accent="bg-brand/10 text-brand"
            />
            <StatCard
              label="Entradas"
              value={overview.clocked_in}
              sub="fichajes de hoy"
              Icon={IconLogout}
              accent="bg-emerald-100/70 text-emerald-700  "
            />
            <StatCard
              label="Salidas"
              value={overview.clocked_out}
              sub="fichajes de hoy"
              Icon={IconLogout2}
              accent="bg-rose-100/70 text-rose-700  "
            />
            <StatCard
              label="Pendientes"
              value={overview.pending}
              sub="sin fichar"
              Icon={IconClockHour4}
              accent="bg-amber-100/70 text-amber-700  "
            />
          </div>
        )
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold tracking-tight ">
            Actividad reciente
          </h2>
          <IconArrowUpRight
            size={20}
            className="text-stone-300 "
            stroke={2}
          />
        </div>
        {recentClockings.length === 0 ? (
          <p className="text-sm text-stone-500 py-4 text-center ">
            Cuando los empleados fichan, lo verás aquí.
          </p>
        ) : (
          <div className="divide-y divide-stone-100 ">
            {recentClockings.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      c.type === 'in'
                        ? 'bg-emerald-100/70 text-emerald-700  '
                        : c.type === 'out'
                        ? 'bg-rose-100/70 text-rose-700  '
                        : 'bg-amber-100/70 text-amber-700  '
                    }`}
                  >
                    {c.type === 'in' ? (
                      <IconLogout size={18} stroke={2} />
                    ) : c.type === 'out' ? (
                      <IconLogout2 size={18} stroke={2} />
                    ) : (
                      <IconCalendarOff size={18} stroke={2} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate ">
                      {c.employee_name}
                    </div>
                    <div className="text-xs text-stone-500 ">
                      {clockingLabel(c.type, c.absence_reason)}
                      {c.corrected_by ? ' · Corregido' : ''}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold font-mono tabular-nums text-stone-700 ">
                    {new Date(c.clocked_at).toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <div className="text-xs text-stone-500 ">
                    {new Date(c.clocked_at).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  Icon,
  accent,
}: {
  label: string;
  value: number;
  sub: string;
  Icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-4  ">
      <div className="flex items-start justify-between mb-2">
        <div className="text-2xl font-bold font-mono tabular-nums ">
          {value}
        </div>
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center ${accent}`}
        >
          <Icon size={18} stroke={2} />
        </div>
      </div>
      <div className="text-sm font-medium text-stone-500 ">
        {label}
      </div>
      <div className="text-xs text-stone-500">{sub}</div>
    </div>
  );
}
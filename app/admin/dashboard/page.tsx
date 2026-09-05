'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Clocking } from '@/lib/types';
import {
  IconUsers,
  IconLogout,
  IconLogout2,
  IconClockHour4,
  IconArrowUpRight,
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
        <h1 className="text-2xl font-bold capitalize">Inicio</h1>
        <p className="text-slate-500 text-sm capitalize">{today}</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl h-28 animate-pulse bg-slate-100"
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
              accent="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              label="Salidas"
              value={overview.clocked_out}
              sub="fichajes de hoy"
              Icon={IconLogout2}
              accent="bg-rose-50 text-rose-600"
            />
            <StatCard
              label="Pendientes"
              value={overview.pending}
              sub="sin fichar"
              Icon={IconClockHour4}
              accent="bg-amber-50 text-amber-600"
            />
          </div>
        )
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Actividad reciente</h2>
          <IconArrowUpRight size={20} className="text-slate-300" stroke={2} />
        </div>
        {recentClockings.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">
            Cuando los empleados fichan, lo verás aquí.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentClockings.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      c.type === 'in'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                    {c.type === 'in' ? (
                      <IconLogout size={18} stroke={2} />
                    ) : (
                      <IconLogout2 size={18} stroke={2} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {c.employee_name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {c.type === 'in' ? 'Entrada' : 'Salida'}
                      {c.corrected_by && ' · Corregido'}
                    </div>
                  </div>
                </div>
                <div className="text-sm font-semibold text-slate-700 tabular-nums">
                  {new Date(c.clocked_at).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
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
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${accent}`}
      >
        <Icon size={20} stroke={2} />
      </div>
      <div className="text-3xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-slate-500 mt-1">
        {label} · {sub}
      </div>
    </div>
  );
}
'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import type { Clocking, Employee } from '@/lib/types';
import { IconDownload, IconPencil, IconInbox } from '@tabler/icons-react';

interface FullClocking extends Clocking {
  employee_name: string;
}

export default function ReportsPage() {
  const [clockings, setClockings] = useState<FullClocking[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [editingClocking, setEditingClocking] = useState<FullClocking | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    const today = new Date();
    const monthAgo = new Date();
    monthAgo.setDate(today.getDate() - 30);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
    setFromDate(fmt(monthAgo));
    setToDate(fmt(today));
  }, []);

  function buildQuery() {
    let query = supabase
      .from('clockings')
      .select('*, employees(name)')
      .order('clocked_at', { ascending: false });

    if (fromDate) query = query.gte('clocked_at', `${fromDate}T00:00:00`);
    if (toDate) query = query.lte('clocked_at', `${toDate}T23:59:59`);
    if (employeeFilter !== 'all') query = query.eq('employee_id', employeeFilter);

    return query;
  }

  async function loadClockings() {
    setLoading(true);
    const { data } = await buildQuery();
    if (data) {
      const mapped: FullClocking[] = data.map((c: any) => ({
        ...c,
        employee_name: c.employees?.name ?? 'Desconocido',
      }));
      setClockings(mapped);
    }
    setLoading(false);
  }

  useEffect(() => {
    supabase
      .from('employees')
      .select('*')
      .order('name')
      .then(({ data }) => {
        if (data) setEmployees(data as Employee[]);
      });
    loadClockings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadClockings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, employeeFilter]);

  function openEdit(c: FullClocking) {
    setEditingClocking(c);
    const d = new Date(c.clocked_at);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setEditValue(local);
  }

  async function handleSaveEdit() {
    if (!editingClocking || !editValue) return;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      toast.error('Sesión expirada');
      return;
    }

    const { data, error } = await supabase.rpc('correct_clocking_time', {
      p_clocking_id: editingClocking.id,
      p_new_time: new Date(editValue).toISOString(),
      p_admin_id: userData.user.id,
    });

    if (error) {
      console.error(error);
      toast.error('Error al corregir la hora');
      return;
    }

    toast.success('Fichaje corregido');
    setEditingClocking(null);
    loadClockings();
  }

  const exportCSV = useMemo(() => {
    return () => {
      const header = ['Empleado', 'Tipo', 'Fecha y hora', 'Corregido'];
      const rows = clockings.map((c) => [
        c.employee_name,
        c.type === 'in' ? 'Entrada' : 'Salida',
        new Date(c.clocked_at).toLocaleString('es-ES'),
        c.corrected_by ? 'Sí' : 'No',
      ]);
      const csv = [header, ...rows]
        .map((row) => row.map((cell) => `"${cell}"`).join(','))
        .join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fichajes_${fromDate}_${toDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };
  }, [clockings, fromDate, toDate]);

  function formatDateTime(iso: string) {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      time: d.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-slate-500 text-sm">
            Filtra por fecha y empleado
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="btn-primary !px-3"
          aria-label="Exportar CSV"
        >
          <IconDownload size={20} stroke={2.5} />
          <span className="hidden sm:inline">CSV</span>
        </button>
      </div>

      <div className="card !p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Desde</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="input text-base"
            />
          </div>
          <div>
            <label className="label">Hasta</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="input text-base"
            />
          </div>
          <div className="col-span-2">
            <label className="label">Empleado</label>
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="input text-base"
            >
              <option value="all">Todos los empleados</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-slate-100 animate-pulse h-20" />
          ))}
        </div>
      ) : clockings.length === 0 ? (
        <div className="card text-center py-14">
          <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <IconInbox size={30} className="text-slate-400" stroke={1.75} />
          </div>
          <p className="text-slate-500">
            No hay fichajes en el rango seleccionado
          </p>
        </div>
      ) : (
        <>
          {/* Vista móvil: tarjetas */}
          <div className="space-y-3 md:hidden">
            {clockings.map((c) => {
              const { date, time } = formatDateTime(c.clocked_at);
              return (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-slate-900 text-sm">
                      {c.employee_name}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        c.type === 'in'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {c.type === 'in' ? 'Entrada' : 'Salida'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-sm text-slate-500">
                      {date} ·{' '}
                      <span className="font-semibold text-slate-700 tabular-nums">
                        {time}
                      </span>
                    </div>
                    {c.corrected_by && (
                      <span className="text-[11px] text-amber-600 font-medium">
                        Corregido
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => openEdit(c)}
                    className="mt-3 w-full py-2.5 rounded-xl text-sm font-medium bg-brand/10 text-brand active:scale-95 transition-transform inline-flex items-center justify-center gap-1.5"
                  >
                    <IconPencil size={16} stroke={2} /> Corregir hora
                  </button>
                </div>
              );
            })}
          </div>

          {/* Vista escritorio: tabla */}
          <div className="hidden md:block card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Empleado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Hora
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {clockings.map((c) => {
                    const { date, time } = formatDateTime(c.clocked_at);
                    return (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-sm font-medium">
                          {c.employee_name}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              c.type === 'in'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {c.type === 'in' ? 'Entrada' : 'Salida'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700">
                          {date}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700 tabular-nums">
                          {time}
                        </td>
                        <td className="px-6 py-4">
                          {c.corrected_by ? (
                            <span className="text-xs text-amber-600 font-medium">
                              Corregido
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">
                              Normal
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => openEdit(c)}
                            className="text-sm text-brand hover:text-brand-dark font-medium inline-flex items-center gap-1"
                          >
                            <IconPencil size={15} stroke={2} /> Corregir hora
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {editingClocking && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50">
          <div className="bg-white rounded-t-3xl md:rounded-xl shadow-xl w-full md:max-w-sm p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
            <div className="md:hidden w-10 h-1 rounded-full bg-slate-200 mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-1">Corregir fichaje</h2>
            <p className="text-sm text-slate-500 mb-4">
              {editingClocking.employee_name} —{' '}
              {editingClocking.type === 'in' ? 'Entrada' : 'Salida'}
            </p>

            <label className="label">Nueva fecha y hora</label>
            <input
              type="datetime-local"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="input text-base"
            />
            <p className="text-xs text-slate-400 mt-1.5 mb-4">
              Útil cuando al empleado se le olvidó fichar a tiempo.
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setEditingClocking(null)}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button onClick={handleSaveEdit} className="btn-primary">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
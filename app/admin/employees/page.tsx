'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import type { Employee } from '@/lib/types';
import {
  IconPlus,
  IconPencil,
  IconTrash,
  IconPower,
  IconUserPlus,
} from '@tabler/icons-react';

interface EmployeeForm {
  name: string;
  email: string;
  phone: string;
  position: string;
  pin: string;
}

const emptyForm: EmployeeForm = {
  name: '',
  email: '',
  phone: '',
  position: '',
  pin: '',
};

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  async function loadEmployees() {
    const { data } = await supabase
      .from('employees')
      .select('*')
      .order('name');
    if (data) setEmployees(data as Employee[]);
    setLoading(false);
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(emp: Employee) {
    setEditing(emp);
    setForm({
      name: emp.name,
      email: emp.email ?? '',
      phone: emp.phone ?? '',
      position: emp.position ?? '',
      pin: '',
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    if (!form.pin.trim()) {
      toast.error('El código PIN es obligatorio');
      return;
    }
    if (!/^\d+$/.test(form.pin)) {
      toast.error('El PIN solo puede contener números');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const updates: Record<string, unknown> = {
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          position: form.position.trim() || '',
        };
        if (form.pin.trim()) updates.pin = form.pin.trim();
        const { error } = await supabase
          .from('employees')
          .update(updates)
          .eq('id', editing.id);
        if (error) throw error;
        toast.success('Empleado actualizado');
      } else {
        const { error } = await supabase
          .from('employees')
          .insert({
            name: form.name.trim(),
            email: form.email.trim() || null,
            phone: form.phone.trim() || null,
            position: form.position.trim() || '',
            pin: form.pin.trim(),
          });
        if (error) throw error;
        toast.success('Empleado creado');
      }
      setShowModal(false);
      loadEmployees();
    } catch (err: any) {
      if (err?.code === '23505') {
        toast.error('Ya existe un empleado con ese PIN');
      } else {
        console.error(err);
        toast.error('Error al guardar el empleado');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(emp: Employee) {
    const { error } = await supabase
      .from('employees')
      .update({ is_active: !emp.is_active })
      .eq('id', emp.id);
    if (error) {
      toast.error('Error al cambiar el estado');
      return;
    }
    toast.success(emp.is_active ? 'Empleado desactivado' : 'Empleado activado');
    loadEmployees();
  }

  async function handleDelete(emp: Employee) {
    if (!confirm(`¿Eliminar a ${emp.name}? Se borrarán también sus fichajes.`)) return;
    const { error } = await supabase.from('employees').delete().eq('id', emp.id);
    if (error) {
      toast.error('Error al eliminar el empleado');
      return;
    }
    toast.success('Empleado eliminado');
    loadEmployees();
  }

  const activeCount = employees.filter((e) => e.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl ">
            Empleados
          </h1>
          <p className="text-stone-500 text-sm ">
            {activeCount} activos · {employees.length} totales
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary !px-3">
          <IconPlus size={20} stroke={2.5} />
          <span className="hidden sm:inline">Nuevo</span>
        </button>
      </div>

      {loading ? (
        <div className="space-y-3 md:space-y-0 md:grid md:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl bg-stone-100 animate-pulse h-32 md:h-16 "
            />
          ))}
        </div>
      ) : employees.length === 0 ? (
        <div className="card text-center py-14">
          <div className="w-16 h-16 mx-auto rounded-full bg-brand/10 flex items-center justify-center mb-4">
            <IconUserPlus size={30} className="text-brand" stroke={1.75} />
          </div>
          <p className="text-stone-500 mb-4 ">
            Aún no hay empleados
          </p>
          <button onClick={openCreate} className="btn-primary">
            Crear el primero
          </button>
        </div>
      ) : (
        <>
          {/* Vista móvil: tarjetas */}
          <div className="space-y-3 md:hidden">
            {employees.map((emp) => (
              <div
                key={emp.id}
                className="bg-white rounded-2xl border border-stone-200 p-4 shadow-soft  "
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-brand/10 text-brand flex items-center justify-center text-sm font-bold shrink-0">
                      {initials(emp.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-stone-900 truncate ">
                        {emp.name}
                      </div>
                      <div className="text-xs text-stone-500 truncate ">
                        {emp.position || 'Sin puesto'}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-1 rounded-full text-[11px] font-semibold ${
                      emp.is_active
                        ? 'bg-emerald-100/70 text-emerald-700  '
                        : 'bg-stone-100 text-stone-500  '
                    }`}
                  >
                    {emp.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => openEdit(emp)}
                    className="py-2.5 rounded-xl text-sm font-medium bg-brand/10 text-brand active:scale-95 transition-transform inline-flex items-center justify-center gap-1.5 "
                  >
                    <IconPencil size={16} stroke={2} /> Editar
                  </button>
                  <button
                    onClick={() => handleToggleActive(emp)}
                    className={`py-2.5 rounded-xl text-sm font-medium active:scale-95 transition-transform inline-flex items-center justify-center gap-1.5 ${
                      emp.is_active
                        ? 'bg-amber-100/70 text-amber-700  '
                        : 'bg-emerald-100/70 text-emerald-700  '
                    }`}
                  >
                    <IconPower size={16} stroke={2} />
                    {emp.is_active ? 'Baja' : 'Alta'}
                  </button>
                  <button
                    onClick={() => handleDelete(emp)}
                    className="py-2.5 rounded-xl text-sm font-medium bg-rose-100/70 text-rose-700 active:scale-95 transition-transform inline-flex items-center justify-center gap-1.5  "
                  >
                    <IconTrash size={16} stroke={2} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Vista escritorio: tabla */}
          <div className="hidden md:block card overflow-hidden p-0">
            <table className="min-w-full divide-y divide-stone-200 ">
              <thead className="bg-stone-50 ">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider ">
                    Empleado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider ">
                    Puesto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider ">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider ">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-stone-100  ">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-stone-50 ">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center text-xs font-bold">
                          {initials(emp.name)}
                        </div>
                        <div>
                          <div className="text-sm font-medium ">
                            {emp.name}
                          </div>
                          <div className="text-xs text-stone-500 ">
                            {emp.email || 'Sin email'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-700 ">
                      {emp.position || 'Sin puesto'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          emp.is_active
                            ? 'bg-emerald-100/70 text-emerald-700  '
                            : 'bg-stone-100 text-stone-500  '
                        }`}
                      >
                        {emp.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-3">
                        <button
                          onClick={() => openEdit(emp)}
                          className="text-sm text-brand font-medium"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleToggleActive(emp)}
                          className="text-sm text-amber-600 font-medium "
                        >
                          {emp.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          onClick={() => handleDelete(emp)}
                          className="text-sm text-rose-600 font-medium "
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-stone-950/50 flex items-end md:items-center justify-center z-50">
          <div className="bg-white rounded-t-3xl md:rounded-2xl shadow-lift w-full md:max-w-md p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] max-h-[92dvh] overflow-y-auto ">
            <div className="md:hidden w-10 h-1 rounded-full bg-stone-200 mx-auto mb-4 " />
            <h2 className="text-lg font-bold mb-4 tracking-tight ">
              {editing ? 'Editar empleado' : 'Nuevo empleado'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="label">Nombre completo *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input text-base"
                  placeholder="Juan Pérez"
                />
              </div>

              <div>
                <label className="label">Puesto</label>
                <input
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                  className="input text-base"
                  placeholder="Camarero"
                />
              </div>

              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="input text-base"
                  placeholder="juan@empresa.com"
                />
              </div>

              <div>
                <label className="label">Teléfono</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="input text-base"
                  placeholder="600 000 000"
                  inputMode="tel"
                />
              </div>

              <div>
                <label className="label">
                  {editing ? 'Nuevo código PIN (opcional)' : 'Código PIN para fichar *'}
                </label>
                <input
                  value={form.pin}
                  onChange={(e) =>
                    setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })
                  }
                  className="input font-mono text-lg text-center tracking-[0.3em]"
                  placeholder={editing ? 'Dejar en blanco para no cambiar' : '••••'}
                  maxLength={4}
                  inputMode="numeric"
                />
                <p className="text-xs text-stone-500 mt-1.5 ">
                  {editing
                    ? 'Si lo dejas vacío, el empleado conserva su código actual. 4 dígitos numéricos'
                    : 'El empleado usará este código en el teclado de fichaje (4 dígitos)'}
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="btn-secondary"
                disabled={saving}
              >
                Cancelar
              </button>
              <button onClick={handleSave} className="btn-primary" disabled={saving}>
                {saving
                  ? 'Guardando...'
                  : editing
                  ? 'Guardar cambios'
                  : 'Crear empleado'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
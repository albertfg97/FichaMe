'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  IconArrowLeft,
  IconCheck,
  IconClock,
  IconLogout,
  IconScan,
  IconUserCircle,
  IconX,
} from '@tabler/icons-react';

interface LoadedEmployee {
  id: string;
  name: string;
  position: string;
}

type Step = 'pin' | 'confirming' | 'ready';

const numericKeypadRows = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['C', '0', '⌫'],
];

function formatCurrentTime(date: Date) {
  return date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrentDate(date: Date) {
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export default function ClockingPage() {
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<Step>('pin');
  const [employee, setEmployee] = useState<LoadedEmployee | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastClocking, setLastClocking] = useState<{ type: 'in' | 'out' } | null>(null);
  const [customTime, setCustomTime] = useState('');
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [now, setNow] = useState(new Date());
  const [lastClockingAt, setLastClockingAt] = useState<string | null>(null);
  const [lockSeconds, setLockSeconds] = useState(0);

  // Reloj en vivo para la pantalla principal
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(t);
  }, []);

  // Cuenta atrás del bloqueo por demasiados intentos
  useEffect(() => {
    if (lockSeconds <= 0) return;
    const t = setInterval(
      () => setLockSeconds((s) => Math.max(0, s - 1)),
      1000
    );
    return () => clearInterval(t);
  }, [lockSeconds > 0]);

  useEffect(() => {
    if (useCustomTime) {
      const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setCustomTime(local);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useCustomTime]);

  async function handleVerifyPin() {
    if (pin.length < 3) {
      toast.error('Introduce tu código');
      return;
    }
    if (lockSeconds > 0) {
      toast.error(`Espera ${lockSeconds}s para volver a intentar`);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('verify_pin', {
        p_pin: pin,
      });

      if (error) throw error;

      const result = data as { error?: string; retry_after?: number } | null;

      if (!result || result.error) {
        if (result?.error === 'too_many_attempts') {
          const secs = Math.max(1, Math.ceil(result.retry_after ?? 1));
          setLockSeconds(secs);
          toast.error('Demasiados intentos. Inténtalo de nuevo en unos minutos');
        } else {
          toast.error('Código incorrecto');
        }
        setPin('');
        return;
      }

      setEmployee(result as unknown as LoadedEmployee);

      const { data: last } = await supabase.rpc('get_last_clocking', {
        p_employee_id: (result as LoadedEmployee).id,
      });

      if (last && last.error !== 'no_clockings') {
        setLastClocking(last);
        setLastClockingAt(last.clocked_at);
      } else {
        setLastClocking(null);
        setLastClockingAt(null);
      }

      setStep('confirming');
    } catch (err) {
      console.error(err);
      toast.error('Error verificando el código');
    } finally {
      setLoading(false);
    }
  }

  const nextType: 'in' | 'out' =
    !lastClocking || lastClocking.type === 'out' ? 'in' : 'out';

  async function handleConfirm() {
    if (!employee) return;
    setLoading(true);

    try {
      const clocked_at =
        useCustomTime && customTime
          ? new Date(customTime).toISOString()
          : new Date().toISOString();

      const { data, error } = await supabase.rpc('create_clocking', {
        p_employee_id: employee.id,
        p_type: nextType,
        p_clocked_at: clocked_at,
      });

      if (error) throw error;

      setLoading(false);
      setStep('ready');
    } catch (err) {
      console.error(err);
      toast.error('Error al registrar el fichaje');
      setLoading(false);
    }
  }

  function resetPage() {
    setPin('');
    setEmployee(null);
    setLastClocking(null);
    setLastClockingAt(null);
    setUseCustomTime(false);
    setCustomTime('');
    setLoading(false);
    setStep('pin');
  }

  if (step === 'ready') {
    return (
      <main className="min-h-[100dvh] bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-xs text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-5">
            <IconCheck size={40} className="text-emerald-600" stroke={2.5} />
          </div>
          <h1 className="text-2xl font-bold mb-1">
            {nextType === 'in' ? 'Entrada' : 'Salida'} registrada
          </h1>
          <p className="text-slate-500 mb-6">
            {employee?.name} ·{' '}
            {new Date().toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          <button onClick={resetPage} className="btn-primary w-full py-3">
            Fichar otro empleado
          </button>
        </div>
      </main>
    );
  }

  if (step === 'confirming' && employee) {
    return (
      <main className="min-h-[100dvh] flex flex-col">
        <div className="flex-1 flex flex-col justify-center px-6 pt-10 pb-4">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto rounded-full bg-brand/10 flex items-center justify-center mb-4">
              <IconUserCircle size={44} className="text-brand" stroke={1.75} />
            </div>
            <h1 className="text-2xl font-bold">{employee.name}</h1>
            {employee.position && (
              <p className="text-sm text-slate-500 mt-0.5">{employee.position}</p>
            )}
            {lastClockingAt && (
              <p className="text-xs text-slate-400 mt-2">
                Último fichaje:{' '}
                {new Date(lastClockingAt).toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>

          <div className="text-center mb-6">
            <div className="text-5xl font-bold tabular-nums text-slate-900">
              {formatCurrentTime(now)}
            </div>
            <div className="text-sm text-slate-500 mt-1 capitalize">
              {formatCurrentDate(now)}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <button
              onClick={handleConfirm}
              disabled={loading}
              className={`w-full py-5 rounded-xl text-xl font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform ${
                nextType === 'in'
                  ? 'bg-emerald-600 active:bg-emerald-700'
                  : 'bg-rose-600 active:bg-rose-700'
              }`}
            >
              <IconLogout
                size={26}
                stroke={2}
                className={nextType === 'out' ? 'rotate-180' : ''}
              />
              {loading
                ? 'Registrando...'
                : nextType === 'in'
                ? 'Registrar entrada'
                : 'Registrar salida'}
            </button>

            <button
              onClick={() => setUseCustomTime(!useCustomTime)}
              className={`mt-3 w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${
                useCustomTime
                  ? 'bg-brand text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              <IconClock size={18} stroke={2} />
              {useCustomTime ? 'Corrigiendo hora…' : 'Corregir hora'}
            </button>

            {useCustomTime && (
              <div className="mt-3">
                <input
                  type="datetime-local"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="input text-base"
                />
                <p className="text-xs text-slate-400 mt-1.5 text-center">
                  ¿Se te olvidó fichar? Ajusta la hora real.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="pb-[max(env(safe-area-inset-bottom),1rem)] px-6">
          <button
            onClick={resetPage}
            className="w-full py-3 text-sm text-slate-500 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
          >
            <IconArrowLeft size={16} stroke={2} /> No soy {employee.name}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] flex flex-col bg-gradient-to-b from-brand-dark to-brand pt-[max(env(safe-area-inset-top),1.5rem)] pb-[max(env(safe-area-inset-bottom),1rem)]">
      <div className="text-center px-4 mb-5">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur mb-3">
          <IconScan size={30} className="text-white" stroke={1.75} />
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">FichaMe</h1>
        <p className="text-white/80 text-base mt-1">Introduce tu código para fichar</p>

        <div className="text-white/70 text-sm mt-4">
          <div className="text-4xl font-bold text-white tabular-nums">
            {formatCurrentTime(now)}
          </div>
          <div className="mt-1 capitalize">{formatCurrentDate(now)}</div>
        </div>
      </div>

      <div className="flex-1 flex items-end justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-5 mb-2">
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-500">
                Tu código
              </span>
              {pin.length > 0 && (
                <button
                  onClick={() => setPin('')}
                  className="text-xs text-brand font-medium flex items-center gap-1"
                >
                  <IconX size={14} stroke={2} /> Borrar
                </button>
              )}
            </div>
            <div className="flex justify-center gap-3" aria-label="PIN introducido">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-14 flex-1 rounded-xl border-2 transition-all ${
                    i < pin.length
                      ? 'bg-brand border-brand shadow-md'
                      : 'border-slate-300 bg-slate-50'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-3" role="group">
            {numericKeypadRows.map((row, r) => (
              <div key={r} className="grid grid-cols-3 gap-3">
                {row.map((key) => {
                  const isClear = key === 'C';
                  const isDelete = key === '⌫';
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        if (isClear) setPin('');
                        else if (isDelete) setPin(pin.slice(0, -1));
                        else if (pin.length < 6) setPin(pin + key);
                      }}
                      className={`h-16 rounded-2xl text-2xl font-semibold flex items-center justify-center active:scale-95 transition-transform select-none ${
                        isClear
                          ? 'text-slate-500 bg-slate-100 active:bg-slate-200'
                          : isDelete
                          ? 'text-slate-500 bg-slate-100 active:bg-slate-200'
                          : 'bg-slate-100 text-slate-900 shadow-sm active:bg-brand active:text-white'
                      }`}
                    >
                      {isDelete ? (
                        <span className="text-xl">⌫</span>
                      ) : (
                        key
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {lockSeconds > 0 && (
            <div className="my-4 text-center text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3">
              Demasiados intentos fallidos. Inténtalo de nuevo en{' '}
              <span className="font-semibold tabular-nums">{lockSeconds}s</span>
            </div>
          )}

          <button
            onClick={handleVerifyPin}
            disabled={loading || pin.length < 3 || lockSeconds > 0}
            className="mt-4 w-full py-4 rounded-2xl text-lg font-bold bg-brand text-white active:scale-[0.98] transition-transform disabled:opacity-40 disabled:active:scale-100"
          >
            {lockSeconds > 0
              ? `Espera ${lockSeconds}s`
              : loading
              ? 'Verificando…'
              : 'Fichar'}
          </button>
        </div>
      </div>

      <div className="text-center mt-4">
        <Link
          href="/admin"
          className="text-white/70 text-sm inline-flex items-center justify-center active:scale-95 transition-transform"
        >
          Panel de administración
        </Link>
      </div>
    </main>
  );
}
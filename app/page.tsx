'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import ClockTimePicker from '@/components/ClockTimePicker';
import {
  IconArrowLeft,
  IconBackspace,
  IconCheck,
  IconClock,
  IconLogin2,
  IconLogout2,
  IconScan,
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

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function ClockingPage() {
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<Step>('pin');
  const [employee, setEmployee] = useState<LoadedEmployee | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastClocking, setLastClocking] = useState<{ type: 'in' | 'out' } | null>(null);
  const [customDate, setCustomDate] = useState('');
  const [customHour, setCustomHour] = useState(0);
  const [customMinute, setCustomMinute] = useState(0);
  const [showTimePicker, setShowTimePicker] = useState(false);
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
      const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
      setCustomDate(local.toISOString().slice(0, 10));
      setCustomHour(local.getHours());
      setCustomMinute(local.getMinutes());
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
        useCustomTime && customDate
          ? new Date(
              `${customDate}T${String(customHour).padStart(2, '0')}:${String(customMinute).padStart(2, '0')}`
            ).toISOString()
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
    setCustomDate('');
    setCustomHour(0);
    setCustomMinute(0);
    setShowTimePicker(false);
    setLoading(false);
    setStep('pin');
  }

  if (step === 'ready') {
    return (
      <main className="relative overflow-hidden min-h-[100dvh] bg-paper flex flex-col items-center justify-center px-6">
        <div
          className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[34rem] h-[34rem] rounded-full bg-emerald-500/10 blur-3xl"
          aria-hidden
        />
        <div className="w-full max-w-xs text-center">
          <div
            className="w-24 h-24 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-6"
            style={{ animation: 'pop-in 0.45s cubic-bezier(0.16, 1, 0.3, 1) both' }}
          >
            <IconCheck size={44} className="text-emerald-700" stroke={2.5} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">
            {nextType === 'in' ? 'Entrada' : 'Salida'} registrada
          </h1>
          <p className="text-stone-500 mb-8">
            {employee?.name}
            <span className="mx-2 text-stone-300">-</span>
            {new Date().toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          <button
            onClick={resetPage}
            className="w-full py-4 rounded-full bg-brand text-white text-lg font-semibold shadow-soft active:scale-[0.98] transition-transform"
          >
            Fichar otro empleado
          </button>
        </div>
      </main>
    );
  }

  if (step === 'confirming' && employee) {
    return (
      <main className="relative overflow-hidden min-h-[100dvh] bg-paper flex flex-col">
        <div
          className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[34rem] h-[34rem] rounded-full bg-brand/5 blur-3xl"
          aria-hidden
        />
        <div className="flex-1 flex flex-col justify-center px-6 pt-10 pb-4">
          <div
            className="text-center mb-8"
            style={{ animation: 'fade-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both' }}
          >
            <div className="w-20 h-20 mx-auto rounded-full bg-brand/10 text-brand flex items-center justify-center text-2xl font-bold mb-4">
              {initials(employee.name)}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{employee.name}</h1>
            {employee.position && (
              <p className="text-sm text-stone-500 mt-0.5">{employee.position}</p>
            )}
            {lastClockingAt && (
              <p className="text-xs text-stone-500 mt-2">
                Último fichaje:{' '}
                {new Date(lastClockingAt).toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>

          <div className="text-center mb-6">
            <div className="text-5xl font-bold font-mono tabular-nums text-stone-900">
              {formatCurrentTime(now)}
            </div>
            <div className="text-sm text-stone-500 mt-1 capitalize">
              {formatCurrentDate(now)}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-stone-200 shadow-soft p-4">
            <button
              onClick={handleConfirm}
              disabled={loading}
              className={`w-full py-5 rounded-full text-xl font-bold text-white flex items-center justify-center gap-2 shadow-soft active:scale-[0.98] transition-transform ${
                nextType === 'in'
                  ? 'bg-emerald-600 active:bg-emerald-700'
                  : 'bg-rose-600 active:bg-rose-700'
              }`}
            >
              {nextType === 'in' ? (
                <IconLogin2 size={26} stroke={2.25} />
              ) : (
                <IconLogout2 size={26} stroke={2.25} />
              )}
              {loading
                ? 'Registrando...'
                : nextType === 'in'
                ? 'Registrar entrada'
                : 'Registrar salida'}
            </button>

            <button
              onClick={() => setUseCustomTime(!useCustomTime)}
              className={`mt-3 w-full py-3.5 rounded-full text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${
                useCustomTime
                  ? 'bg-brand text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
              }`}
            >
              <IconClock size={18} stroke={2} />
              {useCustomTime ? 'Corrigiendo hora' : 'Corregir hora'}
            </button>

            {useCustomTime && (
              <div className="mt-3 space-y-2">
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="input text-base"
                />
                <button
                  onClick={() => setShowTimePicker(true)}
                  className="input text-base text-left flex items-center gap-2"
                >
                  <IconClock size={18} stroke={2} className="text-stone-400 shrink-0" />
                  <span className="tabular-nums">
                    {String(customHour).padStart(2, '0')}:{String(customMinute).padStart(2, '0')}
                  </span>
                </button>
                <ClockTimePicker
                  hour={customHour}
                  minute={customMinute}
                  open={showTimePicker}
                  onChange={(hh, mm) => {
                    setCustomHour(hh);
                    setCustomMinute(mm);
                    setShowTimePicker(false);
                  }}
                  onCancel={() => setShowTimePicker(false)}
                />
                <p className="text-xs text-stone-500 mt-1 text-center">
                  ¿Se te olvidó fichar? Ajusta la hora real.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="pb-[max(env(safe-area-inset-bottom),1rem)] px-6">
          <button
            onClick={resetPage}
            className="w-full py-3 text-sm text-stone-500 flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
          >
            <IconArrowLeft size={16} stroke={2} /> No soy {employee.name}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative overflow-hidden min-h-[100dvh] bg-paper flex flex-col pt-[max(env(safe-area-inset-top),2rem)] pb-[max(env(safe-area-inset-bottom),1rem)]">
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[40rem] h-[40rem] rounded-full bg-brand/5 blur-3xl"
        aria-hidden
      />
      {/* Marca y reloj */}
      <div className="relative text-center px-4 mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand text-white shadow-soft mb-3">
          <IconScan size={26} stroke={1.9} />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">FichaMe</h1>
        <p className="text-stone-500 text-base mt-1">
          Introduce tu código para fichar
        </p>

        <div className="mt-5">
          <div className="text-5xl font-bold font-mono tabular-nums text-brand">
            {formatCurrentTime(now)}
          </div>
          <div className="mt-1 text-stone-500 capitalize">{formatCurrentDate(now)}</div>
        </div>
      </div>

      {/* Teclado */}
      <div className="relative flex-1 flex items-center justify-center px-4 pb-2">
        <div
          className="w-full max-w-sm bg-white rounded-3xl border border-stone-200 shadow-lift p-5"
          style={{ animation: 'fade-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both' }}
        >
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-stone-500">Tu código</span>
              {pin.length > 0 && (
                <button
                  onClick={() => setPin('')}
                  className="text-xs text-brand font-medium flex items-center gap-1"
                >
                  <IconX size={14} stroke={2} /> Borrar
                </button>
              )}
            </div>
            <div
              className="flex justify-center gap-4"
              aria-label="PIN introducido"
            >
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-3.5 w-3.5 rounded-full transition-all duration-200 ${
                    i < pin.length ? 'bg-brand scale-110' : 'bg-stone-200'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-2.5" role="group">
            {numericKeypadRows.map((row, r) => (
              <div key={r} className="grid grid-cols-3 gap-2.5">
                {row.map((key) => {
                  const isClear = key === 'C';
                  const isDelete = key === '⌫';
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        if (isClear) setPin('');
                        else if (isDelete) setPin(pin.slice(0, -1));
                        else if (pin.length < 4) setPin(pin + key);
                      }}
                      aria-label={isDelete ? 'Borrar último dígito' : key}
                      className={`h-[4.25rem] rounded-full text-2xl flex items-center justify-center select-none transition-colors active:scale-95 active:bg-brand active:text-white ${
                        isClear || isDelete
                          ? 'bg-stone-100 text-stone-500'
                          : 'bg-stone-100 text-stone-900 font-semibold shadow-soft'
                      }`}
                    >
                      {isDelete ? (
                        <IconBackspace size={26} stroke={2} />
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
            <div className="mt-4 text-center text-sm text-rose-700 bg-rose-50 rounded-full px-4 py-2.5">
              Demasiados intentos fallidos. Inténtalo de nuevo en{' '}
              <span className="font-semibold font-mono tabular-nums">
                {lockSeconds}s
              </span>
            </div>
          )}

          <button
            onClick={handleVerifyPin}
            disabled={loading || pin.length < 3 || lockSeconds > 0}
            className="mt-4 w-full py-4 rounded-full text-lg font-bold bg-brand text-white shadow-soft active:scale-[0.98] transition-transform disabled:opacity-40 disabled:active:scale-100"
          >
            {lockSeconds > 0
              ? `Espera ${lockSeconds}s`
              : loading
              ? 'Verificando'
              : 'Fichar'}
          </button>
        </div>
      </div>

      <div className="relative text-center mt-4">
        <Link
          href="/admin"
          className="text-stone-500 text-sm inline-flex items-center justify-center active:scale-95 transition-transform"
        >
          Panel de administración
        </Link>
      </div>
    </main>
  );
}
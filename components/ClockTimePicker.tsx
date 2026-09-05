'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface ClockTimePickerProps {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
  onCancel: () => void;
  open: boolean;
}

const SIZE = 260;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUTER = 100;
const R_INNER = 65;

function polar(index: number, r: number) {
  const rad = ((index * 30 - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function minutePos(m: number, r: number) {
  const rad = ((m * 6 - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

function minuteFromEvent(
  e: MouseEvent | Touch,
  el: HTMLElement
): number | null {
  const rect = el.getBoundingClientRect();
  const x = e.clientX - rect.left - CX;
  const y = e.clientY - rect.top - CY;
  if (Math.sqrt(x * x + y * y) < 15) return null;
  const angle = Math.atan2(y, x) + Math.PI / 2;
  const norm = angle < 0 ? angle + 2 * Math.PI : angle;
  return Math.round((norm / (2 * Math.PI)) * 60) % 60;
}

export default function ClockTimePicker({
  hour,
  minute,
  onChange,
  onCancel,
  open,
}: ClockTimePickerProps) {
  const [view, setView] = useState<'h' | 'm'>('h');
  const [h, setH] = useState(hour);
  const [m, setM] = useState(minute);

  const faceRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (view !== 'm' || !faceRef.current) return;
      const rect = faceRef.current.getBoundingClientRect();
      const x = clientX - rect.left - CX;
      const y = clientY - rect.top - CY;
      if (Math.sqrt(x * x + y * y) < 15) return;
      const angle = Math.atan2(y, x) + Math.PI / 2;
      const norm = angle < 0 ? angle + 2 * Math.PI : angle;
      setM(Math.round((norm / (2 * Math.PI)) * 60) % 60);
    },
    [view]
  );

  useEffect(() => {
    if (!open) return;

    function onMove(e: MouseEvent | TouchEvent) {
      if (!dragging.current) return;
      e.preventDefault();
      const t = 'touches' in e ? e.touches[0] : e;
      updateFromPointer(t.clientX, t.clientY);
    }

    function onUp() {
      dragging.current = false;
    }

    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [open, updateFromPointer]);

  useEffect(() => {
    if (open) {
      setH(hour);
      setM(minute);
      setView('h');
    }
  }, [open, hour, minute]);

  if (!open) return null;

  const target =
    view === 'h'
      ? h < 12
        ? polar(h, R_OUTER)
        : polar(h - 12, R_INNER)
      : minutePos(m, R_OUTER);

  const dx = target.x - CX;
  const dy = target.y - CY;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const lineLen = Math.max(0, dist - 18);
  const lineEnd = {
    x: CX + (dx / dist) * lineLen,
    y: CY + (dy / dist) * lineLen,
  };

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (view !== 'm') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    const val = minuteFromEvent(
      { clientX: e.clientX, clientY: e.clientY } as MouseEvent,
      e.currentTarget
    );
    if (val !== null) setM(val);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current || view !== 'm') return;
    const val = minuteFromEvent(
      { clientX: e.clientX, clientY: e.clientY } as MouseEvent,
      e.currentTarget
    );
    if (val !== null) setM(val);
  }

  function handlePointerUp() {
    dragging.current = false;
  }

  return (
    <div className="fixed inset-0 bg-stone-950/50 flex items-end md:items-center justify-center z-50">
      <div className="bg-white rounded-t-3xl md:rounded-2xl shadow-lift w-full md:max-w-sm p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <div className="md:hidden w-10 h-1 rounded-full bg-stone-200 mx-auto mb-4" />

        <h2 className="text-lg font-bold mb-4 tracking-tight">
          Seleccionar hora
        </h2>

        <div className="flex items-center justify-center gap-2 mb-6">
          <button
            onClick={() => setView('h')}
            className={`w-16 h-14 rounded-xl flex items-center justify-center text-2xl font-bold tabular-nums transition-colors ${
              view === 'h'
                ? 'bg-brand text-white'
                : 'bg-stone-100 text-stone-900'
            }`}
          >
            {String(h).padStart(2, '0')}
          </button>
          <span className="text-2xl font-bold text-stone-400">:</span>
          <button
            onClick={() => setView('m')}
            className={`w-16 h-14 rounded-xl flex items-center justify-center text-2xl font-bold tabular-nums transition-colors ${
              view === 'm'
                ? 'bg-brand text-white'
                : 'bg-stone-100 text-stone-900'
            }`}
          >
            {String(m).padStart(2, '0')}
          </button>
        </div>

        <div
          ref={faceRef}
          className="relative mx-auto rounded-full bg-stone-200 touch-none select-none"
          style={{ width: SIZE, height: SIZE }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <svg
            className="absolute inset-0 z-0"
            width={SIZE}
            height={SIZE}
          >
            <line
              x1={CX}
              y1={CY}
              x2={lineEnd.x}
              y2={lineEnd.y}
              stroke="#1F7A50"
              strokeWidth={2}
            />
            <circle cx={CX} cy={CY} r={4} fill="#1F7A50" />
          </svg>

          {view === 'h' &&
            Array.from({ length: 12 }, (_, i) => {
              const o = polar(i, R_OUTER);
              const n = polar(i, R_INNER);
              return (
                <div key={i}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setH(i); setView('m'); }}
                    className={`absolute w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold z-10 transition-colors ${
                      h === i
                        ? 'bg-brand text-white'
                        : 'text-stone-900 hover:bg-stone-300/50'
                    }`}
                    style={{ left: o.x - 20, top: o.y - 20 }}
                  >
                    {i}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setH(i + 12); setView('m'); }}
                    className={`absolute w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold z-10 transition-colors ${
                      h === i + 12
                        ? 'bg-brand text-white'
                        : 'text-stone-900 hover:bg-stone-300/50'
                    }`}
                    style={{ left: n.x - 20, top: n.y - 20 }}
                  >
                    {i + 12}
                  </button>
                </div>
              );
            })}

          {view === 'm' &&
            Array.from({ length: 12 }, (_, i) => {
              const p = polar(i, R_OUTER);
              return (
                <button
                  key={i}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setM(i * 5)}
                  className={`absolute w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold z-10 transition-colors ${
                    m === i * 5
                      ? 'bg-brand text-white'
                      : 'text-stone-900 hover:bg-stone-300/50'
                  }`}
                  style={{ left: p.x - 20, top: p.y - 20 }}
                >
                  {String(i * 5).padStart(2, '0')}
                </button>
              );
            })}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onCancel} className="btn-secondary">
            Cancelar
          </button>
          <button onClick={() => onChange(h, m)} className="btn-primary">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
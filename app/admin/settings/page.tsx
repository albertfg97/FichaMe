'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import {
  IconDeviceFloppy,
  IconUpload,
  IconX,
  IconCheck,
  IconCalendarPlus,
  IconTrash,
} from '@tabler/icons-react';

interface KioskSettings {
  title: string;
  subtitle: string;
  logo_url: string | null;
  brand_color: string;
  holiday_region: string | null;
  holiday_province: string | null;
  holiday_city: string | null;
}

interface Holiday {
  date: string;
  name: string;
}

interface PlaceItem {
  slug: string;
  name: string;
}

const PRESET_COLORS = [
  { name: 'Verde', hex: '#1F7A50' },
  { name: 'Azul', hex: '#2563EB' },
  { name: 'Índigo', hex: '#4F46E5' },
  { name: 'Púrpura', hex: '#7C3AED' },
  { name: 'Rosa', hex: '#E11D48' },
  { name: 'Naranja', hex: '#EA580C' },
  { name: 'Turquesa', hex: '#0D9488' },
  { name: 'Gris', hex: '#475569' },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<KioskSettings>({
    title: 'FichaMe',
    subtitle: 'Introduce tu código para fichar',
    logo_url: null,
    brand_color: '#1F7A50',
    holiday_region: null,
    holiday_province: null,
    holiday_city: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [newHoliday, setNewHoliday] = useState<Holiday>({ date: '', name: '' });
  const [addingHoliday, setAddingHoliday] = useState(false);
  const [deletingHoliday, setDeletingHoliday] = useState<string | null>(null);
  const [holidayRegions, setHolidayRegions] = useState<PlaceItem[]>([]);
  const [holidayProvinces, setHolidayProvinces] = useState<PlaceItem[]>([]);
  const [holidayLocalities, setHolidayLocalities] = useState<PlaceItem[]>([]);
  const [regionSlug, setRegionSlug] = useState('');
  const [provinceSlug, setProvinceSlug] = useState('');
  const [citySlug, setCitySlug] = useState('');
  const [busyProvinces, setBusyProvinces] = useState(false);
  const [busyLocalities, setBusyLocalities] = useState(false);
  const [importingCity, setImportingCity] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [{ data: st }, rg] = await Promise.all([
          supabase
            .from('kiosk_settings')
            .select(
              'title, subtitle, logo_url, brand_color, holiday_region, holiday_province, holiday_city'
            )
            .eq('id', 1)
            .single(),
          holidayFetch({ type: 'comunidades' }),
        ]);
        if (st) setSettings(st);
        setHolidayRegions(rg.items ?? []);
        if (st?.holiday_region) {
          setRegionSlug(st.holiday_region);
          const pr = await holidayFetch({ type: 'provincias', ccaa: st.holiday_region });
          setHolidayProvinces(pr.items ?? []);
          if (st?.holiday_province) {
            setProvinceSlug(st.holiday_province);
            const lo = await holidayFetch({
              type: 'localidades',
              ccaa: st.holiday_region,
              provincia: st.holiday_province,
            });
            setHolidayLocalities(lo.items ?? []);
            if (st?.holiday_city) setCitySlug(st.holiday_city);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    supabase
      .from('holidays')
      .select('date, name')
      .gte('date', '2010-01-01')
      .order('date', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setHolidays(data);
      });
  }, []);

  async function handleAddHoliday() {
    if (!newHoliday.date || !newHoliday.name.trim()) {
      toast.error('Introduce fecha y nombre del festivo');
      return;
    }
    setAddingHoliday(true);
    const { error } = await supabase
      .from('holidays')
      .insert(newHoliday)
      .select()
      .single();
    setAddingHoliday(false);
    if (error) {
      toast.error('Error al añadir el festivo');
      return;
    }
    setHolidays((h) => [...h, newHoliday].sort((a, b) => a.date.localeCompare(b.date)));
    setNewHoliday({ date: '', name: '' });
    toast.success('Festivo añadido');
  }

  async function handleDeleteHoliday(date: string) {
    setDeletingHoliday(date);
    const { error } = await supabase.from('holidays').delete().eq('date', date);
    setDeletingHoliday(null);
    if (error) {
      toast.error('Error al eliminar el festivo');
      return;
    }
    setHolidays((h) => h.filter((x) => x.date !== date));
    toast.success('Festivo eliminado');
  }

  async function holidayFetch(params: Record<string, string>) {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`/api/holidays?${qs}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Error consultando festivos');
    return data as { items?: PlaceItem[]; holidays?: { date: string; name: string }[] };
  }

  async function onRegionChange(slug: string) {
    setRegionSlug(slug);
    setProvinceSlug('');
    setCitySlug('');
    setHolidayProvinces([]);
    setHolidayLocalities([]);
    if (!slug) return;
    setBusyProvinces(true);
    try {
      const pr = await holidayFetch({ type: 'provincias', ccaa: slug });
      setHolidayProvinces(pr.items ?? []);
    } catch {
      toast.error('No se pudieron cargar las provincias');
    } finally {
      setBusyProvinces(false);
    }
  }

  async function onProvinceChange(slug: string) {
    setProvinceSlug(slug);
    setCitySlug('');
    setHolidayLocalities([]);
    if (!slug || !regionSlug) return;
    setBusyLocalities(true);
    try {
      const lo = await holidayFetch({
        type: 'localidades',
        ccaa: regionSlug,
        provincia: slug,
      });
      setHolidayLocalities(lo.items ?? []);
    } catch {
      toast.error('No se pudieron cargar los municipios');
    } finally {
      setBusyLocalities(false);
    }
  }

  async function importCityHolidays() {
    if (!regionSlug || !provinceSlug || !citySlug) return;
    setImportingCity(true);
    try {
      const data = await holidayFetch({
        type: 'festivos',
        ccaa: regionSlug,
        provincia: provinceSlug,
        municipio: citySlug,
      });
      const rows = (data.holidays ?? []).map((h) => ({ date: h.date, name: h.name }));
      if (rows.length === 0) throw new Error('El municipio no devuelve festivos');

      const { error } = await supabase.from('holidays').upsert(rows, { onConflict: 'date' });
      if (error) throw error;

      const { error: e2 } = await supabase
        .from('kiosk_settings')
        .update({
          holiday_region: regionSlug,
          holiday_province: provinceSlug,
          holiday_city: citySlug,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1);
      if (e2) console.error(e2);

      const { data: hd } = await supabase
        .from('holidays')
        .select('date, name')
        .gte('date', '2010-01-01')
        .order('date', { ascending: true });
      if (hd) setHolidays(hd);

      toast.success(`Festivos importados (${rows.length} días)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al importar festivos');
    } finally {
      setImportingCity(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase
      .from('kiosk_settings')
      .update({
        title: settings.title,
        subtitle: settings.subtitle,
        logo_url: settings.logo_url,
        brand_color: settings.brand_color,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
    setSaving(false);
    if (error) {
      toast.error('Error al guardar');
    } else {
      toast.success('Configuración guardada');
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) {
      toast.error('La imagen no puede superar 512 KB');
      return;
    }

    setUploading(true);
    const ext = file.name.split('.').pop() || 'png';
    const path = `kiosk-logo/logo.${ext}`;

    const { error } = await supabase.storage
      .from('public')
      .upload(path, file, { upsert: true });

    if (error) {
      setUploading(false);
      toast.error('Error al subir la imagen');
      return;
    }

    const { data } = supabase.storage.from('public').getPublicUrl(path);
    setSettings((s) => ({ ...s, logo_url: data.publicUrl }));
    setUploading(false);
  }

  function handleRemoveLogo() {
    setSettings((s) => ({ ...s, logo_url: null }));
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 bg-stone-200 rounded-lg" />
        <div className="h-40 bg-stone-100 rounded-2xl" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight md:text-2xl mb-6">
        Configuración del kiosco
      </h1>

      <div className="card max-w-lg mb-8">
        <h2 className="font-semibold mb-3">Días festivos</h2>
        <p className="text-sm text-stone-500 mb-4">
          En estos días el kiosco no permitirá fichar.
        </p>

        <div className="rounded-xl bg-stone-50 border border-stone-200 p-4 mb-4">
          <h3 className="text-sm font-semibold mb-2">
            Importar festivos de una ciudad
          </h3>
          <p className="text-xs text-stone-500 mb-3">
            Selecciona comunidad autónoma, provincia y municipio. Se añadirán los
            festivos de 2026 y 2027 (nacionales, autonómicos y locales).
          </p>
          <div className="space-y-2">
            <select
              className="input w-full"
              value={regionSlug}
              onChange={(e) => onRegionChange(e.target.value)}
            >
              <option value="">Comunidad autónoma</option>
              {holidayRegions.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.name}
                </option>
              ))}
            </select>
            <select
              className="input w-full"
              value={provinceSlug}
              onChange={(e) => onProvinceChange(e.target.value)}
              disabled={!regionSlug || busyProvinces}
            >
              <option value="">{busyProvinces ? 'Cargando...' : 'Provincia'}</option>
              {holidayProvinces.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              className="input w-full"
              value={citySlug}
              onChange={(e) => setCitySlug(e.target.value)}
              disabled={!provinceSlug || busyLocalities}
            >
              <option value="">
                {busyLocalities ? 'Cargando...' : 'Municipio'}
              </option>
              {holidayLocalities.map((l) => (
                <option key={l.slug} value={l.slug}>
                  {l.name}
                </option>
              ))}
            </select>
            <button
              onClick={importCityHolidays}
              disabled={!citySlug || importingCity}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <IconCalendarPlus size={17} stroke={2} />
              {importingCity
                ? 'Importando...'
                : `Añadir festivos de ${holidayLocalities.find((l) => l.slug === citySlug)?.name ?? ''}`}
            </button>
          </div>
          <p className="text-[11px] text-stone-400 mt-2">
            Festivos: <a href="https://calendariosnacionales.com" target="_blank" rel="noopener noreferrer" className="underline">calendariosnacionales.com</a>
          </p>
        </div>

        <div className="space-y-2 mb-4">
          {holidays.length === 0 ? (
            <p className="text-sm text-stone-400 py-2">
              No hay festivos configurados.
            </p>
          ) : (
            holidays.map((h) => (
              <div
                key={h.date}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-stone-50 border border-stone-200"
              >
                <div>
                  <div className="text-sm font-medium ">{h.name}</div>
                  <div className="text-xs text-stone-500">
                    {new Date(`${h.date}T12:00:00`).toLocaleDateString('es-ES', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteHoliday(h.date)}
                  disabled={deletingHoliday === h.date}
                  className="text-stone-400 hover:text-rose-600 transition-colors p-1.5"
                  title="Eliminar festivo"
                >
                  <IconTrash size={17} stroke={2} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="date"
            value={newHoliday.date}
            onChange={(e) => setNewHoliday((h) => ({ ...h, date: e.target.value }))}
            className="input sm:w-40"
          />
          <input
            type="text"
            value={newHoliday.name}
            onChange={(e) => setNewHoliday((h) => ({ ...h, name: e.target.value }))}
            className="input flex-1"
            placeholder="Nombre del festivo (ej. Navidad)"
          />
          <button
            onClick={handleAddHoliday}
            disabled={addingHoliday}
            className="btn-primary flex items-center justify-center gap-2"
          >
            <IconCalendarPlus size={17} stroke={2} />
            {addingHoliday ? 'Añadiendo...' : 'Añadir'}
          </button>
        </div>
      </div>

      <div className="card space-y-5 max-w-lg">
        <div>
          <label className="label">Título del kiosco</label>
          <input
            type="text"
            value={settings.title}
            onChange={(e) => setSettings((s) => ({ ...s, title: e.target.value }))}
            className="input"
            placeholder="FichaMe"
          />
        </div>

        <div>
          <label className="label">Subtítulo</label>
          <input
            type="text"
            value={settings.subtitle}
            onChange={(e) => setSettings((s) => ({ ...s, subtitle: e.target.value }))}
            className="input"
            placeholder="Introduce tu código para fichar"
          />
        </div>

        <div>
          <label className="label">Color de marca</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {PRESET_COLORS.map((c) => (
              <button
                key={c.hex}
                onClick={() => setSettings((s) => ({ ...s, brand_color: c.hex }))}
                className="relative w-10 h-10 rounded-xl transition-transform active:scale-95"
                style={{ backgroundColor: c.hex }}
                title={c.name}
              >
                {settings.brand_color === c.hex && (
                  <IconCheck size={18} className="absolute inset-0 m-auto text-white" stroke={2.5} />
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <label className="relative">
              <input
                type="color"
                value={settings.brand_color}
                onChange={(e) => setSettings((s) => ({ ...s, brand_color: e.target.value }))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div
                className="w-10 h-10 rounded-xl border-2 border-stone-200 cursor-pointer hover:border-stone-300 transition-colors"
                style={{ backgroundColor: settings.brand_color }}
              />
            </label>
            <input
              type="text"
              value={settings.brand_color}
              onChange={(e) => {
                const v = e.target.value;
                if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) {
                  setSettings((s) => ({ ...s, brand_color: v }));
                }
              }}
              className="input flex-1 font-mono text-sm"
              placeholder="#1F7A50"
            />
          </div>
        </div>

        <div>
          <label className="label">Logo</label>
          {settings.logo_url ? (
            <div className="flex items-center gap-4">
              <img
                src={settings.logo_url}
                alt="Logo del kiosco"
                className="w-16 h-16 rounded-xl object-cover border border-stone-200"
              />
              <button
                onClick={handleRemoveLogo}
                className="text-sm text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1"
              >
                <IconX size={14} stroke={2} /> Quitar
              </button>
            </div>
          ) : (
            <label className="flex items-center justify-center gap-2 w-full py-8 rounded-xl border-2 border-dashed border-stone-200 text-stone-500 hover:border-stone-400 transition-colors cursor-pointer">
              <IconUpload size={18} stroke={2} />
              {uploading ? 'Subiendo...' : 'Subir imagen (max 512 KB)'}
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          )}
        </div>

        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            <IconDeviceFloppy size={18} stroke={2} />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      <div className="mt-8 card max-w-lg">
        <h2 className="font-semibold mb-3">Vista previa</h2>
        <div className="rounded-xl bg-stone-50 p-6 text-center">
          {settings.logo_url ? (
            <img
              src={settings.logo_url}
              alt="Logo"
              className="w-14 h-14 rounded-full mx-auto mb-3 object-cover"
            />
          ) : (
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-full text-white shadow-soft mb-3 text-xl font-bold"
              style={{ backgroundColor: settings.brand_color }}
            >
              F
            </div>
          )}
          <h3 className="text-2xl font-bold tracking-tight">{settings.title || 'FichaMe'}</h3>
          <p className="text-sm mt-1" style={{ color: settings.brand_color }}>
            {settings.subtitle}
          </p>
          <button
            className="mt-4 px-6 py-2.5 rounded-xl text-white text-sm font-semibold shadow-soft"
            style={{ backgroundColor: settings.brand_color }}
          >
            Botón de ejemplo
          </button>
        </div>
      </div>
    </div>
  );
}
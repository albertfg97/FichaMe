'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { IconDeviceFloppy, IconUpload, IconX, IconCheck } from '@tabler/icons-react';

interface KioskSettings {
  title: string;
  subtitle: string;
  logo_url: string | null;
  brand_color: string;
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
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    supabase
      .from('kiosk_settings')
      .select('title, subtitle, logo_url, brand_color')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (data) setSettings(data);
        setLoading(false);
      });
  }, []);

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
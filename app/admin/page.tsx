'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { IconLogin2, IconArrowLeft } from '@tabler/icons-react';
import Link from 'next/link';

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError('Credenciales incorrectas');
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user?.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      await supabase.auth.signOut();
      setError('Este usuario no tiene permisos de administración');
      setLoading(false);
      return;
    }

    router.push('/admin/dashboard');
    router.refresh();
  }

  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-4 py-8 bg-slate-100">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <span className="inline-flex w-14 h-14 rounded-2xl bg-brand items-center justify-center text-white font-bold text-2xl mb-3">
            F
          </span>
          <h1 className="text-2xl font-bold text-slate-900">FichaMe</h1>
          <p className="text-slate-500 mt-1">Panel de administración</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          {error && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3">
              {error}
            </div>
          )}

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input text-base"
              placeholder="admin@empresa.com"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="label">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input text-base"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3.5 text-base"
          >
            {loading ? (
              'Entrando…'
            ) : (
              <>
                <IconLogin2 size={20} stroke={2} /> Entrar
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-6">
          <Link
            href="/"
            className="text-sm text-slate-500 inline-flex items-center gap-1 hover:text-slate-700"
          >
            <IconArrowLeft size={16} stroke={2} /> Volver al fichaje
          </Link>
        </div>
      </div>
    </main>
  );
}
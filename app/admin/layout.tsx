'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';
import type { Profile } from '@/lib/types';
import {
  IconChartBar,
  IconLogout,
  IconUsers,
  IconFileReport,
  IconExternalLink,
} from '@tabler/icons-react';

const navItems = [
  { href: '/admin/dashboard', label: 'Inicio', icon: IconChartBar },
  { href: '/admin/employees', label: 'Empleados', icon: IconUsers },
  { href: '/admin/reports', label: 'Reportes', icon: IconFileReport },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
      if (profile) setProfile(profile);
    });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/admin');
  }

  return (
    <div className="min-h-[100dvh] bg-paper pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0 dark:bg-stone-950">
      {/* Barra superior */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-20 dark:bg-stone-900 dark:border-stone-800">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center text-white font-bold text-sm shadow-soft">
              F
            </span>
            <span className="font-bold text-lg tracking-tight dark:text-stone-50">
              FichaMe
            </span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/"
              className="hidden sm:inline-flex text-sm text-stone-500 hover:text-stone-700 items-center gap-1 dark:text-stone-400 dark:hover:text-stone-200"
            >
              <IconExternalLink size={16} stroke={2} /> Fichaje
            </a>
            {profile && (
              <div className="hidden md:flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center text-sm font-semibold">
                  {profile.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <span className="text-sm text-stone-700 dark:text-stone-300">
                  {profile.full_name}
                </span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="text-sm text-rose-600 hover:text-rose-700 font-medium inline-flex items-center gap-1.5 p-2 dark:text-rose-400 dark:hover:text-rose-300"
              aria-label="Cerrar sesión"
            >
              <IconLogout size={20} stroke={2} />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navegación escritorio */}
      <nav className="hidden md:block max-w-5xl mx-auto px-4 pt-4">
        <div className="inline-flex gap-1 bg-white rounded-xl border border-stone-200 p-1 shadow-soft dark:bg-stone-900 dark:border-stone-800">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2 transition-colors ${
                  active
                    ? 'bg-brand text-white'
                    : 'text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800'
                }`}
              >
                <Icon size={18} stroke={2} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>

      {/* Bottom nav móvil */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-stone-200 z-20 pb-[env(safe-area-inset-bottom)] dark:bg-stone-900 dark:border-stone-800"
        style={{
          boxShadow: '0 -1px 12px rgba(28,25,23,0.06)',
        }}
      >
        <div className="grid grid-cols-3">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                  active
                    ? 'text-brand'
                    : 'text-stone-500'
                }`}
              >
                <span
                  className={`w-10 h-7 rounded-lg flex items-center justify-center transition-colors ${
                    active ? 'bg-brand/10' : ''
                  }`}
                >
                  <Icon size={22} stroke={active ? 2.4 : 2} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
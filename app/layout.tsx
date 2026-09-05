import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';
import ServiceWorkerRegistry from '@/components/ServiceWorkerRegistry';
import './globals.css';

export const metadata: Metadata = {
  title: 'FichaMe - Plataforma de Fichaje',
  description: 'Sistema de registro de entrada y salida para empleados',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FichaMe',
  },
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#4F46E5',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              fontSize: '1rem',
              borderRadius: '0.75rem',
              padding: '0.75rem 1rem',
            },
          }}
        />
        <ServiceWorkerRegistry />
      </body>
    </html>
  );
}
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FichaMe - Fichaje',
    short_name: 'FichaMe',
    description: 'Sistema de fichaje de entrada y salida',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FBFAF7',
    theme_color: '#1F7A50',
    lang: 'es',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
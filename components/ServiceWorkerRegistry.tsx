'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistry() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Silencioso: el SW es un mejoramiento progresivo
      });
    }
  }, []);

  return null;
}
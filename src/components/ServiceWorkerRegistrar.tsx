'use client';

import { useEffect } from 'react';

// Registers /sw.js on the client. The service worker itself is a no-op
// (see public/sw.js) — its only purpose is to make the site PWA-installable
// so `beforeinstallprompt` fires on Chromium and users can add the app to
// their home screen with a single tap.
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* silent — SW registration is a best-effort enhancement */
    });
  }, []);
  return null;
}

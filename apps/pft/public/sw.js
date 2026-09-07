// Minimal service worker — installed only to satisfy PWA install
// eligibility on Chromium (needed for `beforeinstallprompt` to fire).
// No caching / offline behaviour — the browser handles every fetch.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// A fetch handler must exist (even empty) for the site to be treated as
// an installable PWA on some browsers.
self.addEventListener('fetch', () => {});

'use client';
import { useEffect } from 'react';

const scrollAndFlash = () => {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return;
  const el = document.getElementById(hash);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('search-highlight');
  window.setTimeout(() => el.classList.remove('search-highlight'), 3000);
};

/**
 * On mount and whenever `deps` change (i.e. after data is loaded), if the URL
 * has a hash, scroll the matching element into view and flash a highlight ring.
 * Also reacts to hashchange for same-page nav.
 */
export function useScrollToHash(deps: unknown[]) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const timer = window.setTimeout(scrollAndFlash, 100);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHash = () => window.setTimeout(scrollAndFlash, 50);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
}

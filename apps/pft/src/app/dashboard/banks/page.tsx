'use client';

// Thin route wrapper around <BanksManager />. The manager also renders
// inside the Settings page on desktop so the desktop sidebar-nav flow
// keeps Banks + Categories alongside the other account controls.

import BanksManager from '@/components/BanksManager';

export default function BanksPage() {
  return <BanksManager />;
}

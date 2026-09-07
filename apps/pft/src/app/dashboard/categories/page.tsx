'use client';

// Thin route wrapper around <CategoriesManager />. The manager also renders
// inside the Settings page on desktop.

import CategoriesManager from '@/components/CategoriesManager';

export default function CategoriesPage() {
  return <CategoriesManager />;
}

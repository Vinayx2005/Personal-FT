import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CMS · Crafted by Teja',
  description: 'Content admin.',
  robots: { index: false, follow: false }, // don't index the admin surface
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

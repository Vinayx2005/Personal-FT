import { ReactNode } from 'react';
import './globals.css';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';

export const metadata = {
  title: 'Personal FT — Know where your money goes',
  description: 'A finance tracker that finds your leaks and helps you feel calm about money.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default' as const,
    title: 'Personal FT',
  },
};

export const viewport = {
  themeColor: '#F37335',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover' as const,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <title>Personal FT</title>
      </head>
      <body className="font-lato bg-18-bg">
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}

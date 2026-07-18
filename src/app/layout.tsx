import { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: "Teja's Finance Tracker",
  description: 'Personal finance tracker',
  manifest: '/manifest.json',
  themeColor: '#F37335',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default' as const,
    title: 'Personal FT',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <title>Teja&apos;s Finance Tracker</title>
      </head>
      <body className="font-lato bg-18-bg">{children}</body>
    </html>
  );
}

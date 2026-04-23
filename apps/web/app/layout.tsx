import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { QueryProvider } from '@/lib/query-provider';

import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'sellline',
  description: 'sellline-CRM',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}

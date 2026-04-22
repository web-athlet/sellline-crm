import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { auth, signOut } from '@/auth';
import { Button } from '@/components/ui/button';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <div className="text-sm font-semibold">sellline</div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{session.user?.email}</span>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <div className="p-6">{children}</div>
    </div>
  );
}

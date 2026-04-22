import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-semibold tracking-tight">sellline</h1>
      <p className="max-w-md text-center text-muted-foreground">
        Scaffolding active — Session 0. Sign in to view the seeded workspace.
      </p>
      <Link href="/login">
        <Button>Sign in</Button>
      </Link>
    </main>
  );
}

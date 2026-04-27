import { Suspense } from 'react';

import { TwoFactorSetup } from '@/components/two-factor-setup';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TwoFactorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Two-factor authentication</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense>
            <TwoFactorSetup />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}

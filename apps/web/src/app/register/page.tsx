import { Suspense } from 'react';

import { RegisterForm } from '@/components/register-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense>
            <RegisterForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}

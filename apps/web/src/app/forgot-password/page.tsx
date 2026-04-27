import { Suspense } from 'react';

import { ForgotPasswordForm } from '@/components/forgot-password-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense>
            <ForgotPasswordForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}

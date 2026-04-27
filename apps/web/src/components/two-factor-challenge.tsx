'use client';

import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient, setAccessToken } from '@/lib/api-client';

interface TwoFactorChallengeProps {
  pendingToken: string;
}

interface ChallengeFormData {
  code: string;
}

interface ValidateResponse {
  data: { accessToken: string; user: { id: string; email: string; name: string; role: string } };
}

export function TwoFactorChallenge({ pendingToken }: TwoFactorChallengeProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChallengeFormData>();

  const onSubmit = async (data: ChallengeFormData) => {
    setServerError(null);
    try {
      const res = await apiClient.post<ValidateResponse>('/auth/2fa/validate', {
        pendingToken,
        code: data.code,
      });
      const { accessToken } = res.data.data;
      setAccessToken(accessToken);
      // Refresh the NextAuth session with the new accessToken
      await signIn('credentials', {
        redirect: false,
        accessToken,
      });
      router.push('/app');
      router.refresh();
    } catch {
      setServerError('Invalid code or expired session. Please start over.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Enter the 6-digit code from your authenticator app.
      </p>
      <div className="space-y-2">
        <label htmlFor="code" className="text-sm font-medium">
          Verification code
        </label>
        <Input
          id="code"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          autoFocus
          {...register('code', {
            required: 'Code is required',
            pattern: { value: /^\d{6}$/, message: 'Enter 6 digits' },
          })}
        />
        {errors.code ? <p className="text-xs text-destructive">{errors.code.message}</p> : null}
      </div>
      {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Verifying…' : 'Verify'}
      </Button>
    </form>
  );
}

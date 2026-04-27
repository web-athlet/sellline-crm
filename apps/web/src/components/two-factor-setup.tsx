'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient, setAccessToken } from '@/lib/api-client';

interface GenerateResponse {
  data: { secret: string; qrCodeDataUrl: string };
}

interface VerifyFormData {
  code: string;
}

export function TwoFactorSetup({ accessToken }: { accessToken?: string }) {
  const [qr, setQr] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyFormData>();

  const generate = async () => {
    setGenerating(true);
    setServerError(null);
    try {
      if (accessToken) setAccessToken(accessToken);
      const res = await apiClient.post<GenerateResponse>('/auth/2fa/generate');
      setQr(res.data.data);
    } catch {
      setServerError('Failed to generate 2FA secret. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const onSubmit = async (data: VerifyFormData) => {
    setServerError(null);
    try {
      await apiClient.post('/auth/2fa/verify', { code: data.code });
      setEnabled(true);
    } catch {
      setServerError('Invalid code. Please try again.');
    }
  };

  if (enabled) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm font-medium text-green-600">2FA enabled successfully!</p>
        <p className="text-sm text-muted-foreground">
          Two-factor authentication is now active on your account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!qr ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Scan a QR code with your authenticator app to enable two-factor authentication.
          </p>
          <Button onClick={generate} disabled={generating} className="w-full">
            {generating ? 'Generating…' : 'Generate QR code'}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-center">
            <Image src={qr.qrCodeDataUrl} alt="2FA QR code" width={200} height={200} />
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Manual key: <code className="font-mono text-xs">{qr.secret}</code>
          </p>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="code" className="text-sm font-medium">
                Verification code
              </label>
              <Input
                id="code"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                {...register('code', {
                  required: 'Code is required',
                  pattern: { value: /^\d{6}$/, message: 'Enter 6 digits' },
                })}
              />
              {errors.code ? (
                <p className="text-xs text-destructive">{errors.code.message}</p>
              ) : null}
            </div>
            {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Verifying…' : 'Enable 2FA'}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}

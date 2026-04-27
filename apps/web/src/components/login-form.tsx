'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useState, type FormEvent } from 'react';

import { TwoFactorChallenge } from './two-factor-challenge';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);

  const registered = params.get('registered') === '1';
  const reset = params.get('reset') === '1';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError('Invalid email or password.');
      return;
    }

    // Fetch updated session to detect 2FA pending
    const sessionRes = await fetch('/api/auth/session');
    const session = (await sessionRes.json()) as {
      twoFactorRequired?: boolean;
      pendingToken?: string;
      requiresTwoFactorSetup?: boolean;
    };

    if (session?.twoFactorRequired && session.pendingToken) {
      setPendingToken(session.pendingToken);
      return;
    }

    if (session?.requiresTwoFactorSetup) {
      router.push('/app/settings/security/2fa');
      return;
    }

    router.push(params.get('callbackUrl') ?? '/app');
    router.refresh();
  };

  if (pendingToken) {
    return <TwoFactorChallenge pendingToken={pendingToken} />;
  }

  return (
    <div className="space-y-4">
      {registered ? (
        <p className="text-sm text-green-600">Account created! Please sign in.</p>
      ) : null}
      {reset ? (
        <p className="text-sm text-green-600">
          Password reset! Please sign in with your new password.
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <a href="/forgot-password" className="text-xs text-muted-foreground underline">
              Forgot password?
            </a>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">or</span>
        </div>
      </div>

      <div className="space-y-2">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            window.location.href = `${API_URL}/api/auth/google`;
          }}
        >
          Continue with Google
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            window.location.href = `${API_URL}/api/auth/microsoft`;
          }}
        >
          Continue with Microsoft
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        No account?{' '}
        <a href="/register" className="underline">
          Create one
        </a>
      </p>
    </div>
  );
}

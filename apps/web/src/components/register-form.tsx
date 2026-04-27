'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import zxcvbn from 'zxcvbn';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';

interface RegisterFormData {
  name: string;
  email: string;
  password: string;
}

const strengthLabels = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
const strengthColors = [
  'bg-red-500',
  'bg-orange-500',
  'bg-yellow-500',
  'bg-blue-500',
  'bg-green-500',
];

export function RegisterForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>();

  const password = watch('password', '');

  const onPasswordChange = (value: string) => {
    if (value) setPasswordStrength(zxcvbn(value).score);
  };

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null);
    try {
      await apiClient.post('/auth/register', data);
      router.push('/login?registered=1');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string; code?: string } } } };
      if (e.response?.data?.error?.code === 'CONFLICT') {
        setServerError('An account with this email already exists.');
      } else {
        setServerError(
          e.response?.data?.error?.message ?? 'Registration failed. Please try again.',
        );
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <Input
          id="name"
          {...register('name', { required: 'Name is required' })}
          autoComplete="name"
        />
        {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="email"
          type="email"
          {...register('email', { required: 'Email is required' })}
          autoComplete="email"
        />
        {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <Input
          id="password"
          type="password"
          {...register('password', {
            required: 'Password is required',
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => onPasswordChange(e.target.value),
          })}
          autoComplete="new-password"
        />
        {password && (
          <div className="space-y-1">
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full ${i <= passwordStrength ? strengthColors[passwordStrength] : 'bg-muted'}`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{strengthLabels[passwordStrength]}</p>
          </div>
        )}
        {errors.password ? (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        ) : null}
      </div>

      {serverError ? <p className="text-sm text-destructive">{serverError}</p> : null}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <a href="/login" className="underline">
          Sign in
        </a>
      </p>
    </form>
  );
}

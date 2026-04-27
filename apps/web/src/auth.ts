import {
  LoginCredentialsSchema,
  type AuthUser,
  type LoginResponse,
  type PendingLoginResponse,
  type Role,
} from '@sellline/shared';
import NextAuth from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

declare module 'next-auth' {
  interface Session {
    userId?: string;
    email?: string;
    role?: Role;
    accessToken?: string;
    requiresTwoFactorSetup?: boolean;
    pendingToken?: string;
    twoFactorRequired?: boolean;
  }
  interface User {
    role?: Role;
    accessToken?: string;
    requiresTwoFactorSetup?: boolean;
    pendingToken?: string;
    twoFactorRequired?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    role?: Role;
    accessToken?: string;
    requiresTwoFactorSetup?: boolean;
    pendingToken?: string;
    twoFactorRequired?: boolean;
  }
}

export const { auth, handlers, signIn, signOut, unstable_update } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (raw) => {
        const parsed = LoginCredentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const res = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.data),
        });
        if (!res.ok) return null;

        const body = (await res.json()) as { data: LoginResponse | PendingLoginResponse };
        const data = body.data;

        if ('twoFactorRequired' in data) {
          return {
            id: '__2fa__',
            email: parsed.data.email,
            name: null,
            twoFactorRequired: true as const,
            pendingToken: data.pendingToken,
          };
        }

        const lr = data as LoginResponse & { user: AuthUser };
        return {
          id: lr.user.id,
          email: lr.user.email,
          name: lr.user.name,
          role: lr.user.role,
          accessToken: lr.accessToken,
          ...(lr.requiresTwoFactorSetup ? { requiresTwoFactorSetup: true as const } : undefined),
        };
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? 'placeholder',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? 'placeholder',
    }),
    MicrosoftEntraID({
      clientId: process.env.MICROSOFT_CLIENT_ID ?? 'placeholder',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET ?? 'placeholder',
    }),
  ],
  callbacks: {
    jwt: async ({ token, user, account, profile }): Promise<JWT> => {
      if (user) {
        if (user.id) token.userId = user.id;
        if ('accessToken' in user && user.accessToken) token.accessToken = user.accessToken;
        if ('role' in user && user.role) token.role = user.role;
        if ('requiresTwoFactorSetup' in user)
          token.requiresTwoFactorSetup = user.requiresTwoFactorSetup;
        if ('pendingToken' in user && user.pendingToken) token.pendingToken = user.pendingToken;
        if ('twoFactorRequired' in user && user.twoFactorRequired)
          token.twoFactorRequired = user.twoFactorRequired;
      }
      if (account && (account.provider === 'google' || account.provider === 'microsoft-entra-id')) {
        // OAuth providers: exchange with our API to get our JWT
        const providerName = account.provider === 'google' ? 'google' : 'microsoft';
        try {
          const res = await fetch(`${API_URL}/api/auth/oauth-exchange`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Internal-Secret': process.env.INTERNAL_AUTH_SECRET ?? '',
            },
            body: JSON.stringify({
              email: profile?.email ?? '',
              name: (profile as { name?: string } | undefined)?.name ?? profile?.email ?? '',
              provider: providerName,
              accessToken: account.access_token ?? '',
            }),
          });
          if (res.ok) {
            const body = (await res.json()) as { data: LoginResponse & { user: AuthUser } };
            const { data } = body;
            token.userId = data.user.id;
            token.role = data.user.role;
            token.accessToken = data.accessToken;
          }
        } catch {
          // OAuth exchange failed — token remains without accessToken
        }
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (token.userId) session.userId = token.userId;
      if (token.role) session.role = token.role;
      if (token.accessToken) session.accessToken = token.accessToken;
      if (token.requiresTwoFactorSetup)
        session.requiresTwoFactorSetup = token.requiresTwoFactorSetup;
      if (token.pendingToken) session.pendingToken = token.pendingToken;
      if (token.twoFactorRequired) session.twoFactorRequired = token.twoFactorRequired;
      if (token.email) session.email = token.email;
      return session;
    },
  },
});

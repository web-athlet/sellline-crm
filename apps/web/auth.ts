import { LoginCredentialsSchema, LoginResponseSchema } from '@sellline/shared-types';
import NextAuth from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Credentials from 'next-auth/providers/credentials';

import { env } from '@/env';

declare module 'next-auth' {
  interface Session {
    userId?: string;
    accessToken?: string;
    refreshToken?: string;
  }
  interface User {
    accessToken?: string;
    refreshToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    accessToken?: string;
    refreshToken?: string;
  }
}

export const { auth, handlers, signIn, signOut } = NextAuth({
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

        try {
          const res = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsed.data),
          });
          if (!res.ok) return null;

          const envelope = (await res.json()) as { data?: unknown };
          const validated = LoginResponseSchema.safeParse(envelope.data);
          if (!validated.success) return null;
          const { user, accessToken, refreshToken } = validated.data;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            accessToken,
            refreshToken,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }): Promise<JWT> => {
      if (user) {
        if (user.id) token.userId = user.id;
        if (user.accessToken) token.accessToken = user.accessToken;
        if (user.refreshToken) token.refreshToken = user.refreshToken;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (token.userId) session.userId = token.userId;
      if (token.accessToken) session.accessToken = token.accessToken;
      if (token.refreshToken) session.refreshToken = token.refreshToken;
      return session;
    },
  },
});

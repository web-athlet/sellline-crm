import { LoginCredentialsSchema } from '@sellline/shared-types';
import { SignJWT } from 'jose';
import NextAuth from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Credentials from 'next-auth/providers/credentials';

import { env } from '@/env';

declare module 'next-auth' {
  interface Session {
    userId?: string;
    tenantId?: string;
    accessToken?: string;
  }
  interface User {
    tenantId?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    tenantId?: string;
    accessToken?: string;
  }
}

async function signApiToken(userId: string, tenantId: string, email: string): Promise<string> {
  const secret = new TextEncoder().encode(env.AUTH_JWT_SECRET);
  return new SignJWT({ sub: userId, tid: tenantId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(env.AUTH_JWT_ISSUER)
    .setAudience(env.AUTH_JWT_AUDIENCE)
    .setExpirationTime(env.AUTH_JWT_EXPIRES_IN)
    .sign(secret);
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
        if (env.NODE_ENV === 'production') return null;

        const parsed = LoginCredentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        if (parsed.data.email !== 'admin@acme.dev' || parsed.data.password !== 'dev') {
          return null;
        }

        return {
          id: 'seed-admin',
          email: parsed.data.email,
          name: 'Acme Admin',
          tenantId: 'seed-tenant',
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }): Promise<JWT> => {
      if (user) {
        if (user.id) token.userId = user.id;
        if (user.tenantId) token.tenantId = user.tenantId;
        if (user.id && user.tenantId && user.email) {
          token.accessToken = await signApiToken(user.id, user.tenantId, user.email);
        }
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (token.userId) session.userId = token.userId;
      if (token.tenantId) session.tenantId = token.tenantId;
      if (token.accessToken) session.accessToken = token.accessToken;
      return session;
    },
  },
});

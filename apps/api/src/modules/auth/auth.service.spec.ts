import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import type { AppConfigService } from '../../config/config.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { UsersService } from '../users/users.service';

jest.mock('bcrypt');
const bcryptMock = bcrypt as jest.Mocked<typeof bcrypt>;

const baseUser: User = {
  id: 'user-1',
  email: 'admin@demo.de',
  name: 'Anna Admin',
  role: 'ADMIN',
  avatarUrl: null,
  password: 'hashed',
  passwordChangedAt: null,
  twoFactorSecret: null,
  twoFactorEnabled: false,
  gmailTokenEncrypted: null,
  outlookTokenEncrypted: null,
  gmailHistoryId: null,
  gmailWatchExpiresAt: null,
  createdAt: new Date('2026-04-25'),
  updatedAt: new Date('2026-04-25'),
  deletedAt: null,
};

function makeService(
  overrides: {
    users?: Partial<UsersService>;
    jwt?: Partial<JwtService>;
    refreshToken?: Partial<{
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    }>;
    passwordReset?: Partial<{
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    }>;
    user?: Partial<{ update: jest.Mock }>;
    transaction?: jest.Mock;
    config?: Partial<AppConfigService>;
  } = {},
) {
  const users = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    ...overrides.users,
  } as unknown as UsersService;

  const jwt = {
    sign: jest.fn().mockReturnValue('signed.token'),
    verify: jest.fn(),
    ...overrides.jwt,
  } as unknown as JwtService;

  const refreshToken = {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    ...overrides.refreshToken,
  };
  const passwordReset = {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({}),
    update: jest.fn().mockResolvedValue({}),
    ...overrides.passwordReset,
  };
  const user = {
    update: jest.fn().mockResolvedValue({}),
    ...overrides.user,
  };
  const transaction = overrides.transaction ?? jest.fn().mockResolvedValue([{}, {}, {}]);

  const prisma = {
    client: {
      refreshToken,
      passwordReset,
      user,
      $transaction: transaction,
    },
  } as unknown as PrismaService;

  const config = {
    get: jest.fn((key: string) => {
      const map: Record<string, string> = {
        AUTH_JWT_SECRET: 'access-secret',
        AUTH_JWT_REFRESH_SECRET: 'refresh-secret',
        AUTH_JWT_EXPIRES_IN: '1h',
        AUTH_JWT_REFRESH_EXPIRES_IN: '30d',
        AUTH_JWT_ISSUER: 'sellline-web',
        AUTH_JWT_AUDIENCE: 'sellline-api',
      };
      return map[key] ?? '';
    }),
    ...overrides.config,
  } as unknown as AppConfigService;

  return {
    service: new AuthService(jwt, users, prisma, config),
    users: users as jest.Mocked<UsersService>,
    jwt: jwt as jest.Mocked<JwtService>,
    refreshToken,
    passwordReset,
    user,
    transaction,
  };
}

describe('AuthService.login', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns tokens and user info for valid credentials', async () => {
    bcryptMock.compare.mockResolvedValue(true as never);
    bcryptMock.hash.mockResolvedValue('hashed-token' as never);
    const { service, users, refreshToken } = makeService({
      users: { findByEmail: jest.fn().mockResolvedValue(baseUser) },
    });

    const res = await service.login({ email: 'admin@demo.de', password: 'Demo1234!' });

    expect(users.findByEmail).toHaveBeenCalledWith('admin@demo.de');
    expect(res.user).toEqual({
      id: baseUser.id,
      email: baseUser.email,
      name: baseUser.name,
      role: baseUser.role,
    });
    expect(res.accessToken).toBe('signed.token');
    expect(res.refreshToken).toBe('signed.token');
    expect(refreshToken.create).toHaveBeenCalledTimes(1);
  });

  it('rejects unknown email with UNAUTHORIZED', async () => {
    const { service } = makeService({
      users: { findByEmail: jest.fn().mockResolvedValue(null) },
    });
    await expect(service.login({ email: 'no@one.de', password: 'x' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects wrong password with UNAUTHORIZED', async () => {
    bcryptMock.compare.mockResolvedValue(false as never);
    const { service } = makeService({
      users: { findByEmail: jest.fn().mockResolvedValue(baseUser) },
    });
    await expect(service.login({ email: baseUser.email, password: 'wrong' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('treats soft-deleted users as non-existent (UsersService filters deletedAt)', async () => {
    // UsersService is the gatekeeper; this test just documents the invariant.
    const { service, users } = makeService({
      users: { findByEmail: jest.fn().mockResolvedValue(null) },
    });
    await expect(service.login({ email: 'a@b.de', password: 'x' })).rejects.toThrow(
      UnauthorizedException,
    );
    expect(users.findByEmail).toHaveBeenCalledWith('a@b.de');
  });
});

describe('AuthService.refresh', () => {
  beforeEach(() => jest.clearAllMocks());

  const refreshPayload = { sub: baseUser.id, family: 'fam-1' };

  it('rotates tokens on first valid use of a refresh token', async () => {
    bcryptMock.compare.mockResolvedValue(true as never);
    bcryptMock.hash.mockResolvedValue('hashed' as never);
    const { service, refreshToken } = makeService({
      jwt: {
        verify: jest.fn().mockReturnValue(refreshPayload),
        sign: jest.fn().mockReturnValue('new.token'),
      },
      users: { findById: jest.fn().mockResolvedValue(baseUser) },
      refreshToken: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'rt-1',
            tokenHash: 'h1',
            family: 'fam-1',
            revokedAt: null,
            expiresAt: new Date(Date.now() + 86_400_000),
            userId: baseUser.id,
          },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
    });

    const res = await service.refresh('valid.refresh.jwt');

    expect(res.accessToken).toBe('new.token');
    expect(res.refreshToken).toBe('new.token');
    expect(refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'rt-1' },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('detects reuse and revokes the entire token family', async () => {
    bcryptMock.compare.mockResolvedValue(true as never);
    const updateMany = jest.fn().mockResolvedValue({ count: 4 });
    const { service } = makeService({
      jwt: { verify: jest.fn().mockReturnValue(refreshPayload) },
      refreshToken: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'rt-1',
            tokenHash: 'h1',
            family: 'fam-1',
            revokedAt: new Date(),
            expiresAt: new Date(Date.now() + 86_400_000),
            userId: baseUser.id,
          },
        ]),
        updateMany,
      },
    });

    await expect(service.refresh('reused.jwt')).rejects.toThrow(UnauthorizedException);
    expect(updateMany).toHaveBeenCalledWith({
      where: { family: 'fam-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rejects when no DB row matches the token hash', async () => {
    bcryptMock.compare.mockResolvedValue(false as never);
    const { service } = makeService({
      jwt: { verify: jest.fn().mockReturnValue(refreshPayload) },
      refreshToken: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'rt-1',
            tokenHash: 'h1',
            family: 'fam-1',
            revokedAt: null,
            expiresAt: new Date(Date.now() + 86_400_000),
            userId: baseUser.id,
          },
        ]),
      },
    });
    await expect(service.refresh('forged.jwt')).rejects.toThrow(UnauthorizedException);
  });

  it('rejects expired refresh tokens', async () => {
    bcryptMock.compare.mockResolvedValue(true as never);
    const { service } = makeService({
      jwt: { verify: jest.fn().mockReturnValue(refreshPayload) },
      refreshToken: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'rt-1',
            tokenHash: 'h1',
            family: 'fam-1',
            revokedAt: null,
            expiresAt: new Date(Date.now() - 1),
            userId: baseUser.id,
          },
        ]),
      },
    });
    await expect(service.refresh('expired.jwt')).rejects.toThrow(UnauthorizedException);
  });
});

describe('AuthService.requestPasswordReset', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a PasswordReset row for known emails', async () => {
    bcryptMock.hash.mockResolvedValue('hashed' as never);
    const { service, passwordReset } = makeService({
      users: { findByEmail: jest.fn().mockResolvedValue(baseUser) },
    });
    await service.requestPasswordReset(baseUser.email);
    expect(passwordReset.create).toHaveBeenCalledTimes(1);
    expect(passwordReset.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: baseUser.id,
        tokenHash: 'hashed',
      }),
    });
  });

  it('is silent for unknown emails (no info leak)', async () => {
    const { service, passwordReset } = makeService({
      users: { findByEmail: jest.fn().mockResolvedValue(null) },
    });
    await expect(service.requestPasswordReset('unknown@x.de')).resolves.toBeUndefined();
    expect(passwordReset.create).not.toHaveBeenCalled();
  });
});

describe('AuthService.confirmPasswordReset', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects when no candidate matches', async () => {
    bcryptMock.compare.mockResolvedValue(false as never);
    const { service } = makeService({
      passwordReset: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            {
              id: 'pr-1',
              userId: baseUser.id,
              tokenHash: 'h1',
              expiresAt: new Date(Date.now() + 60_000),
              usedAt: null,
            },
          ]),
      },
    });
    await expect(
      service.confirmPasswordReset({ token: 'wrong', newPassword: 'NewSecret123' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('updates password, marks reset used, and revokes refresh tokens', async () => {
    bcryptMock.compare.mockResolvedValue(true as never);
    bcryptMock.hash.mockResolvedValue('new-hash' as never);
    const transaction = jest.fn().mockResolvedValue([{}, {}, {}]);
    const { service } = makeService({
      passwordReset: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            {
              id: 'pr-1',
              userId: baseUser.id,
              tokenHash: 'h1',
              expiresAt: new Date(Date.now() + 60_000),
              usedAt: null,
            },
          ]),
      },
      transaction,
    });
    await service.confirmPasswordReset({ token: 'valid-token', newPassword: 'NewSecret123' });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction.mock.calls[0]?.[0]).toHaveLength(3);
  });
});

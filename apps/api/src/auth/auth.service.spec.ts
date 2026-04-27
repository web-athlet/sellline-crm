import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { type JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { type AppConfigService } from '../config/config.service';
import { type MailService } from '../mail/mail.service';
import { type PrismaService } from '../prisma/prisma.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

jest.mock('otplib', () => ({
  generateSecret: jest.fn().mockReturnValue('TESTSECRET'),
  generateURI: jest.fn().mockReturnValue('otpauth://totp/test'),
  verifySync: jest.fn(),
}));

const mockToDataURL = jest.fn().mockResolvedValue('data:image/png;base64,test');
jest.mock('qrcode', () => ({
  __esModule: true,
  default: { toDataURL: (...args: unknown[]) => mockToDataURL(...args) },
}));

const makePrisma = () => ({
  client: {
    user: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    passwordReset: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
});

const makeJwt = () => ({
  sign: jest.fn().mockReturnValue('mocked.jwt.token'),
  verify: jest.fn(),
});

const makeMail = () => ({
  sendWelcomeMail: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetMail: jest.fn().mockResolvedValue(undefined),
});

const makeConfig = () => ({
  get: jest.fn((key: string) => {
    const map: Record<string, unknown> = {
      AUTH_JWT_SECRET: 'test-secret-32-chars-long-enough!!',
      AUTH_JWT_REFRESH_SECRET: 'test-refresh-secret-32-chars!!!!!',
      AUTH_JWT_EXPIRES_IN: '15m',
      AUTH_JWT_REFRESH_EXPIRES_IN: '30d',
      EMAIL_ENCRYPTION_KEY: '0'.repeat(64),
    };
    return map[key];
  }),
});

const USER = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'SALES_REP' as const,
  password: 'hashedpw',
  twoFactorEnabled: false,
  twoFactorSecret: null,
};

const ADMIN_USER = { ...USER, id: 'admin-1', role: 'ADMIN' as const };

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof makePrisma>;
  let jwt: ReturnType<typeof makeJwt>;
  let mail: ReturnType<typeof makeMail>;

  beforeEach(() => {
    prisma = makePrisma();
    jwt = makeJwt();
    mail = makeMail();

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      mail as unknown as MailService,
      makeConfig() as unknown as AppConfigService,
    );

    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('newhash');
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    jwt.sign.mockReturnValue('mocked.jwt.token');
  });

  describe('login', () => {
    it('throws 401 when user not found', async () => {
      prisma.client.user.findUnique.mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.login({ email: 'x@y.com', password: 'pw' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws 401 on wrong password', async () => {
      prisma.client.user.findUnique.mockResolvedValue(USER);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.login({ email: USER.email, password: 'wrong' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('returns pendingToken when 2FA enabled', async () => {
      prisma.client.user.findUnique.mockResolvedValue({
        ...USER,
        twoFactorEnabled: true,
        twoFactorSecret: 'secret',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.client.refreshToken.create.mockResolvedValue({});

      const result = await service.login({ email: USER.email, password: 'pw' });
      expect(result).toMatchObject({ twoFactorRequired: true, pendingToken: expect.any(String) });
    });

    it('returns tokens on successful login without 2FA', async () => {
      prisma.client.user.findUnique.mockResolvedValue(USER);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.client.refreshToken.create.mockResolvedValue({});

      const result = await service.login({ email: USER.email, password: 'pw' });
      expect(result).toMatchObject({
        accessToken: 'mocked.jwt.token',
        user: expect.objectContaining({ email: USER.email }),
      });
    });

    it('sets requiresTwoFactorSetup for admin without 2FA', async () => {
      prisma.client.user.findUnique.mockResolvedValue(ADMIN_USER);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.client.refreshToken.create.mockResolvedValue({});

      const result = await service.login({ email: ADMIN_USER.email, password: 'pw' });
      if (!('twoFactorRequired' in result)) {
        expect(result.requiresTwoFactorSetup).toBe(true);
      }
    });
  });

  describe('register', () => {
    it('creates user and sends welcome email', async () => {
      const newUser = { ...USER, id: 'new-1' };
      prisma.client.user.create.mockResolvedValue(newUser);

      const result = await service.register({
        name: 'Test',
        email: 'new@test.com',
        password: 'P@ssw0rd!',
      });
      expect(result.user).toMatchObject({ email: newUser.email });
      expect(mail.sendWelcomeMail).toHaveBeenCalledWith('new@test.com', 'Test');
    });
  });

  describe('logoutAll', () => {
    it('revokes all refresh tokens for user', async () => {
      prisma.client.refreshToken.updateMany.mockResolvedValue({ count: 3 });
      await service.logoutAll('user-1');
      expect(prisma.client.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1', revokedAt: null } }),
      );
    });
  });

  describe('changePassword', () => {
    it('throws 400 on wrong current password', async () => {
      prisma.client.user.findUniqueOrThrow.mockResolvedValue({ password: 'oldhash' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(
        service.changePassword('user-1', { currentPassword: 'wrong', newPassword: 'N3w@pass!' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates password and revokes tokens on success', async () => {
      prisma.client.user.findUniqueOrThrow.mockResolvedValue({ password: 'oldhash' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.client.user.update.mockResolvedValue({});
      prisma.client.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await service.changePassword('user-1', {
        currentPassword: 'correct',
        newPassword: 'N3w@pass!',
      });
      expect(prisma.client.user.update).toHaveBeenCalled();
      expect(prisma.client.refreshToken.updateMany).toHaveBeenCalled();
    });
  });

  describe('generateTwoFactorSecret', () => {
    it('returns secret and qrCodeDataUrl', async () => {
      prisma.client.user.findUniqueOrThrow.mockResolvedValue({ email: USER.email });
      prisma.client.user.update.mockResolvedValue({});

      const result = await service.generateTwoFactorSecret('user-1');
      expect(result).toMatchObject({
        secret: 'TESTSECRET',
        qrCodeDataUrl: expect.stringContaining('data:image'),
      });
    });
  });

  describe('verifyAndEnableTwoFactor', () => {
    it('throws 400 when no secret configured', async () => {
      prisma.client.user.findUniqueOrThrow.mockResolvedValue({ twoFactorSecret: null });
      await expect(
        service.verifyAndEnableTwoFactor('user-1', { code: '123456' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws 400 on invalid code', async () => {
      const { verifySync } = await import('otplib');
      (verifySync as jest.Mock).mockReturnValue({ valid: false });
      prisma.client.user.findUniqueOrThrow.mockResolvedValue({ twoFactorSecret: 'SECRET' });
      await expect(
        service.verifyAndEnableTwoFactor('user-1', { code: '000000' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('enables 2FA on valid code', async () => {
      const { verifySync } = await import('otplib');
      (verifySync as jest.Mock).mockReturnValue({ valid: true, delta: 0 });
      prisma.client.user.findUniqueOrThrow.mockResolvedValue({ twoFactorSecret: 'SECRET' });
      prisma.client.user.update.mockResolvedValue({});

      await service.verifyAndEnableTwoFactor('user-1', { code: '123456' });
      expect(prisma.client.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { twoFactorEnabled: true } }),
      );
    });
  });

  describe('validateTwoFactorLogin', () => {
    it('throws 401 on invalid pending token', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('invalid');
      });
      await expect(
        service.validateTwoFactorLogin({ pendingToken: 'bad', code: '123456' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws 401 on invalid TOTP code', async () => {
      jwt.verify.mockReturnValue({
        sub: 'user-1',
        purpose: 'totp-pending',
        iat: Date.now() / 1000,
      });
      prisma.client.user.findUniqueOrThrow.mockResolvedValue({
        ...USER,
        twoFactorSecret: 'SECRET',
      });
      const { verifySync } = await import('otplib');
      (verifySync as jest.Mock).mockReturnValue({ valid: false });

      await expect(
        service.validateTwoFactorLogin({ pendingToken: 'tok', code: '000000' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('disableTwoFactor', () => {
    it('throws 400 on wrong password', async () => {
      prisma.client.user.findUniqueOrThrow.mockResolvedValue({ password: 'hash' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(
        service.disableTwoFactor('user-1', { password: 'wrong' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('disables 2FA on correct password', async () => {
      prisma.client.user.findUniqueOrThrow.mockResolvedValue({ password: 'hash' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.client.user.update.mockResolvedValue({});

      await service.disableTwoFactor('user-1', { password: 'correct' });
      expect(prisma.client.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { twoFactorEnabled: false, twoFactorSecret: null } }),
      );
    });
  });

  describe('forgotPassword', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('sends reset email when user exists', async () => {
      prisma.client.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'test@example.com' });
      prisma.client.passwordReset.create.mockResolvedValue({});

      const promise = service.forgotPassword('test@example.com');
      await jest.runAllTimersAsync();
      await promise;
      expect(mail.sendPasswordResetMail).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(String),
      );
    });

    it('returns silently when user not found', async () => {
      prisma.client.user.findUnique.mockResolvedValue(null);

      const promise = service.forgotPassword('missing@example.com');
      await jest.runAllTimersAsync();
      await expect(promise).resolves.toBeUndefined();
      expect(mail.sendPasswordResetMail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('throws 400 when token not found', async () => {
      prisma.client.passwordReset.findMany.mockResolvedValue([]);
      await expect(
        service.resetPassword({ token: 'bad', newPassword: 'N3w@pass!' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('resets password and revokes tokens on valid token', async () => {
      const record = { id: 'pr-1', userId: 'user-1', tokenHash: 'hash' };
      prisma.client.passwordReset.findMany.mockResolvedValue([record]);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.client.$transaction.mockResolvedValue([{}, {}, {}]);

      await service.resetPassword({ token: 'validtoken', newPassword: 'N3w@pass!' });
      expect(prisma.client.$transaction).toHaveBeenCalled();
    });
  });
});

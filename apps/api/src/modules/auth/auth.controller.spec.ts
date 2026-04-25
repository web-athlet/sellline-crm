import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';

// @nestjs/throttler v6 stores per-name metadata under keys like
// `THROTTLER:LIMITdefault` (constant + throttler-set name). Constants are not
// re-exported from the package index, so we hard-code them here.
const THROTTLER_LIMIT = 'THROTTLER:LIMIT';
const THROTTLER_TTL = 'THROTTLER:TTL';

function makeController(overrides: Partial<AuthService> = {}) {
  const service = {
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    requestPasswordReset: jest.fn(),
    confirmPasswordReset: jest.fn(),
    verify: jest.fn(),
    ...overrides,
  } as unknown as AuthService;
  return { controller: new AuthController(service), service: service as jest.Mocked<AuthService> };
}

describe('AuthController routing', () => {
  it('delegates POST /login to AuthService.login', async () => {
    const { controller, service } = makeController({
      login: jest.fn().mockResolvedValue({
        accessToken: 'a',
        refreshToken: 'r',
        user: { id: 'u', email: 'a@b.de', name: 'A', role: 'ADMIN' },
      }),
    });
    const body = { email: 'a@b.de', password: 'x' };
    const res = await controller.login(body);
    expect(service.login).toHaveBeenCalledWith(body);
    expect(res.accessToken).toBe('a');
  });

  it('delegates POST /refresh to AuthService.refresh', async () => {
    const { controller, service } = makeController({
      refresh: jest.fn().mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }),
    });
    const res = await controller.refresh({ refreshToken: 'rt' });
    expect(service.refresh).toHaveBeenCalledWith('rt');
    expect(res.accessToken).toBe('a');
  });

  it('delegates POST /logout to AuthService.logout', async () => {
    const { controller, service } = makeController({
      logout: jest.fn().mockResolvedValue(undefined),
    });
    await controller.logout({ refreshToken: 'rt' });
    expect(service.logout).toHaveBeenCalledWith('rt');
  });

  it('delegates POST /password-reset to AuthService.requestPasswordReset', async () => {
    const { controller, service } = makeController({
      requestPasswordReset: jest.fn().mockResolvedValue(undefined),
    });
    await controller.passwordReset({ email: 'a@b.de' });
    expect(service.requestPasswordReset).toHaveBeenCalledWith('a@b.de');
  });

  it('delegates POST /password-reset/confirm to AuthService.confirmPasswordReset', async () => {
    const { controller, service } = makeController({
      confirmPasswordReset: jest.fn().mockResolvedValue(undefined),
    });
    const body = { token: 't', newPassword: 'NewSecret123' };
    await controller.passwordResetConfirm(body);
    expect(service.confirmPasswordReset).toHaveBeenCalledWith(body);
  });
});

describe('AuthController throttler metadata', () => {
  // The @Throttle decorator stores limits in route metadata. These tests assert
  // the rate limits we documented in the plan are actually wired — they catch
  // accidental removals during refactors.

  const methodOf = (name: string): unknown =>
    AuthController.prototype[name as keyof AuthController];
  const limitFor = (method: string): unknown =>
    Reflect.getMetadata(`${THROTTLER_LIMIT}default`, methodOf(method) as object);
  const ttlFor = (method: string): unknown =>
    Reflect.getMetadata(`${THROTTLER_TTL}default`, methodOf(method) as object);

  it('login is throttled at 5 attempts / 60s', () => {
    expect(limitFor('login')).toBe(5);
    expect(ttlFor('login')).toBe(60_000);
  });

  it('refresh is throttled at 10 / 60s', () => {
    expect(limitFor('refresh')).toBe(10);
    expect(ttlFor('refresh')).toBe(60_000);
  });

  it('password-reset request is throttled at 3 / 1h', () => {
    expect(limitFor('passwordReset')).toBe(3);
    expect(ttlFor('passwordReset')).toBe(3_600_000);
  });

  it('password-reset/confirm is throttled at 5 / 1h', () => {
    expect(limitFor('passwordResetConfirm')).toBe(5);
    expect(ttlFor('passwordResetConfirm')).toBe(3_600_000);
  });
});

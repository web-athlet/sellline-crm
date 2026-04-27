import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';

import { type AppConfigService } from '../../config/config.service';
import { type AuthService } from '../auth.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Strategy: MicrosoftPassportStrategy } = require('passport-microsoft') as {
  Strategy: new (options: Record<string, unknown>, verify: (...args: unknown[]) => void) => object;
};

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(MicrosoftPassportStrategy, 'microsoft') {
  constructor(
    config: AppConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: config.get('MICROSOFT_CLIENT_ID'),
      clientSecret: config.get('MICROSOFT_CLIENT_SECRET'),
      callbackURL: `${config.get('API_PUBLIC_URL')}/api/auth/microsoft/callback`,
      scope: ['user.read'],
    });
  }

  async validate(
    accessToken: string,
    _refreshToken: string,
    profile: Record<string, unknown>,
  ): Promise<Awaited<ReturnType<AuthService['handleOAuthLogin']>>> {
    const emails = profile['emails'] as Array<{ value: string }> | undefined;
    const email = emails?.[0]?.value ?? (profile['userPrincipalName'] as string | undefined) ?? '';
    const name = (profile['displayName'] as string | undefined) ?? email;
    return this.authService.handleOAuthLogin(email, name, 'microsoft', accessToken);
  }
}

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile } from 'passport-google-oauth20';

import { type AppConfigService } from '../../config/config.service';
import { type AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    config: AppConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: config.get('GOOGLE_CLIENT_ID'),
      clientSecret: config.get('GOOGLE_CLIENT_SECRET'),
      callbackURL: `${config.get('API_PUBLIC_URL')}/api/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): Promise<Awaited<ReturnType<AuthService['handleOAuthLogin']>>> {
    const email = profile.emails?.[0]?.value ?? '';
    const name = profile.displayName ?? email;
    return this.authService.handleOAuthLogin(email, name, 'google', accessToken);
  }
}

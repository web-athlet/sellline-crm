import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AppConfigService } from '../config/config.service';
import { MailModule } from '../mail/mail.module';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { InternalSecretGuard } from './guards/internal-secret.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { MicrosoftAuthGuard } from './guards/microsoft-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { MicrosoftStrategy } from './strategies/microsoft.strategy';

@Module({
  imports: [
    MailModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.get('AUTH_JWT_SECRET'),
        signOptions: {
          issuer: config.get('AUTH_JWT_ISSUER'),
          audience: config.get('AUTH_JWT_AUDIENCE'),
          expiresIn: config.get('AUTH_JWT_EXPIRES_IN'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    MicrosoftStrategy,
    JwtAuthGuard,
    GoogleAuthGuard,
    MicrosoftAuthGuard,
    RolesGuard,
    InternalSecretGuard,
  ],
  exports: [JwtAuthGuard, RolesGuard, AuthService],
})
export class AuthModule {}

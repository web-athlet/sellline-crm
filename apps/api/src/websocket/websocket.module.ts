import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { WebsocketGateway } from './websocket.gateway';
import { AppConfigModule } from '../config/config.module';
import { AppConfigService } from '../config/config.service';
import { AuthModule } from '../modules/auth/auth.module';

/**
 * Session-0 PFLICHT: the socket layer must be reachable from every feature
 * module without explicit re-imports. Marking this module @Global() makes
 * WebsocketGateway injectable repo-wide, and registering our own JwtModule
 * keeps the gateway's verification path independent of AuthModule's DI graph.
 */
@Global()
@Module({
  imports: [
    AuthModule,
    JwtModule.registerAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        secret: config.get('AUTH_JWT_SECRET'),
        verifyOptions: {
          issuer: config.get('AUTH_JWT_ISSUER'),
          audience: config.get('AUTH_JWT_AUDIENCE'),
        },
      }),
    }),
  ],
  providers: [WebsocketGateway],
  exports: [WebsocketGateway],
})
export class WebsocketModule {}

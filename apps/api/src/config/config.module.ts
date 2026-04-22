import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { parseApiEnv } from '@sellline/shared';

import { AppConfigService } from './config.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: (raw) => parseApiEnv(raw as NodeJS.ProcessEnv),
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}

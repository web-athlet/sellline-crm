import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { AppConfigService } from '../config/config.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        const url = new URL(config.get('REDIS_URL'));
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            password: url.password || undefined,
          },
        };
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}

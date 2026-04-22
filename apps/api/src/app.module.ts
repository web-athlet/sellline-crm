import { Module } from '@nestjs/common';

import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { AppConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { RealtimeModule } from './realtime/realtime.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    AuthModule,
    HealthModule,
    QueueModule,
    RealtimeModule,
    StorageModule,
    AiModule,
  ],
})
export class AppModule {}

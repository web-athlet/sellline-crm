import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheck, type HealthCheckService, type HealthIndicatorResult } from '@nestjs/terminus';
import { Redis } from 'ioredis';

import { type AppConfigService } from '../config/config.service';
import { type PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.checkDb(), () => this.checkRedis()]);
  }

  private async checkDb(): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.client.$queryRaw`SELECT 1`;
      return { database: { status: 'up' } };
    } catch (err) {
      return { database: { status: 'down', error: (err as Error).message } };
    }
  }

  private async checkRedis(): Promise<HealthIndicatorResult> {
    const client = new Redis(this.config.get('REDIS_URL'), {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    try {
      await client.connect();
      const pong = await client.ping();
      await client.quit();
      return { redis: { status: pong === 'PONG' ? 'up' : 'down' } };
    } catch (err) {
      return { redis: { status: 'down', error: (err as Error).message } };
    }
  }
}

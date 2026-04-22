import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, type HealthIndicatorResult } from '@nestjs/terminus';
import { Redis } from 'ioredis';

import { AppConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger('Health');

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
      this.logger.error(`database probe failed: ${(err as Error).message}`);
      return { database: { status: 'down' } };
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
      this.logger.error(`redis probe failed: ${(err as Error).message}`);
      return { redis: { status: 'down' } };
    }
  }
}

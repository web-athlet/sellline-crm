import { Injectable } from '@nestjs/common';
import { parseApiEnv, type ApiEnv } from '@sellline/shared';

@Injectable()
export class AppConfigService {
  readonly env: ApiEnv = parseApiEnv();

  get<K extends keyof ApiEnv>(key: K): ApiEnv[K] {
    return this.env[key];
  }
}

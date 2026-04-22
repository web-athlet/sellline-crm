import { Injectable, Logger } from '@nestjs/common';

import { AppConfigService } from '../config/config.service';

@Injectable()
export class SerperService {
  private readonly logger = new Logger(SerperService.name);
  private readonly apiKey: string;
  private readonly endpoint = 'https://google.serper.dev/search';

  constructor(config: AppConfigService) {
    this.apiKey = config.get('SERPER_API_KEY');
    if (!this.apiKey) {
      this.logger.warn('SERPER_API_KEY missing — web search calls will fail until configured');
    }
  }

  async search(query: string, opts: { num?: number } = {}): Promise<unknown> {
    if (!this.apiKey) throw new Error('SERPER_API_KEY not configured');
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'X-API-KEY': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: opts.num ?? 10 }),
    });
    if (!res.ok) throw new Error(`Serper request failed: ${res.status} ${res.statusText}`);
    return res.json();
  }
}

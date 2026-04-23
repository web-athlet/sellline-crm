import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

import { AppConfigService } from '../../config/config.service';

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  readonly client: OpenAI | null;
  readonly chatModel: string;
  readonly embedModel: string;

  constructor(config: AppConfigService) {
    const apiKey = config.get('OPENAI_API_KEY');
    this.chatModel = config.get('OPENAI_MODEL_CHAT');
    this.embedModel = config.get('OPENAI_MODEL_EMBED');
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY missing — OpenAI calls will fail until configured');
      this.client = null;
      return;
    }
    this.client = new OpenAI({ apiKey });
  }
}

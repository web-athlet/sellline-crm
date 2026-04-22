import { Module } from '@nestjs/common';

import { OpenAiService } from './openai.service';
import { SerperService } from './serper.service';

@Module({
  providers: [OpenAiService, SerperService],
  exports: [OpenAiService, SerperService],
})
export class AiModule {}

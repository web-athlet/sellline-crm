import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

export const SCORING_QUEUE = 'scoring';

@Processor(SCORING_QUEUE)
export class ScoringWorker extends WorkerHost {
  private readonly logger = new Logger(ScoringWorker.name);

  async process(job: Job<unknown>): Promise<void> {
    this.logger.debug(`received ${job.name} (${job.id}) — not implemented`);
  }
}

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

export const ENRICHMENT_QUEUE = 'enrichment';

@Processor(ENRICHMENT_QUEUE)
export class EnrichmentWorker extends WorkerHost {
  private readonly logger = new Logger(EnrichmentWorker.name);

  async process(job: Job<unknown>): Promise<void> {
    this.logger.debug(`received ${job.name} (${job.id}) — not implemented`);
  }
}

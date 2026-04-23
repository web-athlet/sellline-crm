import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

export const GHOSTING_QUEUE = 'ghosting';

@Processor(GHOSTING_QUEUE)
export class GhostingWorker extends WorkerHost {
  private readonly logger = new Logger(GhostingWorker.name);

  async process(job: Job<unknown>): Promise<void> {
    this.logger.debug(`received ${job.name} (${job.id}) — not implemented`);
  }
}

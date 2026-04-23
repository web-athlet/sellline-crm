import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { ENRICHMENT_QUEUE, EnrichmentWorker } from './enrichment.worker';
import { GHOSTING_QUEUE, GhostingWorker } from './ghosting.worker';
import { SCORING_QUEUE, ScoringWorker } from './scoring.worker';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    QueueModule,
    BullModule.registerQueue(
      { name: ENRICHMENT_QUEUE },
      { name: SCORING_QUEUE },
      { name: GHOSTING_QUEUE },
    ),
  ],
  providers: [EnrichmentWorker, ScoringWorker, GhostingWorker],
})
export class WorkersModule {}

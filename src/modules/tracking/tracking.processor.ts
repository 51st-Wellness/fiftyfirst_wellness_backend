import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { QUEUE_NAMES } from 'src/config/queues.config';

@Processor(QUEUE_NAMES.TRACKING)
export class TrackingProcessor extends WorkerHost {
  private readonly logger = new Logger(TrackingProcessor.name);

  constructor(private readonly trackingService: TrackingService) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);

    try {
      if (job.name === 'check-tracking') {
        await this.trackingService.processTrackingCheck(job);
      } else {
        this.logger.warn(`Unknown job type: ${job.name}`);
      }
    } catch (error) {
      this.logger.error(`Error processing job ${job.id}:`, error);
      throw error;
    }
  }
}

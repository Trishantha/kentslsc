import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FacebookService } from './facebook.service.js';

@Injectable()
export class FacebookSyncService {
  private readonly logger = new Logger(FacebookSyncService.name);

  constructor(private readonly facebookService: FacebookService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async scheduledSync(): Promise<void> {
    if (!this.facebookService.isConfigured()) {
      return;
    }

    try {
      await this.facebookService.sync();
    } catch (error) {
      this.logger.warn(
        `Scheduled Facebook sync failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

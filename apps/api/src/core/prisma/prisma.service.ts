import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@kentslsc/database';

const MAX_RETRIES = 5;
const INITIAL_DELAY_MS = 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    if (!process.env.DATABASE_URL) {
      this.logger.warn('DATABASE_URL is not set; starting API without an eager database connection.');
      return;
    }

    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.$connect();
        if (attempt > 1) {
          this.logger.log('Connected to the database after retry.');
        }
        return;
      } catch (error) {
        lastError = error;
        this.logger.warn(`Database connection attempt ${attempt}/${MAX_RETRIES} failed.`);

        if (attempt === MAX_RETRIES) {
          break;
        }

        const delay = INITIAL_DELAY_MS * 2 ** (attempt - 1);
        this.logger.warn(`Retrying database connection in ${delay}ms...`);
        await sleep(delay);
      }
    }

    this.logger.error(
      'Unable to connect to the database during startup; keeping the API alive so the frontend can still load.',
      lastError instanceof Error ? lastError.stack : String(lastError)
    );
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

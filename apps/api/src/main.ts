import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fs from 'fs';
import { createApiApp } from './handler.js';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await createApiApp();
  const configService = app.get(ConfigService);
  const socketPath = configService.get<string>('SOCKET_PATH');

  if (socketPath) {
    const server = app.getHttpServer();

    const removeSocket = () => {
      try {
        if (fs.existsSync(socketPath)) {
          fs.unlinkSync(socketPath);
        }
      } catch {
        // Ignore cleanup errors.
      }
    };

    removeSocket();
    server.listen(socketPath, () => {
      logger.log(`API listening on Unix socket ${socketPath}`);
    });

    const shutdown = async (signal: string) => {
      logger.log(`Received ${signal}, shutting down API...`);
      try {
        await app.close();
      } catch (closeError) {
        logger.error('Error closing API app', closeError);
      }
      removeSocket();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    return;
  }

  const port = configService.get<number>('PORT') ?? 4000;
  const host = configService.get<string>('HOST') ?? '127.0.0.1';
  await app.listen(port, host);
  logger.log(`API running on http://localhost:${port}/api`);
}

if (process.env.UNIFIED_MODE !== 'true') {
  bootstrap().catch((error) => {
    logger.error('Failed to start API', error);
    process.exit(1);
  });
}

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${String(reason)}`);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error.stack ?? String(error));
  process.exit(1);
});

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import express from 'express';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import fs from 'fs';
import { AppModule } from './app.module.js';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);
  const isProduction = configService.get('NODE_ENV') === 'production';

  app.use(helmet());
  app.use(cookieParser());

  const allowedOrigins = new Set<string>([
    configService.get('FRONTEND_URL') ?? 'http://localhost:3000'
  ]);
  // Only trust the dev origin outside production.
  if (!isProduction) {
    allowedOrigins.add('http://localhost:3000');
  }
  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400
  };
  app.enableCors(corsOptions);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  app.setGlobalPrefix('api');
  app.use(
    '/uploads',
    express.static(join(process.cwd(), 'public', 'uploads'), {
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Disposition', 'attachment');
      }
    })
  );

  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Kent SLSC API')
      .setDescription('Kent Sri Lankan Social Club API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  app.enableShutdownHooks();

  const socketPath = configService.get<string>('SOCKET_PATH');
  if (socketPath) {
    await app.init();
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

bootstrap().catch((error) => {
  logger.error('Failed to start API', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${String(reason)}`);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error.stack ?? String(error));
  process.exit(1);
});

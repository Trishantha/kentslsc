import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import express from 'express';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { AppModule } from './app.module.js';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { GlobalExceptionFilter } from './core/exceptions/global-exception.filter.js';

const logger = new Logger('Bootstrap');
const moduleDir = fileURLToPath(new URL('.', import.meta.url));

export async function createApiApp() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);
  const isProduction = configService.get('NODE_ENV') === 'production';
  const trustProxy = configService.get<string>('TRUST_PROXY');
  // Default to trusting X-Forwarded-* headers in production because the API runs
  // behind Hostinger's reverse proxy. The throttler and security features depend
  // on seeing the real client IP, not the proxy's. Operators can still opt out
  // by setting TRUST_PROXY=false explicitly.
  if (trustProxy === 'true' || (trustProxy === undefined && isProduction)) {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  const frontendUrl = configService.get<string>('FRONTEND_URL') ?? '';
  if (isProduction && /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(frontendUrl)) {
    throw new Error(
      `FRONTEND_URL is set to a localhost value (${frontendUrl}) in production. ` +
        'Set a real public origin to prevent broken callbacks, cards, and email links.'
    );
  }

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
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.setGlobalPrefix('api');
  app.use(
    '/uploads',
    express.static(join(moduleDir, '..', 'public', 'uploads'), {
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
  await app.init();
  logger.log('API app initialized');
  return app;
}

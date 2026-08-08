import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import express from 'express';
import cookieParser from 'cookie-parser';
import { join } from 'path';
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

  const allowedOrigins = new Set([
    configService.get('FRONTEND_URL') ?? 'http://localhost:3000',
    'http://localhost:3000'
  ]);
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
      transform: true,
      transformOptions: { enableImplicitConversion: true }
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

  const port = configService.get<number>('PORT') ?? 4000;
  await app.listen(port);
  logger.log(`API running on http://localhost:${port}/api`);
}

bootstrap().catch((error) => {
  logger.error('Failed to start API', error);
  process.exit(1);
});

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { AppModule } from './app.module.js';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { GlobalExceptionFilter } from './core/exceptions/global-exception.filter.js';
import { validateProductionConfig } from './core/config/env.validation.js';

const logger = new Logger('Bootstrap');
const moduleDir = fileURLToPath(new URL('.', import.meta.url));

export async function createApiApp() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);
  const isProduction = configService.get('NODE_ENV') === 'production';

  // Fail fast in production if critical dependencies are missing. The app
  // degrades gracefully in development, but a production deployment without
  // email, payments, or storage is a broken product.
  if (isProduction) {
    validateProductionConfig(configService);
  }
  const trustProxy = configService.get<string>('TRUST_PROXY');
  // Only trust X-Forwarded-* headers when the operator explicitly opts in.
  // Defaulting to "trust" in production lets clients spoof their IP by sending
  // their own forwarding headers, which weakens throttling and audit trails.
  // Set TRUST_PROXY=true only when the deployment is behind a sanitising proxy
  // that strips or overwrites untrusted forwarding headers.
  if (trustProxy === 'true') {
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
  // Compress responses only; request bodies (including Stripe webhook raw
  // bodies captured via rawBody: above) pass through untouched.
  app.use(compression());
  app.use(cookieParser());

  // Allow the configured frontend origin plus its www/non-www twin. Visitors
  // reach the site through both hosts (search results, typed URLs), and they
  // are the same deployment — rejecting the twin turns every POST from that
  // host into a failure.
  const allowedOrigins = new Set<string>();
  const addOrigin = (value: string) => {
    try {
      allowedOrigins.add(new URL(value).origin);
    } catch {
      allowedOrigins.add(value);
    }
  };
  addOrigin(configService.get('FRONTEND_URL') ?? 'http://localhost:3000');
  try {
    const variant = new URL(configService.get('FRONTEND_URL') ?? 'http://localhost:3000');
    if (variant.hostname.includes('.') && !/^(localhost|127\.0\.0\.1)$/i.test(variant.hostname)) {
      variant.hostname = variant.hostname.startsWith('www.')
        ? variant.hostname.slice(4)
        : `www.${variant.hostname}`;
      allowedOrigins.add(variant.origin);
    }
  } catch {
    // FRONTEND_URL is not a parseable URL; the raw value above still applies.
  }
  // Only trust the dev origin outside production.
  if (!isProduction) {
    allowedOrigins.add('http://localhost:3000');
  }
  // Same-origin requests proxied through the web app (the normal browser
  // path) carry an Origin header that browsers do not CORS-check; rejecting
  // such an origin must not 500 the request. Disallowing it (no ACAO header)
  // still blocks genuine cross-origin browser reads.
  const rejectedOrigins = new Set<string>();
  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        if (!rejectedOrigins.has(origin)) {
          rejectedOrigins.add(origin);
          console.warn(`CORS: origin ${origin} not in allowed list (${[...allowedOrigins].join(', ')})`);
        }
        callback(null, false);
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

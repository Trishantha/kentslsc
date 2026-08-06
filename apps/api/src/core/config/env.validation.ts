import { z } from '@kentslsc/shared';

export const envValidationSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  OPENAI_API_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  EMAIL_HOST: z.string().min(1),
  EMAIL_PORT: z.coerce.number().default(587),
  EMAIL_USER: z.string().min(1),
  EMAIL_PASS: z.string().min(1),
  EMAIL_FROM: z.string().email(),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  CARD_STORAGE_PATH: z.string().default('./cards'),
  ADMIN_SECRET: z.string().optional()
});

export type EnvConfig = z.infer<typeof envValidationSchema>;

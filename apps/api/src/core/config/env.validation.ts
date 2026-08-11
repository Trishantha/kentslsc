import { z } from '@kentslsc/shared';

export const envValidationSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  // Optional third-party service keys. The API will start without them and
  // degrade gracefully (e.g. skip AI summaries, queue emails, skip payments).
  OPENAI_API_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  EMAIL_HOST: z.string().optional(),
  EMAIL_PORT: z.coerce.number().default(587),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().optional().or(z.literal('')),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  ADMIN_SECRET: z.string().optional(),
  // Optional Supabase Storage configuration. When provided, uploads are stored
  // in the configured bucket instead of the local filesystem.
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),
  SUPABASE_BUCKET: z.string().default('KentSLSC')
});

export type EnvConfig = z.infer<typeof envValidationSchema>;

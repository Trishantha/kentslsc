import { z } from '@kentslsc/shared';

export const envValidationSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  // Optional third-party service keys. The API will start without them and
  // degrade gracefully (e.g. skip AI summaries, queue emails, skip payments).
  OPENAI_API_KEY: z.string().optional(),
  DEFAULT_PAYMENT_PROVIDER: z.enum(['stripe', 'paypal']).optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_API_BASE_URL: z.string().url().optional().default('https://api-m.sandbox.paypal.com'),
  EMAIL_HOST: z.string().optional(),
  EMAIL_PORT: z.coerce.number().default(587),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  ADMIN_SECRET: z.string().optional(),
  // Emergency admin recovery. Set only when you need to reset the admin password
  // or recreate a missing admin account on a host without shell access, then
  // remove immediately after the first login.
  ADMIN_EMERGENCY_PASSWORD: z.string().optional(),
  ADMIN_EMERGENCY_EMAIL: z.string().email().optional().default('admin@kentslsc.org'),
  // Optional Supabase Storage configuration. When provided, uploads are stored
  // in the configured bucket instead of the local filesystem.
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),
  SUPABASE_BUCKET: z.string().default('KentSLSC')
});

export type EnvConfig = z.infer<typeof envValidationSchema>;

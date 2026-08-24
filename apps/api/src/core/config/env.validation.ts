import { z } from '@kentslsc/shared';
import type { ConfigService } from '@nestjs/config';

export const envValidationSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  // Trust X-Forwarded-For when running behind a reverse proxy (Hostinger, Vercel,
  // etc.). Without this the throttler sees every request as the proxy IP. Only
  // enable in deployed environments where the proxy strips or overwrites untrusted
  // forwarding headers. Defaults to false in all environments; set to "true" explicitly.
  TRUST_PROXY: z.enum(['true', 'false']).optional(),
  API_URL: z.string().url().optional(),
  DATABASE_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  // Optional third-party service keys. The API will start without them and
  // degrade gracefully (e.g. skip AI summaries, queue emails, skip payments).
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_TIMEOUT_MS: z.coerce.number().default(15_000),
  DEFAULT_PAYMENT_PROVIDER: z.enum(['stripe', 'paypal']).optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_WEBHOOK_ID: z.string().optional(),
  PAYPAL_API_BASE_URL: z.enum(['https://api-m.sandbox.paypal.com', 'https://api-m.paypal.com']).optional().default('https://api-m.sandbox.paypal.com'),
  EMAIL_HOST: z.string().optional(),
  EMAIL_PORT: z.coerce.number().default(587),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  FRONTEND_URL: z.string().url().min(1),
  ADMIN_SECRET: z.string().optional(),
  // Emergency admin recovery. Set only when you need to reset the admin password
  // or recreate a missing admin account on a host without shell access, then
  // remove immediately after the first login. ADMIN_EMERGENCY_PASSWORD alone is
  // not sufficient; ADMIN_EMERGENCY_RESET_ENABLED must also be set to "true".
  ADMIN_EMERGENCY_PASSWORD: z.string().optional(),
  ADMIN_EMERGENCY_EMAIL: z.string().email().optional().default('admin@kentslsc.org'),
  ADMIN_EMERGENCY_RESET_ENABLED: z.enum(['true', 'false']).optional().default('false'),
  // Optional Supabase Storage configuration. When provided, uploads are stored
  // in the configured bucket instead of the local filesystem.
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),
  SUPABASE_BUCKET: z.string().default('KentSLSC'),
  // Login lockout / dev helpers.
  LOGIN_MAX_FAILURES: z.coerce.number().default(5),
  AUTH_DEV_RETURN_VERIFICATION_TOKEN: z.enum(['true', 'false']).default('false')
});

export type EnvConfig = z.infer<typeof envValidationSchema>;

/**
 * Validates that production has the dependencies it cannot safely degrade without.
 * This is intentionally separate from the base schema so local development can run
 * with missing Stripe/email/Supabase keys.
 */
export function validateProductionConfig(config: EnvConfig): void;
export function validateProductionConfig(configService: ConfigService): void;
export function validateProductionConfig(config: EnvConfig | ConfigService): void {
  function getValue(key: keyof EnvConfig): unknown {
    if ('get' in config && typeof config.get === 'function') {
      return config.get(key as string);
    }
    return (config as EnvConfig)[key];
  }

  const nodeEnv = getValue('NODE_ENV');
  if (nodeEnv !== 'production') return;

  const missing: string[] = [];

  if (!getValue('DATABASE_URL')) missing.push('DATABASE_URL');
  if (!getValue('EMAIL_HOST')) missing.push('EMAIL_HOST');
  if (!getValue('EMAIL_USER')) missing.push('EMAIL_USER');
  if (!getValue('EMAIL_PASS')) missing.push('EMAIL_PASS');
  if (!getValue('EMAIL_FROM')) missing.push('EMAIL_FROM');
  if (!getValue('SUPABASE_URL')) missing.push('SUPABASE_URL');
  if (!getValue('SUPABASE_SERVICE_KEY')) missing.push('SUPABASE_SERVICE_KEY');

  const provider = (getValue('DEFAULT_PAYMENT_PROVIDER') as EnvConfig['DEFAULT_PAYMENT_PROVIDER']) ?? 'stripe';
  if (provider === 'stripe') {
    if (!getValue('STRIPE_SECRET_KEY')) missing.push('STRIPE_SECRET_KEY');
    if (!getValue('STRIPE_WEBHOOK_SECRET')) missing.push('STRIPE_WEBHOOK_SECRET');
    if (!getValue('STRIPE_PUBLISHABLE_KEY')) missing.push('STRIPE_PUBLISHABLE_KEY');
  } else if (provider === 'paypal') {
    if (!getValue('PAYPAL_CLIENT_ID')) missing.push('PAYPAL_CLIENT_ID');
    if (!getValue('PAYPAL_CLIENT_SECRET')) missing.push('PAYPAL_CLIENT_SECRET');
    if (!getValue('PAYPAL_WEBHOOK_ID')) missing.push('PAYPAL_WEBHOOK_ID');
  }

  if (missing.length > 0) {
    throw new Error(
      `Production startup blocked: the following required environment variables are missing: ${missing.join(', ')}. ` +
        'Set them or run in development mode.'
    );
  }
}

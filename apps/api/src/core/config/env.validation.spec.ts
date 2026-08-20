import { describe, it, expect } from '@jest/globals';
import { validateProductionConfig, type EnvConfig } from './env.validation.js';

function buildConfig(overrides: Record<string, unknown> = {}) {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://localhost/test',
    EMAIL_HOST: 'smtp.example.com',
    EMAIL_USER: 'user',
    EMAIL_PASS: 'pass',
    EMAIL_FROM: 'noreply@example.com',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_KEY: 'key',
    DEFAULT_PAYMENT_PROVIDER: 'stripe',
    STRIPE_SECRET_KEY: 'sk_test',
    STRIPE_WEBHOOK_SECRET: 'whsec',
    STRIPE_PUBLISHABLE_KEY: 'pk_test',
    ...overrides
  } as EnvConfig;
}

describe('validateProductionConfig', () => {
  it('passes when all production dependencies are present', () => {
    expect(() => validateProductionConfig(buildConfig())).not.toThrow();
  });

  it('passes in non-production environments', () => {
    expect(() => validateProductionConfig(buildConfig({ NODE_ENV: 'development', DATABASE_URL: undefined }))).not.toThrow();
  });

  it('throws when DATABASE_URL is missing in production', () => {
    expect(() => validateProductionConfig(buildConfig({ DATABASE_URL: undefined }))).toThrow('DATABASE_URL');
  });

  it('throws when email config is missing in production', () => {
    expect(() => validateProductionConfig(buildConfig({ EMAIL_HOST: undefined }))).toThrow('EMAIL_HOST');
  });

  it('throws when Stripe keys are missing in production', () => {
    expect(() => validateProductionConfig(buildConfig({ STRIPE_SECRET_KEY: undefined }))).toThrow('STRIPE_SECRET_KEY');
  });

  it('throws when PayPal keys are missing in production', () => {
    expect(() =>
      validateProductionConfig(
        buildConfig({
          DEFAULT_PAYMENT_PROVIDER: 'paypal',
          STRIPE_SECRET_KEY: undefined,
          STRIPE_WEBHOOK_SECRET: undefined,
          STRIPE_PUBLISHABLE_KEY: undefined,
          PAYPAL_CLIENT_ID: undefined
        })
      )
    ).toThrow('PAYPAL_CLIENT_ID');
  });

  it('accepts a ConfigService-like object', () => {
    const config = buildConfig();
    const service = {
      get: (key: string) => config[key as keyof typeof config]
    };
    expect(() => validateProductionConfig(service as any)).not.toThrow();
  });
});

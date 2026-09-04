ALTER TABLE "payment_settings"
  ADD COLUMN IF NOT EXISTS "stripe_enabled" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "paypal_enabled" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "gocardless_enabled" boolean NOT NULL DEFAULT true;

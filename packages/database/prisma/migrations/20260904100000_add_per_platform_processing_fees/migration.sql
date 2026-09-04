ALTER TABLE "payment_settings"
  ADD COLUMN IF NOT EXISTS "stripe_fee_enabled" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "stripe_fee_percent" decimal(5, 2) NOT NULL DEFAULT 1.50,
  ADD COLUMN IF NOT EXISTS "stripe_fee_fixed" integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS "paypal_fee_enabled" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "paypal_fee_percent" decimal(5, 2) NOT NULL DEFAULT 1.50,
  ADD COLUMN IF NOT EXISTS "paypal_fee_fixed" integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS "gocardless_fee_enabled" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "gocardless_fee_percent" decimal(5, 2) NOT NULL DEFAULT 1.50,
  ADD COLUMN IF NOT EXISTS "gocardless_fee_fixed" integer NOT NULL DEFAULT 20;

-- Carry the current global fee configuration over to every platform so
-- effective fees do not change on deploy; admins can then adjust per platform.
UPDATE "payment_settings"
SET "stripe_fee_enabled" = "processing_fee_enabled",
    "stripe_fee_percent" = "processing_fee_percent",
    "stripe_fee_fixed" = "processing_fee_fixed",
    "paypal_fee_enabled" = "processing_fee_enabled",
    "paypal_fee_percent" = "processing_fee_percent",
    "paypal_fee_fixed" = "processing_fee_fixed",
    "gocardless_fee_enabled" = "processing_fee_enabled",
    "gocardless_fee_percent" = "processing_fee_percent",
    "gocardless_fee_fixed" = "processing_fee_fixed";

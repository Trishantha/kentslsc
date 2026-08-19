ALTER TABLE "payment_settings"
  ADD COLUMN IF NOT EXISTS "processing_fee_enabled" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "processing_fee_percent" decimal(5, 2) NOT NULL DEFAULT 1.50,
  ADD COLUMN IF NOT EXISTS "processing_fee_fixed" integer NOT NULL DEFAULT 20;

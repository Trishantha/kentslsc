CREATE TABLE IF NOT EXISTS "payment_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider" text NOT NULL DEFAULT 'stripe',
  "stripe_secret_key" text,
  "stripe_webhook_secret" text,
  "stripe_publishable_key" text,
  "paypal_client_id" text,
  "paypal_client_secret" text,
  "paypal_api_base_url" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_payment_settings_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payment_settings_updated_at ON "payment_settings";
CREATE TRIGGER trg_payment_settings_updated_at
BEFORE UPDATE ON "payment_settings"
FOR EACH ROW
EXECUTE FUNCTION set_payment_settings_updated_at();

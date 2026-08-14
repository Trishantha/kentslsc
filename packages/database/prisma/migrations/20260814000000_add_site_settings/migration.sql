CREATE TABLE IF NOT EXISTS "site_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text,
  "phone" text,
  "whatsapp" text,
  "address" text,
  "facebook" text,
  "instagram" text,
  "twitter" text,
  "youtube" text,
  "linkedin" text,
  "tiktok" text,
  "show_page_loader" BOOLEAN DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_site_settings_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_site_settings_updated_at ON "site_settings";
CREATE TRIGGER trg_site_settings_updated_at
BEFORE UPDATE ON "site_settings"
FOR EACH ROW
EXECUTE FUNCTION set_site_settings_updated_at();

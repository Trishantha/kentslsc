-- -----------------------------------------------------------------------------
-- Fix mutable search_path on updated_at trigger functions.
--
-- PostgreSQL functions inherit the caller's search_path by default, which can be
-- exploited for privilege escalation if a function is executed by a role with
-- elevated privileges. Pinning search_path to an empty string prevents the
-- function from resolving unqualified identifiers against any schema.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_site_settings_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE OR REPLACE FUNCTION set_payment_settings_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- -----------------------------------------------------------------------------
-- Enable RLS on policy_documents and gdpr_settings.
--
-- These tables live in the public schema exposed through PostgREST, but the
-- application only reads/writes them via the API, which connects as the table
-- owner and therefore bypasses RLS. Enabling RLS with no policies denies all
-- direct access from the anon and authenticated roles.
-- -----------------------------------------------------------------------------
ALTER TABLE "policy_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "gdpr_settings" ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Enable RLS on the auth tables added by the previous migration.
--
-- Prisma creates tables without RLS, and on Supabase the `public` schema is
-- auto-exposed through PostgREST. These four are the most sensitive tables in
-- the database: `sessions` holds refresh-token hashes and
-- `password_reset_tokens` holds reset-token hashes. Write access via the
-- publishable anon key would allow an attacker to mint their own session row
-- or reset token and take over any account.
--
-- No policies, matching every other table here: deny-all for anon and
-- authenticated. The API connects as the table owner and so bypasses RLS.
-- ---------------------------------------------------------------------------
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_verification_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "password_reset_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth_events" ENABLE ROW LEVEL SECURITY;

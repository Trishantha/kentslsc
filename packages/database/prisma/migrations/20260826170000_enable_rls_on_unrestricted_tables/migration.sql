-- -----------------------------------------------------------------------------
-- Enable RLS on tables that are currently unrestricted.
--
-- Supabase exposes the public schema through PostgREST. The API is the trusted
-- system of record for payment and webhook data, while fundraiser photos are
-- public read-only content. These policies ensure direct client access is denied
-- unless the access pattern is explicitly permitted.
-- -----------------------------------------------------------------------------
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fundraiser_photos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_events" ENABLE ROW LEVEL SECURITY;

-- These tables are backend-owned ledger data. No anon or authenticated client
-- should be able to read or mutate them directly.
CREATE POLICY "payments_deny_client_access"
ON "payments"
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "webhook_events_deny_client_access"
ON "webhook_events"
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- Fundraiser photos are public-facing content, but they must remain read-only
-- from the client side. The API is still allowed to manage them via the table
-- owner connection.
CREATE POLICY "fundraiser_photos_public_select"
ON "fundraiser_photos"
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "fundraiser_photos_deny_client_writes"
ON "fundraiser_photos"
FOR INSERT, UPDATE, DELETE
TO anon, authenticated
USING (false)
WITH CHECK (false);

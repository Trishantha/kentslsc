-- Allow one Stripe Checkout Session to issue multiple tickets.
DROP INDEX IF EXISTS "tickets_stripe_session_id_key";
CREATE INDEX IF NOT EXISTS "tickets_stripe_session_id_idx" ON "tickets"("stripe_session_id");

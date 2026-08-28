-- Add a dedicated Stripe subscription id column to payments so the revenue report
-- can show Payment Intent ids and Subscription ids separately.
ALTER TABLE "payments" ADD COLUMN "provider_subscription_id" TEXT;

CREATE INDEX "payments_provider_subscription_id_idx" ON "payments"("provider_subscription_id");

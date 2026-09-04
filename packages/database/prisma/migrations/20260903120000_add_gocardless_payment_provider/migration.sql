-- Add GoCardless as a selectable payment provider: persisted credentials on
-- payment_settings, a per-user GoCardless customer id, and GoCardless resource
-- links on memberships (mandate, subscription, instalment schedule).
-- All columns are nullable so rows default to "not using GoCardless" and null
-- credentials fall back to the GOCARDLESS_* environment variables.
ALTER TABLE "payment_settings" ADD COLUMN "gocardless_access_token" TEXT;
ALTER TABLE "payment_settings" ADD COLUMN "gocardless_webhook_secret" TEXT;
ALTER TABLE "payment_settings" ADD COLUMN "gocardless_environment" TEXT;
ALTER TABLE "users" ADD COLUMN "gocardless_customer_id" TEXT;
ALTER TABLE "memberships" ADD COLUMN "gocardless_mandate_id" TEXT;
ALTER TABLE "memberships" ADD COLUMN "gocardless_subscription_id" TEXT;
ALTER TABLE "memberships" ADD COLUMN "gocardless_instalment_schedule_id" TEXT;

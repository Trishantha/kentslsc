-- Provider identifiers represent one external payment or checkout globally.
-- Partial indexes keep legacy/manual rows with NULL identifiers unaffected.
CREATE UNIQUE INDEX "payments_provider_payment_id_unique"
ON "payments"("provider_payment_id")
WHERE "provider_payment_id" IS NOT NULL;

CREATE UNIQUE INDEX "payments_provider_checkout_id_unique"
ON "payments"("provider_checkout_id")
WHERE "provider_checkout_id" IS NOT NULL;
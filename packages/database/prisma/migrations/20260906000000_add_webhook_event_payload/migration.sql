-- Store the webhook event payload alongside its hash so failed events can be
-- replayed from the ledger without re-delivery from the provider.
ALTER TABLE "webhook_events" ADD COLUMN "payload" JSONB;

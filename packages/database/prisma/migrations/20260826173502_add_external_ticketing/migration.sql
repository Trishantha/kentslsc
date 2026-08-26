-- -----------------------------------------------------------------------------
-- Add external ticketing URL to events and a ledger table for tracking clicks.
-- -----------------------------------------------------------------------------

ALTER TABLE "events" ADD COLUMN "external_ticketing_url" TEXT;

CREATE TABLE "event_external_ticket_clicks" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT,
    "url" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "clicked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_external_ticket_clicks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "event_external_ticket_clicks_event_id_idx" ON "event_external_ticket_clicks"("event_id");
CREATE INDEX "event_external_ticket_clicks_user_id_idx" ON "event_external_ticket_clicks"("user_id");
CREATE INDEX "event_external_ticket_clicks_clicked_at_idx" ON "event_external_ticket_clicks"("clicked_at");

ALTER TABLE "event_external_ticket_clicks" ADD CONSTRAINT "event_external_ticket_clicks_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "event_external_ticket_clicks" ADD CONSTRAINT "event_external_ticket_clicks_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backend-owned ledger data: deny direct client access.
ALTER TABLE "event_external_ticket_clicks" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_external_ticket_clicks_deny_client_access"
ON "event_external_ticket_clicks"
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

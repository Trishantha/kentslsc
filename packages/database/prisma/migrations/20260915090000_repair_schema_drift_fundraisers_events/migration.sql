-- Repair schema drift that left databases missing columns the Prisma client
-- expects (runtime P2022 "column does not exist" on /api/events and
-- /api/fundraisers). Parts of the schema were introduced without a migration,
-- and some databases recorded the affected migrations as applied without the
-- objects existing. All statements are idempotent so this is safe to run on
-- databases that already have some or all of the objects.

-- Enums for the fundraiser approval workflow (no IF NOT EXISTS for CREATE TYPE).
DO $$ BEGIN
    CREATE TYPE "FundraiserStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'COMPLETED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "FundraiserCategory" AS ENUM ('CHARITY', 'SPORTS', 'COMMUNITY', 'MEMORIAL', 'MEDICAL', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- events.external_ticketing_url (defined in an earlier migration that some
-- databases recorded as applied without applying).
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "external_ticketing_url" TEXT;

-- Fundraiser approval workflow columns.
ALTER TABLE "fundraisers" ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP(3);
ALTER TABLE "fundraisers" ADD COLUMN IF NOT EXISTS "category" "FundraiserCategory" NOT NULL DEFAULT 'CHARITY';
ALTER TABLE "fundraisers" ADD COLUMN IF NOT EXISTS "image_path" TEXT;
ALTER TABLE "fundraisers" ADD COLUMN IF NOT EXISTS "organizer_id" TEXT;
ALTER TABLE "fundraisers" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT;
ALTER TABLE "fundraisers" ADD COLUMN IF NOT EXISTS "status" "FundraiserStatus" NOT NULL DEFAULT 'PENDING_APPROVAL';
ALTER TABLE "fundraisers" ADD COLUMN IF NOT EXISTS "total_donors" INTEGER NOT NULL DEFAULT 0;

-- Existing fundraisers predate the approval workflow and were publicly visible
-- under is_active. Keep them public instead of trapping them in pending state.
UPDATE "fundraisers" SET "status" = 'ACTIVE' WHERE "status" = 'PENDING_APPROVAL' AND "is_active" = true;

-- Donation columns.
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "display_name" TEXT;
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "donor_email" TEXT;
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "is_anonymous" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "is_offline" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "is_verified" BOOLEAN NOT NULL DEFAULT false;

-- Fundraiser update posts.
CREATE TABLE IF NOT EXISTS "fundraiser_updates" (
    "id" TEXT NOT NULL,
    "fundraiser_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fundraiser_updates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "fundraiser_updates_fundraiser_id_idx" ON "fundraiser_updates"("fundraiser_id");

-- Fundraiser workflow indexes.
CREATE INDEX IF NOT EXISTS "fundraisers_status_idx" ON "fundraisers"("status");
CREATE INDEX IF NOT EXISTS "fundraisers_organizer_id_idx" ON "fundraisers"("organizer_id");
CREATE INDEX IF NOT EXISTS "users_back_office_role_id_idx" ON "users"("back_office_role_id");

-- External ticketing click tracking.
CREATE TABLE IF NOT EXISTS "event_external_ticket_clicks" (
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
CREATE INDEX IF NOT EXISTS "event_external_ticket_clicks_event_id_idx" ON "event_external_ticket_clicks"("event_id");
CREATE INDEX IF NOT EXISTS "event_external_ticket_clicks_user_id_idx" ON "event_external_ticket_clicks"("user_id");
CREATE INDEX IF NOT EXISTS "event_external_ticket_clicks_clicked_at_idx" ON "event_external_ticket_clicks"("clicked_at");

-- Foreign keys (guarded; ADD CONSTRAINT has no IF NOT EXISTS).
DO $$ BEGIN
    ALTER TABLE "fundraisers" ADD CONSTRAINT "fundraisers_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "fundraiser_updates" ADD CONSTRAINT "fundraiser_updates_fundraiser_id_fkey" FOREIGN KEY ("fundraiser_id") REFERENCES "fundraisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "fundraiser_updates" ADD CONSTRAINT "fundraiser_updates_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "event_external_ticket_clicks" ADD CONSTRAINT "event_external_ticket_clicks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "event_external_ticket_clicks" ADD CONSTRAINT "event_external_ticket_clicks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

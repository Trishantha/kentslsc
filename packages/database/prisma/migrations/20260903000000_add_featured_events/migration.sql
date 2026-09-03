-- Add free featured (promoted) events, mirroring directory promotions.
ALTER TABLE "events" ADD COLUMN "is_featured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "events" ADD COLUMN "featured_until" TIMESTAMP(3);

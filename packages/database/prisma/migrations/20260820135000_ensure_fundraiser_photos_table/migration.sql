-- EnsureFundraiserPhotosTable
-- The original 20260820124550_add_fundraiser_photos migration attempted to create
-- a UUID fundraiser_id column, but fundraisers.id is TEXT, so its foreign key
-- could not be created. Drop any partial table and recreate it with the correct
-- column type so the fundraiser detail view (which joins fundraiser_photos) works.
DROP TABLE IF EXISTS "fundraiser_photos";

CREATE TABLE "fundraiser_photos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fundraiser_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "path" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fundraiser_photos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fundraiser_photos_fundraiser_id_idx" ON "fundraiser_photos"("fundraiser_id");

ALTER TABLE "fundraiser_photos"
ADD CONSTRAINT "fundraiser_photos_fundraiser_id_fkey"
FOREIGN KEY ("fundraiser_id") REFERENCES "fundraisers"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

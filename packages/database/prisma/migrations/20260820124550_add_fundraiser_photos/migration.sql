-- CreateFundraiserPhotoTable
CREATE TABLE "fundraiser_photos" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "fundraiser_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "path" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fundraiser_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fundraiser_photos_fundraiser_id_idx" ON "fundraiser_photos"("fundraiser_id");

-- AddForeignKey
ALTER TABLE "fundraiser_photos" ADD CONSTRAINT "fundraiser_photos_fundraiser_id_fkey" FOREIGN KEY ("fundraiser_id") REFERENCES "fundraisers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

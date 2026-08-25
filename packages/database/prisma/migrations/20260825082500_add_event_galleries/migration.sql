-- CreateTable
CREATE TABLE "event_galleries" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "event_date" TIMESTAMP(3),
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "event_galleries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_gallery_photos" (
    "id" TEXT NOT NULL,
    "event_gallery_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "path" TEXT,
    "caption" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_gallery_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_galleries_slug_key" ON "event_galleries"("slug");

-- CreateIndex
CREATE INDEX "event_galleries_slug_idx" ON "event_galleries"("slug");

-- CreateIndex
CREATE INDEX "event_galleries_is_published_idx" ON "event_galleries"("is_published");

-- CreateIndex
CREATE INDEX "event_galleries_event_date_idx" ON "event_galleries"("event_date");

-- CreateIndex
CREATE INDEX "event_gallery_photos_event_gallery_id_idx" ON "event_gallery_photos"("event_gallery_id");

-- AddForeignKey
ALTER TABLE "event_gallery_photos" ADD CONSTRAINT "event_gallery_photos_event_gallery_id_fkey" FOREIGN KEY ("event_gallery_id") REFERENCES "event_galleries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

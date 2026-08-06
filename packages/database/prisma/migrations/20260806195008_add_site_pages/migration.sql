-- CreateTable
CREATE TABLE "site_pages" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "is_home" BOOLEAN NOT NULL DEFAULT false,
    "meta_description" TEXT,
    "blocks" JSONB NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_pages_slug_key" ON "site_pages"("slug");

-- CreateIndex
CREATE INDEX "site_pages_slug_idx" ON "site_pages"("slug");

-- CreateIndex
CREATE INDEX "site_pages_is_home_idx" ON "site_pages"("is_home");

-- CreateIndex
CREATE INDEX "site_pages_is_published_idx" ON "site_pages"("is_published");

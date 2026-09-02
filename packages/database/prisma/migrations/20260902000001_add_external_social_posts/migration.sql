-- CreateTable
CREATE TABLE "external_social_posts" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT,
    "image_url" TEXT,
    "url" TEXT NOT NULL,
    "published_at" TIMESTAMP(3),
    "raw_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_social_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "external_social_posts_external_id_key" ON "external_social_posts"("external_id");

-- CreateIndex
CREATE INDEX "external_social_posts_source_published_at_idx" ON "external_social_posts"("source", "published_at");

-- AlterTable
ALTER TABLE "blog_posts" ADD COLUMN "meta_description" TEXT;
ALTER TABLE "blog_posts" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "blog_posts" ADD COLUMN "gallery_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_gallery_id_key" ON "blog_posts"("gallery_id");

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_gallery_id_fkey" FOREIGN KEY ("gallery_id") REFERENCES "event_galleries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

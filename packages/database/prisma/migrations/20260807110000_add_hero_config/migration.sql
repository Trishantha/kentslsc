-- CreateTable
CREATE TABLE "hero_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "media_type" TEXT NOT NULL DEFAULT 'video',
    "image_url" TEXT,
    "video_url" TEXT,
    "overlay_style" TEXT NOT NULL DEFAULT 'noise',
    "overlay_opacity" INTEGER NOT NULL DEFAULT 75,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hero_config_pkey" PRIMARY KEY ("id")
);

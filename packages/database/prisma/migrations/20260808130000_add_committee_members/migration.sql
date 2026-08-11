-- CreateTable
CREATE TABLE "committee_members" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "role_key" TEXT NOT NULL,
    "photo_url" TEXT,
    "photo_path" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "committee_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "committee_members_role_key_key" ON "committee_members"("role_key");

-- CreateIndex
CREATE INDEX "committee_members_display_order_idx" ON "committee_members"("display_order");

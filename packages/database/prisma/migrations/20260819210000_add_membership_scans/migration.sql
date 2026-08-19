-- AlterEnum
ALTER TYPE "Permission" ADD VALUE 'SCAN_MEMBERSHIPS';

-- CreateEnum
CREATE TYPE "MembershipScanResult" AS ENUM ('VALID', 'EXPIRED', 'INACTIVE', 'NOT_FOUND', 'CANCELLED');

-- CreateTable
CREATE TABLE "membership_scans" (
    "id" TEXT NOT NULL,
    "scanned_value" TEXT NOT NULL,
    "membership_id" TEXT,
    "result" "MembershipScanResult" NOT NULL,
    "member_name" TEXT,
    "membership_type" TEXT,
    "scanned_by_id" TEXT NOT NULL,
    "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_scans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "membership_scans_membership_id_idx" ON "membership_scans"("membership_id");

-- CreateIndex
CREATE INDEX "membership_scans_scanned_by_id_idx" ON "membership_scans"("scanned_by_id");

-- CreateIndex
CREATE INDEX "membership_scans_scanned_at_idx" ON "membership_scans"("scanned_at");

-- AddForeignKey
ALTER TABLE "membership_scans" ADD CONSTRAINT "membership_scans_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("membership_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership_scans" ADD CONSTRAINT "membership_scans_scanned_by_id_fkey" FOREIGN KEY ("scanned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

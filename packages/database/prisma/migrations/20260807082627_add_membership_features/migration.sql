-- AlterTable
ALTER TABLE "membership_types" ADD COLUMN     "auto_activate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "features" TEXT[] DEFAULT ARRAY[]::TEXT[];

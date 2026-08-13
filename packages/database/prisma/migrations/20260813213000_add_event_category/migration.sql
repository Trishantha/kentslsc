-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('CULTURAL', 'SOCIAL', 'SPORTS', 'CHARITY', 'EDUCATIONAL', 'COMMUNITY', 'FAMILY', 'RELIGIOUS', 'FOOD', 'ENTERTAINMENT', 'BUSINESS', 'OTHER');

-- AlterTable
ALTER TABLE "events" ADD COLUMN "category" "EventCategory" NOT NULL DEFAULT 'OTHER';

-- CreateIndex
CREATE INDEX "events_category_idx" ON "events"("category");

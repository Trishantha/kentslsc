-- CreateEnum
CREATE TYPE "EventRegistrationMode" AS ENUM ('TICKETED', 'ENROLLMENT');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "registration_mode" "EventRegistrationMode" NOT NULL DEFAULT 'TICKETED';

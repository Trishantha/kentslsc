-- Add user status to support banning accounts.
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'BANNED');

ALTER TABLE "users" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

-- Existing users remain active.

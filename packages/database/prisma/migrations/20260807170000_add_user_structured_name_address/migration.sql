-- AlterTable
ALTER TABLE "users" ADD COLUMN "first_name" TEXT,
ADD COLUMN "last_name" TEXT;

-- Backfill existing users from legacy name column
UPDATE "users"
SET "first_name" = SPLIT_PART("name", ' ', 1),
    "last_name" = TRIM(SUBSTRING("name" FROM POSITION(' ' IN "name") + 1))
WHERE "first_name" IS NULL;

-- AlterTable: convert address from text to jsonb
ALTER TABLE "users" ALTER COLUMN "address" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "address" TYPE JSONB USING CASE
  WHEN "address" IS NULL OR "address" = '' THEN NULL
  ELSE jsonb_build_object('buildingStreet', "address")
END;

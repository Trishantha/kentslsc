-- Add social media link columns to business_listings
ALTER TABLE "business_listings"
ADD COLUMN "facebook" TEXT,
ADD COLUMN "instagram" TEXT,
ADD COLUMN "twitter" TEXT,
ADD COLUMN "youtube" TEXT,
ADD COLUMN "linkedin" TEXT,
ADD COLUMN "tiktok" TEXT;

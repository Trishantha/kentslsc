-- Add payment tracking to memberships and business listings
ALTER TABLE "memberships" ADD COLUMN "paid_at" TIMESTAMP(3);
ALTER TABLE "memberships" ADD COLUMN "payment_method" TEXT;

ALTER TABLE "business_listings" ADD COLUMN "promotion_paid_at" TIMESTAMP(3);
ALTER TABLE "business_listings" ADD COLUMN "promotion_payment_method" TEXT;

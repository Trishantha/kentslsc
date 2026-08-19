-- Add prorated credit tracking for membership downgrades
ALTER TABLE "memberships" ADD COLUMN "credit_amount_applied" DECIMAL(10, 2);
ALTER TABLE "memberships" ADD COLUMN "credit_months_granted" INTEGER;

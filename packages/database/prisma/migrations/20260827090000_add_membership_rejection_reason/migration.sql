-- Store the reason an admin rejected a membership application so the member
-- and other admins can see why it was declined (and refunded).
ALTER TABLE "memberships" ADD COLUMN "rejection_reason" TEXT;

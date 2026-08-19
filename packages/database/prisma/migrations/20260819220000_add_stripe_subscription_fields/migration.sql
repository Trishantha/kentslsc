-- Add Stripe subscription fields to membership types and memberships

-- MembershipType: link each paid plan to a Stripe Product/Price
ALTER TABLE "membership_types" ADD COLUMN "stripe_product_id" TEXT;
ALTER TABLE "membership_types" ADD COLUMN "stripe_price_id" TEXT;

-- Membership: track the Stripe subscription/customer/price associated with this membership
ALTER TABLE "memberships" ADD COLUMN "stripe_customer_id" TEXT;
ALTER TABLE "memberships" ADD COLUMN "stripe_subscription_id" TEXT;
ALTER TABLE "memberships" ADD COLUMN "stripe_price_id" TEXT;

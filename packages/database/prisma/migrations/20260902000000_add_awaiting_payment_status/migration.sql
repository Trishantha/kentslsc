-- Add AWAITING_PAYMENT to the membership status enum.
-- This status is used for paid memberships that have been approved by an admin
-- and are now waiting for the member to complete payment.
ALTER TYPE "MembershipStatus" ADD VALUE 'AWAITING_PAYMENT' AFTER 'AWAITING_APPROVAL';

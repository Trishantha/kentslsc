-- Add AWAITING_APPROVAL to the membership status enum.
-- This status is used for paid memberships that have been applied for but
-- still require an admin review and payment before activation/card generation.
ALTER TYPE "MembershipStatus" ADD VALUE 'AWAITING_APPROVAL' AFTER 'PENDING';

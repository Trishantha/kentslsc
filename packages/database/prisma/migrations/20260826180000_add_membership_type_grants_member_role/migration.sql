-- Add grants_member_role column to membership_types
ALTER TABLE "membership_types"
ADD COLUMN "grants_member_role" BOOLEAN NOT NULL DEFAULT TRUE;

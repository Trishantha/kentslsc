-- Add optional per-type issuance cap for memberships.
ALTER TABLE "membership_types"
ADD COLUMN "max_issuances" INTEGER;

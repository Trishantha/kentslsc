-- Add paused flag to membership types so they can be hidden from sign-up without deleting them.
ALTER TABLE "membership_types"
ADD COLUMN "is_paused" BOOLEAN NOT NULL DEFAULT false;

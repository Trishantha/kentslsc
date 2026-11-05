-- Marks placeholder User rows created for ticket purchases made without an
-- account. These rows hold the guest's name/email (and their tickets) but a
-- random unguessable password hash, so they cannot be used to log in. The flag
-- is cleared when the email owner registers or resets their password, at
-- which point the row becomes a normal account and the tickets attached to it
-- simply appear in the new account.
ALTER TABLE "users" ADD COLUMN "guest_checkout" BOOLEAN NOT NULL DEFAULT false;

-- Store whether the sender accepted the privacy policy on the contact form.
ALTER TABLE "contact_messages"
ADD COLUMN "consent" BOOLEAN NOT NULL DEFAULT false;

-- Site-wide SEO defaults (meta title, meta description, meta keywords),
-- editable from the admin dashboard by users with the MANAGE_SEO permission
-- and rendered as Next.js metadata defaults in the root layout.
ALTER TYPE "Permission" ADD VALUE 'MANAGE_SEO';

ALTER TABLE "site_settings"
  ADD COLUMN "meta_title" TEXT,
  ADD COLUMN "meta_description" TEXT,
  ADD COLUMN "meta_keywords" TEXT;

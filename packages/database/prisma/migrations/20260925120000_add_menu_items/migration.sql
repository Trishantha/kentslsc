-- Admin-managed public navigation menus with one level of submenus.
-- Items link to an internal path or a CMS page (site_pages) and carry
-- per-locale labels (English/Sinhala/Tamil).

ALTER TYPE "Permission" ADD VALUE 'MANAGE_NAVIGATION';

CREATE TABLE "menu_items" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT,
    "label_en" TEXT NOT NULL,
    "label_si" TEXT,
    "label_ta" TEXT,
    "link_type" TEXT NOT NULL DEFAULT 'path',
    "path" TEXT,
    "page_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "menu_items_parent_id_idx" ON "menu_items"("parent_id");
CREATE INDEX "menu_items_sort_order_idx" ON "menu_items"("sort_order");

ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "site_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the public navbar with the links that were previously hardcoded in
-- Navbar.tsx, so the DB-driven menu renders the same navigation on deploy.
-- Fixed UUIDs + NOT EXISTS guards keep the seed idempotent.
INSERT INTO "menu_items" ("id", "label_en", "label_si", "label_ta", "link_type", "path", "sort_order", "is_visible", "updated_at")
SELECT '00000000-0000-4000-8000-000000000001', 'Home', 'මුල් පිටුව', 'வீடு', 'path', '/', 0, true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "menu_items" WHERE "path" = '/');

INSERT INTO "menu_items" ("id", "label_en", "label_si", "label_ta", "link_type", "path", "sort_order", "is_visible", "updated_at")
SELECT '00000000-0000-4000-8000-000000000002', 'Events', 'වැඩසටහන්', 'நிகழ்வுகள்', 'path', '/events', 1, true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "menu_items" WHERE "path" = '/events');

INSERT INTO "menu_items" ("id", "label_en", "label_si", "label_ta", "link_type", "path", "sort_order", "is_visible", "updated_at")
SELECT '00000000-0000-4000-8000-000000000003', 'Directory', 'නාමාවලිය', 'அடைவு', 'path', '/directory', 2, true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "menu_items" WHERE "path" = '/directory');

INSERT INTO "menu_items" ("id", "label_en", "label_si", "label_ta", "link_type", "path", "sort_order", "is_visible", "updated_at")
SELECT '00000000-0000-4000-8000-000000000004', 'Fundraising', 'අරමුදල් රැස් කිරීම', 'நிதி திரட்டுதல்', 'path', '/fundraisers', 3, true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "menu_items" WHERE "path" = '/fundraisers');

INSERT INTO "menu_items" ("id", "label_en", "label_si", "label_ta", "link_type", "path", "sort_order", "is_visible", "updated_at")
SELECT '00000000-0000-4000-8000-000000000005', 'Blog', 'බ්ලොග්', 'வலைப்பதிவு', 'path', '/blog', 4, true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "menu_items" WHERE "path" = '/blog');

INSERT INTO "menu_items" ("id", "label_en", "label_si", "label_ta", "link_type", "path", "sort_order", "is_visible", "updated_at")
SELECT '00000000-0000-4000-8000-000000000006', 'About', 'අප ගැන', 'பற்றி', 'path', '/about', 5, true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "menu_items" WHERE "path" = '/about');

INSERT INTO "menu_items" ("id", "label_en", "label_si", "label_ta", "link_type", "path", "sort_order", "is_visible", "updated_at")
SELECT '00000000-0000-4000-8000-000000000007', 'Emergency', 'හදිසි අවස්ථා', 'அவசரகாலம்', 'path', '/emergency', 6, true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "menu_items" WHERE "path" = '/emergency');

INSERT INTO "menu_items" ("id", "label_en", "label_si", "label_ta", "link_type", "path", "sort_order", "is_visible", "updated_at")
SELECT '00000000-0000-4000-8000-000000000008', 'Contact', 'අමතන්න', 'தொடர்பு கொள்ளவும்', 'path', '/contact', 7, true, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "menu_items" WHERE "path" = '/contact');

-- Create the permission enum used for granular back-office access control.
CREATE TYPE "Permission" AS ENUM (
  'MANAGE_USERS',
  'MANAGE_MEMBERSHIPS',
  'MANAGE_EVENTS',
  'MANAGE_TICKETS',
  'MANAGE_DIRECTORY',
  'MANAGE_JOBS',
  'MANAGE_FUNDRAISERS',
  'MANAGE_BLOG',
  'MANAGE_FORUM',
  'MANAGE_CONTACT_MESSAGES',
  'MANAGE_SITE_SETTINGS',
  'MANAGE_HERO',
  'MANAGE_PAGES',
  'MANAGE_PAYMENTS',
  'MANAGE_COMMITTEE',
  'VIEW_ADMIN_DASHBOARD'
);

-- Add the optional back-office role reference to users.
ALTER TABLE "users" ADD COLUMN "back_office_role_id" TEXT;

-- Reusable back-office roles (e.g. "Events Manager", "Membership Coordinator").
CREATE TABLE "back_office_roles" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "back_office_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "back_office_roles_name_key" ON "back_office_roles"("name");

-- Permissions assigned to each back-office role.
CREATE TABLE "back_office_role_permissions" (
  "id" TEXT NOT NULL,
  "role_id" TEXT NOT NULL,
  "permission" "Permission" NOT NULL,

  CONSTRAINT "back_office_role_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "back_office_role_permissions_role_id_permission_key" ON "back_office_role_permissions"("role_id", "permission");
CREATE INDEX "back_office_role_permissions_role_id_idx" ON "back_office_role_permissions"("role_id");
CREATE INDEX "back_office_role_permissions_permission_idx" ON "back_office_role_permissions"("permission");

-- Direct permissions granted to a user, plus inherited role permissions.
CREATE TABLE "user_permissions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "permission" "Permission" NOT NULL,
  "source_role_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_permissions_user_id_permission_key" ON "user_permissions"("user_id", "permission");
CREATE INDEX "user_permissions_user_id_idx" ON "user_permissions"("user_id");
CREATE INDEX "user_permissions_permission_idx" ON "user_permissions"("permission");
CREATE INDEX "user_permissions_source_role_id_idx" ON "user_permissions"("source_role_id");

-- Foreign key constraints.
ALTER TABLE "users" ADD CONSTRAINT "users_back_office_role_id_fkey" FOREIGN KEY ("back_office_role_id") REFERENCES "back_office_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "back_office_role_permissions" ADD CONSTRAINT "back_office_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "back_office_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_source_role_id_fkey" FOREIGN KEY ("source_role_id") REFERENCES "back_office_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add the explicit lockout-cleared marker used by the Postgres-backed login lockout flow.
ALTER TYPE "AuthEventType" ADD VALUE IF NOT EXISTS 'LOCKOUT_CLEARED';

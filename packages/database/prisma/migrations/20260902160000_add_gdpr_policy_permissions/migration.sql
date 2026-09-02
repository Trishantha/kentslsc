-- Add missing back-office permissions for GDPR settings and policy documents.
ALTER TYPE "Permission" ADD VALUE 'MANAGE_GDPR_SETTINGS';
ALTER TYPE "Permission" ADD VALUE 'MANAGE_POLICY_DOCUMENTS';

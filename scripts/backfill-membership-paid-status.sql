-- Backfill missing payment_method / paid_at on active paid memberships
-- from the first completed Payment row linked to each membership.
--
-- Run this in the Supabase SQL Editor.
-- Use the SELECT block first to preview, then the UPDATE block to apply.

WITH first_completed_payment AS (
  SELECT DISTINCT ON (p.membership_id)
    p.membership_id,
    p.payment_method,
    p.payment_channel,
    p.purchased_at,
    p.created_at
  FROM payments p
  WHERE p.payment_status = 'COMPLETED'
    AND p.deleted_at IS NULL
    AND p.membership_id IS NOT NULL
  ORDER BY p.membership_id, p.purchased_at ASC NULLS LAST, p.created_at ASC
)
-- Preview rows that would be updated
-- SELECT
--   m.membership_id,
--   m.payment_method AS old_payment_method,
--   COALESCE(m.payment_method, fcp.payment_method, fcp.payment_channel, 'stripe') AS new_payment_method,
--   m.paid_at AS old_paid_at,
--   COALESCE(m.paid_at, fcp.purchased_at, fcp.created_at) AS new_paid_at
-- FROM memberships m
-- JOIN first_completed_payment fcp ON m.id = fcp.membership_id
-- WHERE m.deleted_at IS NULL
--   AND (m.payment_method IS NULL OR m.paid_at IS NULL);

UPDATE memberships m
SET
  payment_method = COALESCE(m.payment_method, fcp.payment_method, fcp.payment_channel, 'stripe'),
  paid_at = COALESCE(m.paid_at, fcp.purchased_at, fcp.created_at)
FROM first_completed_payment fcp
WHERE m.id = fcp.membership_id
  AND m.deleted_at IS NULL
  AND (m.payment_method IS NULL OR m.paid_at IS NULL);

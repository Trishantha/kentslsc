-- -----------------------------------------------------------------------------
-- Add a unique constraint so a single payment cannot be recorded twice for the
-- same fundraiser. This prevents duplicate donations and inflated totals when a
-- Stripe or PayPal webhook is retried or replayed.
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX "donations_fundraiser_payment_unique"
  ON "donations"("fundraiser_id", "payment_id");

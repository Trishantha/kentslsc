-- Stripe payout and balance transaction snapshots for finance reconciliation.
-- Rows are upserted from stripe.payouts.list / stripe.balanceTransactions.list
-- (via PayoutSyncService) and matched query-time against the payments ledger
-- through stripe_balance_transactions.source_payment_intent_id =
-- payments.provider_payment_id. No FK into payments on purpose: matching
-- stays query-time so ledger backfills cannot break it.

-- CreateTable
CREATE TABLE "stripe_payouts" (
    "id" TEXT NOT NULL,
    "payout_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "status" TEXT NOT NULL,
    "arrival_date" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stripe_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_balance_transactions" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "available_on" TIMESTAMP(3) NOT NULL,
    "created" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "payout_id" TEXT,
    "source_id" TEXT,
    "source_payment_intent_id" TEXT,
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stripe_balance_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stripe_payouts_payout_id_key" ON "stripe_payouts"("payout_id");

-- CreateIndex
CREATE INDEX "stripe_payouts_arrival_date_idx" ON "stripe_payouts"("arrival_date");

-- CreateIndex
CREATE INDEX "stripe_payouts_status_idx" ON "stripe_payouts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_balance_transactions_transaction_id_key" ON "stripe_balance_transactions"("transaction_id");

-- CreateIndex
CREATE INDEX "stripe_balance_transactions_payout_id_idx" ON "stripe_balance_transactions"("payout_id");

-- CreateIndex
CREATE INDEX "stripe_balance_transactions_source_payment_intent_id_idx" ON "stripe_balance_transactions"("source_payment_intent_id");

-- CreateIndex
CREATE INDEX "stripe_balance_transactions_available_on_idx" ON "stripe_balance_transactions"("available_on");

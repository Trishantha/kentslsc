-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'PARTIALLY_REFUNDED';

-- CreateEnum
CREATE TYPE "PaymentSourceType" AS ENUM ('TICKET', 'MEMBERSHIP', 'DONATION', 'DIRECTORY_PROMOTION', 'JOB_PUBLISH', 'MANUAL');

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "donations" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "job_ads" ADD COLUMN     "publish_paid_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "payment_channel" TEXT NOT NULL,
    "payment_method" TEXT,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider_payment_id" TEXT,
    "provider_checkout_id" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "gross_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "processing_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "refunded_amount" DECIMAL(12,2),
    "refund_reason" TEXT,
    "refunded_at" TIMESTAMP(3),
    "description" TEXT,
    "notes" TEXT,
    "payer_name" TEXT,
    "payer_email" TEXT,
    "payer_phone" TEXT,
    "payer_address_line1" TEXT,
    "payer_address_line2" TEXT,
    "payer_city" TEXT,
    "payer_postcode" TEXT,
    "payer_country" TEXT,
    "purchased_at" TIMESTAMP(3),
    "source_type" "PaymentSourceType" NOT NULL,
    "source_id" TEXT,
    "event_id" TEXT,
    "ticket_id" TEXT,
    "membership_id" TEXT,
    "donation_id" TEXT,
    "business_listing_id" TEXT,
    "job_ad_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_donation_id_fkey" FOREIGN KEY ("donation_id") REFERENCES "donations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_business_listing_id_fkey" FOREIGN KEY ("business_listing_id") REFERENCES "business_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_job_ad_id_fkey" FOREIGN KEY ("job_ad_id") REFERENCES "job_ads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "payments_user_id_idx" ON "payments"("user_id");

-- CreateIndex
CREATE INDEX "payments_payment_status_idx" ON "payments"("payment_status");

-- CreateIndex
CREATE INDEX "payments_payment_channel_idx" ON "payments"("payment_channel");

-- CreateIndex
CREATE INDEX "payments_source_type_idx" ON "payments"("source_type");

-- CreateIndex
CREATE INDEX "payments_source_id_idx" ON "payments"("source_id");

-- CreateIndex
CREATE INDEX "payments_ticket_id_idx" ON "payments"("ticket_id");

-- CreateIndex
CREATE INDEX "payments_provider_checkout_id_idx" ON "payments"("provider_checkout_id");

-- CreateIndex
CREATE INDEX "payments_provider_payment_id_idx" ON "payments"("provider_payment_id");

-- CreateIndex
CREATE INDEX "payments_purchased_at_idx" ON "payments"("purchased_at");

-- CreateIndex
CREATE INDEX "payments_created_at_idx" ON "payments"("created_at");

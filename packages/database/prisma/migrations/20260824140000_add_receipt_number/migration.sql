-- CreateTable
CREATE TABLE "receipt_number_sequences" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "number" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipt_number_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "receipt_number_sequences_year_key" ON "receipt_number_sequences"("year");

-- AlterTable
ALTER TABLE "payments" ADD COLUMN "receipt_number" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "payments_receipt_number_key" ON "payments"("receipt_number");

-- CreateIndex
CREATE INDEX "payments_receipt_number_idx" ON "payments"("receipt_number");

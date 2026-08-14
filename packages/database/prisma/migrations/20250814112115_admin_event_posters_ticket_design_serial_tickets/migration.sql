-- AlterTable
ALTER TABLE "events" ADD COLUMN     "poster_image_url" TEXT,
ADD COLUMN     "poster_images" JSONB,
ADD COLUMN     "ticket_design" JSONB;

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "serial_number" INTEGER,
ADD COLUMN     "ticket_number" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticket_number_key" ON "tickets"("ticket_number");

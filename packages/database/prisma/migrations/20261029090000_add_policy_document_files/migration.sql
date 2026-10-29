-- CreateTable
CREATE TABLE "policy_document_files" (
    "id" TEXT NOT NULL,
    "policy_document_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_size" INTEGER,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_document_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "policy_document_files_policy_document_id_idx" ON "policy_document_files"("policy_document_id");

-- AddForeignKey
ALTER TABLE "policy_document_files" ADD CONSTRAINT "policy_document_files_policy_document_id_fkey" FOREIGN KEY ("policy_document_id") REFERENCES "policy_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

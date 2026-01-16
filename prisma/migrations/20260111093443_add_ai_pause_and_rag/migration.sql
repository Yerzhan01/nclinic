-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "ai_pause_reason" TEXT,
ADD COLUMN     "ai_paused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ai_paused_at" TIMESTAMP(3),
ADD COLUMN     "ai_paused_by" TEXT;

-- CreateTable
CREATE TABLE "rag_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rag_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rag_documents" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rag_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rag_documents_source_id_idx" ON "rag_documents"("source_id");

-- AddForeignKey
ALTER TABLE "rag_documents" ADD CONSTRAINT "rag_documents_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "rag_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "AIErrorType" AS ENUM ('REPEAT_QUESTION', 'COMPLAINT', 'CONFUSION', 'HANDOFF_REQUEST');

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "prompt_variant_id" TEXT;

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "conversation_summary" TEXT,
ADD COLUMN     "conversation_summary_at" TIMESTAMP(3),
ADD COLUMN     "message_count_since_summary" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ai_quality_logs" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "errorType" "AIErrorType" NOT NULL,
    "ai_message_id" TEXT NOT NULL,
    "patient_reply_id" TEXT NOT NULL,
    "ai_content" TEXT NOT NULL,
    "patient_reply" TEXT NOT NULL,
    "prompt_variant_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_quality_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_variants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "system_prompt" TEXT NOT NULL,
    "style_guide" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 50,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "total_messages" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "handoff_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prompt_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_quality_logs_patient_id_idx" ON "ai_quality_logs"("patient_id");

-- CreateIndex
CREATE INDEX "ai_quality_logs_created_at_idx" ON "ai_quality_logs"("created_at");

-- CreateIndex
CREATE INDEX "ai_quality_logs_errorType_idx" ON "ai_quality_logs"("errorType");

-- AddForeignKey
ALTER TABLE "ai_quality_logs" ADD CONSTRAINT "ai_quality_logs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

/*
  Warnings:

  - You are about to drop the column `ai_result` on the `check_ins` table. All the data in the column will be lost.
  - You are about to drop the column `day_number` on the `check_ins` table. All the data in the column will be lost.
  - You are about to drop the column `expected_type` on the `check_ins` table. All the data in the column will be lost.
  - You are about to drop the column `program_instance_id` on the `check_ins` table. All the data in the column will be lost.
  - You are about to drop the column `received_message_id` on the `check_ins` table. All the data in the column will be lost.
  - You are about to drop the column `reminder_sent_at` on the `check_ins` table. All the data in the column will be lost.
  - You are about to drop the column `required` on the `check_ins` table. All the data in the column will be lost.
  - You are about to drop the column `slot` on the `check_ins` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `check_ins` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `check_ins` table. All the data in the column will be lost.
  - Added the required column `patient_id` to the `check_ins` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `check_ins` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CheckInType" AS ENUM ('WEIGHT', 'MOOD', 'DIET_ADHERENCE', 'STEPS', 'SLEEP', 'FREE_TEXT');

-- CreateEnum
CREATE TYPE "CheckInSource" AS ENUM ('PATIENT', 'STAFF', 'AI');

-- DropForeignKey
ALTER TABLE "check_ins" DROP CONSTRAINT "check_ins_program_instance_id_fkey";

-- DropIndex
DROP INDEX "check_ins_program_instance_id_day_number_slot_key";

-- AlterTable
ALTER TABLE "check_ins" DROP COLUMN "ai_result",
DROP COLUMN "day_number",
DROP COLUMN "expected_type",
DROP COLUMN "program_instance_id",
DROP COLUMN "received_message_id",
DROP COLUMN "reminder_sent_at",
DROP COLUMN "required",
DROP COLUMN "slot",
DROP COLUMN "status",
DROP COLUMN "updated_at",
ADD COLUMN     "media" JSONB,
ADD COLUMN     "patient_id" TEXT NOT NULL,
ADD COLUMN     "source" "CheckInSource" NOT NULL DEFAULT 'PATIENT',
ADD COLUMN     "type" "CheckInType" NOT NULL,
ADD COLUMN     "value_bool" BOOLEAN,
ADD COLUMN     "value_number" DOUBLE PRECISION,
ADD COLUMN     "value_text" TEXT;

-- CreateIndex
CREATE INDEX "check_ins_patient_id_type_created_at_idx" ON "check_ins"("patient_id", "type", "created_at");

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

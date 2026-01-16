/*
  Warnings:

  - The values [NORMAL,URGENT] on the enum `TaskPriority` will be removed. If these variants are still used in the database, this will fail.
  - The values [CANCELLED] on the enum `TaskStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [CALL_PATIENT,CHECK_MESSAGE,REVIEW_ALERT] on the enum `TaskType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `note` on the `tasks` table. All the data in the column will be lost.
  - Added the required column `source` to the `tasks` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TaskSource" AS ENUM ('AI', 'SYSTEM', 'OPERATOR');

-- AlterEnum
ALTER TYPE "CheckInType" ADD VALUE 'VISIT';

-- AlterEnum
BEGIN;
CREATE TYPE "TaskPriority_new" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
ALTER TABLE "public"."tasks" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE "tasks" ALTER COLUMN "priority" TYPE "TaskPriority_new" USING ("priority"::text::"TaskPriority_new");
ALTER TYPE "TaskPriority" RENAME TO "TaskPriority_old";
ALTER TYPE "TaskPriority_new" RENAME TO "TaskPriority";
DROP TYPE "public"."TaskPriority_old";
ALTER TABLE "tasks" ALTER COLUMN "priority" SET DEFAULT 'MEDIUM';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "TaskStatus_new" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE');
ALTER TABLE "public"."tasks" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "tasks" ALTER COLUMN "status" TYPE "TaskStatus_new" USING ("status"::text::"TaskStatus_new");
ALTER TYPE "TaskStatus" RENAME TO "TaskStatus_old";
ALTER TYPE "TaskStatus_new" RENAME TO "TaskStatus";
DROP TYPE "public"."TaskStatus_old";
ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'OPEN';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "TaskType_new" AS ENUM ('RISK_ALERT', 'MISSED_CHECKIN', 'FOLLOW_UP', 'VISIT_FOLLOWUP', 'CUSTOM');
ALTER TABLE "public"."tasks" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "tasks" ALTER COLUMN "type" TYPE "TaskType_new" USING ("type"::text::"TaskType_new");
ALTER TYPE "TaskType" RENAME TO "TaskType_old";
ALTER TYPE "TaskType_new" RENAME TO "TaskType";
DROP TYPE "public"."TaskType_old";
COMMIT;

-- DropIndex
DROP INDEX "tasks_due_at_idx";

-- DropIndex
DROP INDEX "tasks_status_idx";

-- AlterTable
ALTER TABLE "tasks" DROP COLUMN "note",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "meta" JSONB,
ADD COLUMN     "resolved_at" TIMESTAMP(3),
ADD COLUMN     "source" "TaskSource" NOT NULL,
ALTER COLUMN "type" DROP DEFAULT,
ALTER COLUMN "priority" SET DEFAULT 'MEDIUM';

-- CreateIndex
CREATE INDEX "tasks_status_priority_idx" ON "tasks"("status", "priority");

-- CreateIndex
CREATE INDEX "tasks_patient_id_idx" ON "tasks"("patient_id");

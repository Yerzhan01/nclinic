import { Queue, type Job } from 'bullmq';
import { defaultQueueOptions, createWorker } from '@/config/queue.js'; // Ensure .js extension for imports
import { logger } from '@/common/utils/logger.js';
import { amoCRMService } from '@/integrations/amocrm/amocrm.service.js';
import { prisma } from '@/config/prisma.js';

export const AMO_SYNC_QUEUE_NAME = 'amo-sync';

export interface AmoSyncJobData {
    patientId: string;
    programName?: string;
}

// Queue definition
export const amoSyncQueue = new Queue<AmoSyncJobData>(AMO_SYNC_QUEUE_NAME, defaultQueueOptions);

// Worker definition
const processor = async (job: Job<AmoSyncJobData>) => {
    const { patientId, programName } = job.data;
    logger.info({ jobId: job.id, patientId }, 'Processing amoCRM sync job');

    try {
        const patient = await prisma.patient.findUnique({
            where: { id: patientId }
        });

        if (!patient) {
            logger.warn({ patientId }, 'Patient not found during amoCRM sync');
            return;
        }

        if (patient.amoLeadId) {
            logger.info({ patientId }, 'Patient already has amoLeadId, skipping creation');
            // Optimally, we could update the lead here if needed
            return;
        }

        const leadId = await amoCRMService.createLead(patient, programName);

        if (leadId) {
            await prisma.patient.update({
                where: { id: patientId },
                data: { amoLeadId: leadId }
            });
            logger.info({ patientId, leadId }, 'Successfully synced patient to amoCRM');
        } else {
            throw new Error('Failed to create lead in amoCRM');
        }
    } catch (error) {
        logger.error({ error, jobId: job.id, patientId }, 'Error processing amoCRM sync job');
        throw error; // Rethrow to trigger BullMQ retry
    }
};

export const amoSyncWorker = createWorker(AMO_SYNC_QUEUE_NAME, processor);

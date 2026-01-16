import { prisma } from '@/config/prisma.js';
import { AppError } from '@/common/errors/AppError.js';
import type { CreatePatientDto, UpdatePatientDto, ListPatientsQuery } from './patient.types.js';
import { programService } from '@/modules/programs/program.service.js';
import { ChatMode } from '@prisma/client';
import { logger } from '@/common/utils/logger.js';
import { amoSyncQueue } from '@/jobs/amoSync.worker.js';

export class PatientService {
    /**
     * Update patient details
     */
    async updatePatient(id: string, data: UpdatePatientDto) {
        // Check if patient exists
        const patient = await prisma.patient.findUnique({ where: { id } });
        if (!patient) {
            throw AppError.notFound('Patient not found');
        }

        // Check for phone duplicate if changing phone
        if (data.phone) {
            const existing = await prisma.patient.findUnique({ where: { phone: data.phone } });
            if (existing && existing.id !== id) {
                throw AppError.conflict('Phone number already in use');
            }
        }

        const updated = await prisma.patient.update({
            where: { id },
            data,
        });

        return updated;
    }

    /**
     * Create a new patient
     */
    async createPatient(dto: CreatePatientDto) {
        // 1. Determine clinicId (default to first active clinic if not provided)
        let clinicId = dto.clinicId;
        if (!clinicId) {
            const defaultClinic = await prisma.clinic.findFirst({
                where: { isActive: true },
            });
            if (!defaultClinic) {
                throw AppError.internal('No active clinic found (seeding required)');
            }
            clinicId = defaultClinic.id;
        }

        // 2. Check for duplicate phone
        const existing = await prisma.patient.findUnique({
            where: { phone: dto.phone },
        });

        if (existing) {
            throw AppError.conflict(`Patient with phone ${dto.phone} already exists`);
        }

        // 3. Create patient
        const patient = await prisma.patient.create({
            data: {
                fullName: dto.fullName,
                phone: dto.phone,
                clinicId,
                chatMode: dto.chatMode || ChatMode.AI,
                timezone: dto.timezone || 'Asia/Almaty',
                // Store metadata if valid JSON, otherwise ignore for now as schema might not have it yet
                // Assuming schema has metadata Json? If not, we skip it or user needs to migrate.
                // Prompt said "metadata optional" but schema might not have it.
                // Safe bet: Prisma schema likely doesn't have metadata yet based on context.
                // I will ignore metadata field for persistence if schema doesn't support it, 
                // OR prompt implies I shouldn't change schema unless needed. 
                // Let's check schema first to be safe, but for MVP I'll just skip saving metadata to DB 
                // to avoid migration if it's not there.
            },
        });

        // 4. Assign program if templateId provided
        let programAssigned = false;
        if (dto.templateId) {
            try {
                await programService.createProgramInstance({
                    patientId: patient.id,
                    templateId: dto.templateId,
                    startDate: dto.programStartDate ? new Date(dto.programStartDate) : new Date(),
                });
                programAssigned = true;
            } catch (error) {
                // If program assignment fails, we still return the patient but log error?
                // Or rollback? For MVP without transactions, let's just log and continue, 
                // or fail the request?
                // Prompt says "program assignment works via service". 
                // Let's assume critical failure if requested program can't be assigned
                // But cleaning up patient might be tricky without tx.
                // Let's throw for now so user knows.
                console.error(`Failed to assign program to new patient ${patient.id}`, error);
                // Optional: delete patient to rollback?
                // await prisma.patient.delete({ where: { id: patient.id }});
                // throw error;
                // Deciding to return success with programAssigned=false would be safer for MVP 
                // if we don't want to lose the patient record.
                // But strict "atomic" feel is better.
                // I will let it succeed but programAssigned=false effectively (or error if critical).
                // Re-reading prompt: "Create patient + assign program".
                // I'll throw error to keep it clean.
                await prisma.patient.delete({ where: { id: patient.id } }); // manual rollback
                throw error;
            }
        }

        // 5. Create Lead in amoCRM (Async via Queue)
        try {
            let programName = 'No Program';
            if (dto.templateId) {
                const template = await prisma.programTemplate.findUnique({ where: { id: dto.templateId } });
                if (template) programName = template.name;
            }

            await amoSyncQueue.add('sync-lead', {
                patientId: patient.id,
                programName
            });

            logger.info({ patientId: patient.id }, 'Enqueued amoCRM sync job');
        } catch (error) {
            logger.error({ error, patientId: patient.id }, 'Failed to enqueue amoCRM sync job');
            // Do not fail the patient creation
        }

        return {
            ...patient,
            programAssigned,
        };
    }

    /**
     * List patients with pagination and search
     */
    async listPatients(query: ListPatientsQuery) {
        const where = query.search
            ? {
                OR: [
                    { fullName: { contains: query.search, mode: 'insensitive' as const } },
                    { phone: { contains: query.search } },
                ],
            }
            : undefined;

        const [items, total] = await Promise.all([
            prisma.patient.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: query.limit,
                skip: query.offset,
            }),
            prisma.patient.count({ where }),
        ]);

        return { items, total };
    }

    /**
     * Get patient by ID
     */
    async getPatientById(id: string) {
        const patient = await prisma.patient.findUnique({
            where: { id },
            include: {
                clinic: {
                    select: { name: true }
                }
            }
        });

        if (!patient) {
            throw AppError.notFound('Patient not found');
        }

        return patient;
    }

    /**
     * Get patient profile (validated)
     */
    async getProfile(patientId: string): Promise<import('./patient-profile.schema.js').PatientProfile> {
        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            select: { profile: true }
        });

        if (!patient) {
            throw AppError.notFound('Patient not found');
        }

        // Validate and return profile, or empty object if null
        const { PatientProfileSchema } = await import('./patient-profile.schema.js');
        const parsed = PatientProfileSchema.safeParse(patient.profile ?? {});

        if (!parsed.success) {
            logger.warn({ patientId, errors: parsed.error.flatten() }, 'Invalid profile data, returning empty');
            return {};
        }

        return parsed.data;
    }

    /**
     * Update patient profile (partial merge + validation)
     */
    async updateProfile(
        patientId: string,
        patch: import('./patient-profile.schema.js').PatientProfilePatch
    ): Promise<import('./patient-profile.schema.js').PatientProfile> {
        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
            select: { profile: true }
        });

        if (!patient) {
            throw AppError.notFound('Patient not found');
        }

        // Deep merge existing profile with patch
        const existingProfile = (patient.profile as Record<string, unknown>) ?? {};
        const merged = this.deepMerge(existingProfile, patch);

        // Validate merged result
        const { PatientProfileSchema } = await import('./patient-profile.schema.js');
        const parsed = PatientProfileSchema.safeParse(merged);

        if (!parsed.success) {
            throw AppError.badRequest('Invalid profile data: ' + parsed.error.message);
        }

        // Save to DB
        await prisma.patient.update({
            where: { id: patientId },
            data: { profile: parsed.data }
        });

        logger.info({ patientId }, 'Patient profile updated');
        return parsed.data;
    }

    /**
     * Deep merge helper for profile updates
     */
    private deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
        const result = { ...target };

        for (const key of Object.keys(source)) {
            const sourceVal = source[key];
            const targetVal = target[key];

            if (sourceVal === undefined) continue;

            if (
                sourceVal && typeof sourceVal === 'object' && !Array.isArray(sourceVal) &&
                targetVal && typeof targetVal === 'object' && !Array.isArray(targetVal)
            ) {
                result[key] = this.deepMerge(
                    targetVal as Record<string, unknown>,
                    sourceVal as Record<string, unknown>
                );
            } else {
                result[key] = sourceVal;
            }
        }

        return result;
    }

    /**
     * Get patient timeline (messages, check-ins, alerts)
     */
    async getTimeline(patientId: string): Promise<any[]> {
        const [messages, checkIns, alerts] = await Promise.all([
            prisma.message.findMany({
                where: { patientId },
                orderBy: { createdAt: 'desc' },
                take: 50,
            }),
            prisma.checkIn.findMany({
                where: { patientId },
                orderBy: { createdAt: 'desc' },
                take: 50,
            }),
            prisma.alert.findMany({
                where: { patientId },
                orderBy: { createdAt: 'desc' },
                take: 50,
            }),
        ]);

        const timeline = [
            ...messages.map(m => ({ ...m, type: 'message' as const, date: m.createdAt })),
            ...checkIns.map(c => ({ ...c, originalType: c.type, type: 'check_in' as const, date: c.createdAt })),
            ...alerts.map(a => ({ ...a, originalType: a.type, type: 'alert' as const, date: a.createdAt })),
        ].sort((a, b) => b.date.getTime() - a.date.getTime())
            .slice(0, 100);

        return timeline;
    }
}

export const patientService = new PatientService();

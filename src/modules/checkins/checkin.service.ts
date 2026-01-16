import { prisma } from '@/config/prisma.js';
import type { CreateCheckInDto } from './checkin.schema.js';
import { aiService } from '@/integrations/ai/ai.service.js';
import { logger } from '@/common/utils/logger.js';

import type { Prisma } from '@prisma/client';

export class CheckInService {
    async create(patientId: string, dto: CreateCheckInDto) {
        const checkIn = await prisma.checkIn.create({
            data: {
                patientId,
                type: dto.type,
                valueNumber: dto.valueNumber,
                valueText: dto.valueText,
                valueBool: dto.valueBool,
                media: dto.media as Prisma.InputJsonValue,
                source: 'PATIENT',
            },
        });

        // Best-effort transcription for audio
        if (dto.media && (dto.media as any).type === 'audio') {
            this.tryTranscribe(checkIn, dto.media as any).catch(err => {
                logger.error({ err, checkInId: checkIn.id }, 'Async transcription trigger failed');
            });
        }

        return checkIn;
    }

    private async tryTranscribe(checkIn: any, media: { url: string; type: string }) {
        if (!media.url) return;

        try {
            const transcript = await aiService.transcribeAudio(media.url);
            if (!transcript) return;

            // 1. Create FREE_TEXT check-in with transcript
            await prisma.checkIn.create({
                data: {
                    patientId: checkIn.patientId,
                    type: 'FREE_TEXT',
                    valueText: transcript,
                    source: 'AI',
                    media: { ...media, transcript } as Prisma.InputJsonValue,
                },
            });

            // 2. Update original check-in with transcript metadata
            await prisma.checkIn.update({
                where: { id: checkIn.id },
                data: {
                    media: { ...media, transcript } as Prisma.InputJsonValue
                }
            });

            logger.info({ checkInId: checkIn.id }, 'Audio transcribed successfully');
        } catch (error) {
            logger.error({ error, checkInId: checkIn.id }, 'Transcription process failed');
        }
    }

    async findAll(patientId: string, filters: {
        from?: Date;
        to?: Date;
        type?: string;
        limit?: number
    }) {
        const where: Prisma.CheckInWhereInput = {
            patientId,
            createdAt: {
                gte: filters.from,
                lte: filters.to,
            },
        };

        if (filters.type) {
            where.type = filters.type as any;
        }

        return prisma.checkIn.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: filters.limit ?? 50,
        });
    }

    /**
     * Aggregate check-ins for AI context
     * Returns a structured summary string of recent activity
     */
    async getRecentContext(patientId: string, days = 7): Promise<string> {
        const from = new Date();
        from.setDate(from.getDate() - days);

        const checkins = await prisma.checkIn.findMany({
            where: {
                patientId,
                createdAt: { gte: from },
            },
            orderBy: { createdAt: 'asc' },
        });

        if (checkins.length === 0) return 'Нет данных check-ins за последние 7 дней.';

        // Group by type
        const grouped: Record<string, string[]> = {};

        for (const c of checkins) {
            const date = c.createdAt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
            let val = '';

            switch (c.type) {
                case 'WEIGHT': val = `${c.valueNumber} кг`; break;
                case 'STEPS': val = `${c.valueNumber} шагов`; break;
                case 'MOOD': val = `Настроение: ${c.valueText}`; break;
                case 'DIET_ADHERENCE': val = `Питание: ${c.valueBool ? 'Соблюдал' : 'Нарушил'}`; break;
                case 'SLEEP': val = `Сон: ${c.valueNumber} часов`; break;
                case 'FREE_TEXT': val = `Заметка: ${c.valueText}`; break;
            }

            if (c.media) {
                const m = c.media as any;
                val += ` [${m.type === 'photo' ? 'Фото' : 'Аудио'}]`;
                if (m.transcript) val += ` ("${m.transcript}")`;
            }

            if (!grouped[c.type]) grouped[c.type] = [];
            grouped[c.type].push(`[${date}] ${val}`);
        }

        return Object.entries(grouped)
            .map(([type, items]) => `${type}:\n${items.join('\n')}`)
            .join('\n\n');
    }
}

export const checkInService = new CheckInService();

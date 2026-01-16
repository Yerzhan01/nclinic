
import { FastifyInstance } from 'fastify';
import { prisma } from '@/config/prisma.js';
import { z } from 'zod';
import { engagementService } from '@/modules/engagement/engagement.service.js';

export async function systemApi(app: FastifyInstance) {
    // GET /api/system/daily-summary
    app.get('/daily-summary', async (req, reply) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 1. Silent Patients (>24h silence)
        const silentThreshold = new Date();
        silentThreshold.setHours(silentThreshold.getHours() - 24);

        const activePatients = await prisma.patient.findMany({
            where: {
                programs: { some: { status: 'ACTIVE' } },
                aiPaused: false
            },
            select: {
                id: true,
                fullName: true,
                phone: true,
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        const silentPatients = activePatients.filter(p => {
            const lastMsg = p.messages[0];
            return !lastMsg || lastMsg.createdAt < silentThreshold;
        });

        const silentPatientsMapped = silentPatients.map(p => {
            const lastSeen = p.messages[0]?.createdAt || null;
            return {
                id: p.id,
                name: p.fullName,
                phone: p.phone,
                lastSeen: lastSeen,
                hoursSilent: lastSeen
                    ? Math.floor((Date.now() - lastSeen.getTime()) / (1000 * 60 * 60))
                    : '∞'
            };
        });

        // 2. High Risk Patients (AI Risk Level)
        const riskPatients = await prisma.patient.findMany({
            where: {
                messages: {
                    some: {
                        createdAt: { gte: today },
                        aiRisk: { in: ['HIGH', 'CRITICAL'] }
                    }
                }
            },
            select: { id: true, fullName: true }
        });

        // 3. Compliance Stats (Check-ins today)
        const activePatientsCount = await prisma.patient.count({
            where: { programs: { some: { status: 'ACTIVE' } } }
        });

        const distinctPatientCheckIns = await prisma.checkIn.groupBy({
            by: ['patientId'],
            where: { createdAt: { gte: today } }
        });

        // 4. Tasks Summary
        const openTasks = await prisma.task.groupBy({
            by: ['priority'],
            where: { status: 'OPEN' },
            _count: true
        });

        return {
            silentPatients: silentPatientsMapped,
            riskPatients: riskPatients.map(p => ({ id: p.id, name: p.fullName, reason: 'High Risk Message' })),
            stats: {
                activePatients: activePatientsCount,
                checkedInToday: distinctPatientCheckIns.length,
                complianceRate: activePatientsCount > 0
                    ? Math.round((distinctPatientCheckIns.length / activePatientsCount) * 100)
                    : 0
            },
            tasks: {
                // @ts-ignore - Prisma aggregate typing can be tricky
                high: openTasks.find(t => t.priority === 'HIGH')?._count || 0,
                // @ts-ignore
                medium: openTasks.find(t => t.priority === 'MEDIUM')?._count || 0,
                // @ts-ignore
                low: openTasks.find(t => t.priority === 'LOW')?._count || 0
            }
        };
    });
}

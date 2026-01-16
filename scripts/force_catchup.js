
import { programService } from './dist/modules/programs/program.service.js';
import { prisma } from './dist/config/prisma.js';
import { whatsAppService } from './dist/integrations/whatsapp/whatsapp.service.js';

async function run() {
    console.log('--- FORCE CATCH-UP TRIGGER ---');
    try {
        const patients = await prisma.patient.findMany({
            where: { programs: { some: { status: 'ACTIVE' } } },
            include: { programs: { include: { template: true } } }
        });

        // Current Almaty Time
        const now = new Date(); // Local server time is UTC, we need offset
        // Assuming we are operating in simple offsets for now or just checking "Is it past?"
        // Server Time (UTC) = 08:30 (approx) -> Almaty 13:30.
        // We need to parse activity time (09:00) and compare.

        for (const p of patients) {
            const prog = p.programs.find(pr => pr.status === 'ACTIVE');
            if (!p.phone) continue;

            const currentDay = programService.calculateCurrentDay(prog); // Should be 2
            const template = prog.template;
            const rules = template.rules;

            if (!rules || !rules.schedule) continue;

            const daySched = rules.schedule.find(s => s.day === currentDay);
            if (!daySched) continue;

            // Check check-ins
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const checkins = await prisma.checkIn.findMany({
                where: {
                    patientId: p.id,
                    createdAt: { gte: startOfDay }
                }
            });

            console.log(`Processing ${p.fullName} (Day ${currentDay})...`);

            const timeZoneOffset = 5; // Almaty UTC+5
            const currentHour = new Date().getUTCHours() + timeZoneOffset;
            const currentMinute = new Date().getUTCMinutes();
            const currentTotal = currentHour * 60 + currentMinute;

            for (const activity of daySched.activities) {
                // Check if already done
                if (checkins.find(c => c.type === activity.type)) {
                    console.log(`  - [${activity.time}] ${activity.type} already done.`);
                    continue;
                }

                // Check if time passed
                const [h, m] = activity.time.split(':').map(Number);
                const schedTotal = h * 60 + m;

                if (currentTotal > schedTotal) {
                    console.log(`  - [${activity.time}] ${activity.type} MISSED! Force sending...`);

                    const sent = await whatsAppService.sendMessage(p.phone, activity.question);
                    if (sent.success) {
                        console.log('    ✅ Sent to WhatsApp');
                        // We must create a CheckIn or Task or Log? 
                        // Currently programService creates checkIn only implicitly via answer or just logs logic.
                        // Wait, programService doesn't create CheckIn log in processReminders yet?
                        // "We check if a CheckIn exists... If not, we send."
                        // We rely on the USER ANSWERING to create the CheckIn.
                        // So sending again is fine.
                    } else {
                        console.log('    ❌ Failed to send');
                    }
                } else {
                    console.log(`  - [${activity.time}] ${activity.type} is in future.`);
                }
            }
        }

    } catch (e) {
        console.error('ERROR:', e);
    } finally {
        await prisma.$disconnect();
    }
}

run();


import { programService } from './dist/modules/programs/program.service.js';
import { prisma } from './dist/config/prisma.js';

async function run() {
    console.log('--- VERBOSE MANUAL TRIGGER ---');
    try {
        const patients = await prisma.patient.findMany({
            where: { programs: { some: { status: 'ACTIVE' } } },
            include: { programs: { include: { template: true } } }
        });
        console.log(`Found ${patients.length} active patients.`);

        for (const p of patients) {
            const prog = p.programs.find(pr => pr.status === 'ACTIVE');
            console.log(`Patient ${p.phone} (${p.fullName}): Program Day ${prog.currentDay}, Start ${prog.startDate.toISOString()}`);

            // Calc expected current Day
            const calcDay = programService.calculateCurrentDay(prog);
            console.log(`  Calculated CurrentDay: ${calcDay}`);

            const template = prog.template;
            const rules = template.rules;
            // console.log('  Rules:', JSON.stringify(rules));

            if (!rules || !rules.schedule) {
                console.log('  No schedule in rules');
                continue;
            }

            const daySched = rules.schedule.find(s => s.day === calcDay);
            if (!daySched) {
                console.log(`  No schedule found for Day ${calcDay}`);
                continue;
            }
            console.log(`  Found schedule for Day ${calcDay}: ${daySched.activities.length} activities.`);

            // Check time match manually
            const serverNow = new Date();
            // Mock timezone logic roughly
            // Assuming 'Asia/Almaty' by default if missing
            const tz = p.timezone || 'Asia/Almaty';
            console.log(`  Timezone: ${tz}`);
            // We can't easily reproduce 'toZonedTime' without import, so we rely on processReminders logging.
            // But wait, the standard processReminders returns 0.

            // Let's check existing checkins
            const checkins = await prisma.checkIn.findMany({
                where: {
                    patientId: p.id,
                    createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }
                }
            });
            console.log(`  Checkins today: ${checkins.length} (${checkins.map(c => c.type).join(', ')})`);
        }

        console.log('Running REAL processReminders()...');
        const count = await programService.processReminders();
        console.log(`\nRESULT: Sent ${count} reminders.`);
    } catch (e) {
        console.error('ERROR:', e);
    } finally {
        await prisma.$disconnect();
    }
}

run();

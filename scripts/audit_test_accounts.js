import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function audit() {
    console.log('--- AUDIT START ---\n');

    // Find patients with 'Test' or 'Тест' in name or specific phone numbers if known
    const patients = await prisma.patient.findMany({
        where: {
            OR: [
                { fullName: { contains: 'Тест', mode: 'insensitive' } },
                { fullName: { contains: 'Test', mode: 'insensitive' } },
                { phone: { contains: '77085860000' } } // Assuming this is the main test number based on logs
            ]
        },
        include: {
            programs: {
                where: { status: 'ACTIVE' },
                include: { template: true }
            },
            checkIns: {
                orderBy: { createdAt: 'desc' },
                take: 5
            },
            messages: {
                orderBy: { createdAt: 'desc' },
                take: 10
            },
            tasks: {
                where: { status: { not: 'DONE' } }
            }
        }
    });

    for (const p of patients) {
        console.log(`PATIENT: ${p.fullName} (${p.phone})`);
        console.log(`Timezone: ${p.timezone}`);
        console.log(`ChatMode: ${p.chatMode}`);
        console.log(`AI Paused: ${p.aiPaused}`);

        const prog = p.programs[0];
        if (prog) {
            console.log(`PROGRAM: ${prog.template.name}`);
            console.log(`  Current Day: ${prog.currentDay} / ${prog.template.durationDays}`);
            console.log(`  Start Date: ${prog.startDate.toISOString()}`);
            console.log(`  Status: ${prog.status}`);

            // Calculate what DAY it should be mathematically
            const now = new Date();
            // Simple difference check
            const diff = now.getTime() - new Date(prog.startDate).getTime();
            const daysDiff = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
            console.log(`  Calc Day (Start vs Now): ${daysDiff}`);
            if (daysDiff !== prog.currentDay) {
                console.log(`  ⚠️ MISMATCH: Database says Day ${prog.currentDay}, but Time says Day ${daysDiff}`);
            }
        } else {
            console.log(`PROGRAM: None Active`);
        }

        console.log(`CHECK-INS (Last 5):`);
        if (p.checkIns.length === 0) console.log('  None');
        p.checkIns.forEach(c => {
            console.log(`  [${c.createdAt.toLocaleString()}] ${c.type}: ${c.valueText || c.valueBool} (Src: ${c.source})`);
        });

        console.log(`MESSAGES (Last 10):`);
        if (p.messages.length === 0) console.log('  None');
        // Reverse to show chronological order for readibility
        [...p.messages].reverse().forEach(m => {
            const shortContent = m.content ? m.content.replace(/\n/g, ' ').slice(0, 60) : '[Media]';
            const linkTag = m.linkedCheckInId ? `[Linked -> ${m.linkedCheckInId.slice(-4)}]` : '';
            console.log(`  [${m.createdAt.toLocaleString()}] ${m.sender} -> ${m.direction}: ${shortContent} ${linkTag}`);
        });

        console.log(`OPEN TASKS:`);
        if (p.tasks.length === 0) console.log('  None');
        p.tasks.forEach(t => {
            console.log(`  [${t.priority}] ${t.title} (${t.status}) - Due: ${t.dueAt ? t.dueAt.toLocaleString() : 'N/A'}`);
        });

        console.log('\n------------------------------------------------\n');
    }

    console.log('--- AUDIT END ---');
}

audit()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());


import { prisma } from '../src/config/prisma.js';
import { programService } from '../src/modules/programs/program.service.js';
import { logger } from '../src/common/utils/logger.js';

async function debugReminders() {
    console.log('--- STARTING MANUAL REMINDER DEBUG ---');
    try {
        const activePrograms = await prisma.programInstance.findMany({
            where: { status: 'ACTIVE' },
            include: { template: true }
        });

        console.log(`Found ${activePrograms.length} active programs.`);

        const count = await programService.processReminders();
        console.log(`ProcessReminders returned count: ${count}`);

        // Check Pending items manually to see WHY they aren't processed
        const now = new Date();
        const pendingItems = await prisma.scheduleItem.findMany({
            where: {
                status: 'PENDING',
                isTemplate: false,
                program: { status: 'ACTIVE' },
                triggerTime: { lte: now } // Should have been sent
            },
            include: { program: true }
        });

        console.log(`Found ${pendingItems.length} PENDING items that SHOULD have been sent.`);
        if (pendingItems.length > 0) {
            console.log('Sample item:', JSON.stringify(pendingItems[0], null, 2));
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

debugReminders();

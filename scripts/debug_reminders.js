
import 'dotenv/config';
import { programService } from '../dist/modules/programs/program.service.js';
import { prisma } from '../dist/config/prisma.js';

async function main() {
    console.log('--- DEBUG: Manual Reminder Trigger (checking logs) ---');
    try {
        const sent = await programService.processReminders();
        console.log(`--- DEBUG: Process returned ${sent} reminders sent. ---`);
    } catch (e) {
        console.error('--- DEBUG ERROR:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();

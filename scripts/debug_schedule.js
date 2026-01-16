
import 'dotenv/config';
import { scheduleAIAnalysis } from './dist/integrations/ai/ai.queue.js';
import { logger } from './dist/common/utils/logger.js';

async function main() {
    const patientId = 'cmkau2mu70005o30jdrgv4ke1'; // From logs
    console.log(`Attempting to schedule AI analysis for ${patientId}...`);

    try {
        await scheduleAIAnalysis(patientId, 10);
        console.log('Schedule function returned successfully.');
    } catch (err) {
        console.error('Schedule function threw:', err);
    }

    // Wait a bit to ensure async logs flush or job is processed
    await new Promise(r => setTimeout(r, 2000));
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});

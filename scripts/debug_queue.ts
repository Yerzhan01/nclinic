
import 'dotenv/config';
import { aiQueue } from './src/integrations/ai/ai.queue.js';
import { logger } from './src/common/utils/logger.js';

async function main() {
    const patientId = 'cmkau2mu70005o30jdrgv4ke1'; // From logs
    console.log('Adding debugging job to queue...');

    const job = await aiQueue.add('analyze-patient-messages', { patientId }, {
        jobId: `debug-${Date.now()}`,
        removeOnComplete: false
    });

    console.log(`Job added! ID: ${job.id}`);

    // Check count
    const counts = await aiQueue.getJobCounts();
    console.log('Queue counts:', counts);

    process.exit(0);
}

main().catch(console.error);

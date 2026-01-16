
import 'dotenv/config';
import { aiQueue } from './dist/integrations/ai/ai.queue.js';
import { redis } from './dist/config/redis.js';

async function main() {
    console.log('Adding debugging job + buffer (JS mode)...');

    // Use the patientId from logs
    const patientId = 'cmkau2mu70005o30jdrgv4ke1';

    // 1. Push to buffer
    await redis.rpush(`patient:${patientId}:buffer`, "Привет, как дела? (DEBUG MSG)");
    console.log('Buffer filled.');

    // 2. Schedule job
    const job = await aiQueue.add('analyze-patient-messages', { patientId }, {
        jobId: `debug-${Date.now()}`,
        removeOnComplete: false
    });

    console.log(`Job added! ID: ${job.id}`);

    const counts = await aiQueue.getJobCounts();
    console.log('Queue counts:', counts);

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});


import 'dotenv/config';
import { whatsAppService } from './dist/integrations/whatsapp/whatsapp.service.js';
import { logger } from './dist/common/utils/logger.js';

async function main() {
    const phone = '77713877225'; // Extracted from previous log message
    console.log(`Sending debug message to ${phone}...`);

    try {
        const result = await whatsAppService.sendMessage(phone, 'Тестовое сообщение от AI-ассистента (проверка связи)');
        console.log('Result:', result);
    } catch (err) {
        console.error('WhatsApp send failed:', err);
    }

    process.exit(0);
}

main().catch(console.error);

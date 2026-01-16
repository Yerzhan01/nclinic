
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function run() {
    console.log('Fetching WhatsApp settings...');
    const settings = await prisma.integrationSettings.findUnique({ where: { type: 'whatsapp' } });

    if (!settings) {
        console.error('❌ No WhatsApp settings found in DB');
        return;
    }

    const config = settings.config;
    const setSettingsUrl = `${config.apiUrl}/waInstance${config.idInstance}/SetSettings/${config.apiTokenInstance}`;
    // Read URL from command line args or use default (for local testing)
    const argUrl = process.argv[2];
    const webhookUrl = argUrl || 'https://some-turkeys-stand.loca.lt/api/v1/integrations/whatsapp/webhook';

    if (!webhookUrl.startsWith('http')) {
        console.error('❌ Error: Webhook URL must start with http or https');
        console.log('Usage: node setup_webhook.js <YOUR_WEBHOOK_URL>');
        return;
    }

    console.log(`📡 Updating Webhook to: ${webhookUrl}`);

    try {
        const res = await fetch(setSettingsUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                webhookUrl: webhookUrl,
                incomingWebhook: 'yes',
                outgoingWebhook: 'yes',
                deviceWebhook: 'no'
            })
        });

        const data = await res.json();
        console.log('✅ Green API Response:', JSON.stringify(data, null, 2));

        if (data.saveSettings) {
            console.log('🎉 Webhook successfully configured!');
        } else {
            console.warn('⚠️ Warning: Green API might not have applied settings.');
        }
    } catch (err) {
        console.error('❌ Failed to update Green API:', err);
    }
}

run()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());

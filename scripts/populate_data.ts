
import 'dotenv/config';
import { prisma } from './dist/config/prisma.js';
import { logger } from './dist/common/utils/logger.js';
import { CheckInType, DayTime } from '@prisma/client';

async function main() {
    console.log('🚀 Starting Data Population...');

    // 1. Create/Update Rich Program Template
    // "Program 42" - let's make it the "Full Body Transformation"
    const rules = {
        daily: [
            {
                time: "08:00",
                slot: "MORNING",
                type: "WEIGHT",
                question: "Доброе утро! ☀️ Встаем на весы. Какой вес сегодня?",
                required: true
            },
            {
                time: "09:00",
                slot: "MORNING",
                type: "TEXT",
                question: "Как спалось? Оцени сон от 1 до 10 и напиши, как самочувствие.",
                required: false
            },
            {
                time: "14:00",
                slot: "AFTERNOON",
                type: "PHOTO",
                question: "Время обеда! 🥗 Пришли фото своей еды.",
                required: true
            },
            {
                time: "20:00",
                slot: "EVENING",
                type: "STEPS",
                question: "Вечерний отчет! 🏃‍♂️ Сколько шагов за день?",
                required: true
            },
            {
                time: "21:00",
                slot: "EVENING",
                type: "TEXT",
                question: "Как прошел день? Был ли срывы по питанию?",
                required: false
            }
        ]
    };

    const template = await prisma.programTemplate.upsert({
        where: { id: 'template-42' }, // Fixed ID for easier reference
        update: {
            name: "Максимальная Трансформация (Тест)",
            description: "Полный цикл: 3 проверки в день (Утро, День, Вечер).",
            durationDays: 42,
            rules: rules,
            isActive: true
        },
        create: {
            id: 'template-42',
            name: "Максимальная Трансформация (Тест)",
            description: "Полный цикл: 3 проверки в день (Утро, День, Вечер).",
            durationDays: 42,
            rules: rules,
            isActive: true
        }
    });

    console.log(`✅ Template '${template.name}' ready (ID: ${template.id})`);

    // 2. Find/Update Patient Yerzhan
    // Trying to find by name or creating
    let patient = await prisma.patient.findFirst({
        where: { fullName: { contains: 'Ержан', mode: 'insensitive' } }
    });

    if (!patient) {
        console.log('⚠️ Patient Yerzhan not found, creating placeholder...');
        // Need phone number, defaulting to user's number from logs if possible or a dummy
        // I'll search for the phone 77713877225 used in logs, maybe that's him?
        patient = await prisma.patient.findUnique({
            where: { phone: '+77713877225' }
        });
    }

    if (!patient) {
        console.error('❌ Could not find patient Yerzhan or +77713877225. Please create him manually first or provide phone.');
        process.exit(1);
    }

    console.log(`👤 Found Patient: ${patient.fullName} (${patient.phone})`);

    // 3. Update Profile
    await prisma.patient.update({
        where: { id: patient.id },
        data: {
            // Profile JSON
            profile: {
                age: 35,
                gender: "male",
                height: 178,
                weight: 85,
                targetWeight: 75,
                activityLevel: "sedentary", // sedentary, moderate, active
                dietaryPreferences: ["no_sugar", "less_carbs"],
                medicalConditions: ["none"],
                primaryGoal: "lose_weight",
                onboardingCompleted: true
            },
            // Timezone
            timezone: "Asia/Almaty",
            // Program Assignment
            programTemplateId: template.id,
            programStartDate: new Date(), // Starts TODAY so tomorrow is Day 2 (or Day 1 depending on logic)
            status: "ACTIVE",
            chatMode: "AI",
            aiPaused: false
        }
    });

    console.log('✅ Patient profile updated fully.');
    console.log('✅ Program assigned via DB.');
    console.log('📅 Start Date set to NOW (Asia/Almaty). Verification active from tomorrow.');

    process.exit(0);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});

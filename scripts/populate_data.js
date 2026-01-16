
import 'dotenv/config';
import { prisma } from '../dist/config/prisma.js';
import { amoSyncQueue } from '../dist/jobs/amoSync.worker.js';

const TEST_PATIENTS = [
    {
        fullName: 'Ержан (Тест)',
        phone: '+77713877225',
        profile: {
            heightCm: 178,
            weightKg: 85,
            targetWeightKg: 75,
            notes: "Пациент мотивирован. Начало курса."
        }
    },
    {
        fullName: 'Темірғали (Тест)',
        phone: '+77074794042',
        profile: {
            heightCm: 175,
            weightKg: 85,
            targetWeightKg: 80,
            notes: "Активный спортсмен, требуется корректировка питания."
        }
    },
    {
        fullName: 'Оспан (Тест)',
        phone: '+77078281019',
        profile: {
            heightCm: 180,
            weightKg: 95,
            targetWeightKg: 85,
            notes: "Есть жалобы на давление."
        }
    }
];

async function main() {
    console.log('🚀 Starting Data Population (Multi-Patient + Amo Sync)...');

    // Define Daily Activities Template
    const dailyActivities = [
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
            type: "SLEEP",
            question: "Как спалось? Оцени сон от 1 до 10 и напиши, как самочувствие.",
            required: false
        },
        {
            time: "14:00",
            slot: "AFTERNOON",
            type: "DIET_ADHERENCE",
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
            type: "FREE_TEXT",
            question: "Как прошел день? Был ли срывы по питанию?",
            required: false
        }
    ];

    // Generate explicit schedule for 42 days
    const schedule = [];
    for (let day = 1; day <= 42; day++) {
        schedule.push({
            day: day,
            activities: dailyActivities
        });
    }

    const rules = { schedule: schedule };

    // 1. Create/Update Program Template
    const template = await prisma.programTemplate.upsert({
        where: { id: 'template-42' },
        update: {
            name: "Максимальная Трансформация (Тест)",
            durationDays: 42,
            rules: rules,
            isActive: true
        },
        create: {
            id: 'template-42',
            name: "Максимальная Трансформация (Тест)",
            durationDays: 42,
            rules: rules,
            isActive: true
        }
    });

    console.log(`✅ Template '${template.name}' ready (ID: ${template.id})`);

    // 2. Iterate Patients
    for (const p of TEST_PATIENTS) {
        console.log(`👤 Processing ${p.fullName}...`);

        // Clean phone (just in case, though provided input is clean)
        let patient = await prisma.patient.findUnique({
            where: { phone: p.phone }
        });

        if (!patient) {
            patient = await prisma.patient.create({
                data: {
                    phone: p.phone,
                    fullName: p.fullName,
                    chatMode: 'AI',
                    timezone: 'Asia/Almaty'
                }
            });
            console.log(`   ✨ Created new patient.`);
        } else {
            // Update name just in case
            patient = await prisma.patient.update({
                where: { id: patient.id },
                data: { fullName: p.fullName }
            });
            console.log(`   🔄 Found existing patient.`);
        }

        // 3. Update Profile
        const profileData = {
            heightCm: p.profile.heightCm,
            weightKg: p.profile.weightKg,
            targetWeightKg: p.profile.targetWeightKg,
            activityLevel: "medium", // Valid enum: low, medium, high
            goals: ["Похудеть", "Здоровье"],
            diagnoses: [],
            allergies: [],
            medications: [],
            nutritionPlan: {
                kcalTarget: 2000,
                proteinG: 150,
                fatG: 70,
                carbsG: 180,
                preferences: [],
                restrictions: [],
                notes: p.profile.notes
            },
            program: {
                templateId: template.id,
                name: template.name
            },
            notes: p.profile.notes
        };

        await prisma.patient.update({
            where: { id: patient.id },
            data: {
                profile: profileData,
                timezone: "Asia/Almaty",
                chatMode: "AI",
                aiPaused: false
            }
        });

        // 4. Update/Create Program Instance
        const activeProgram = await prisma.programInstance.findFirst({
            where: { patientId: patient.id, status: 'ACTIVE' }
        });

        if (activeProgram) {
            await prisma.programInstance.update({
                where: { id: activeProgram.id },
                data: {
                    templateId: template.id,
                    startDate: new Date(),
                    currentDay: 1
                }
            });
            console.log(`   📅 Updated active program.`);
        } else {
            await prisma.programInstance.create({
                data: {
                    patientId: patient.id,
                    templateId: template.id,
                    startDate: new Date(),
                    endDate: new Date(Date.now() + 42 * 24 * 60 * 60 * 1000),
                    status: 'ACTIVE',
                    currentDay: 1
                }
            });
            console.log(`   📅 Assigned new program.`);
        }

        // 5. Sync to AmoCRM
        try {
            await amoSyncQueue.add('sync-lead', {
                patientId: patient.id,
                programName: template.name
            });
            console.log(`   ☁️ Enqueued AmoCRM sync.`);
        } catch (err) {
            console.error(`   ❌ Failed to enqueue sync: ${err.message}`);
        }
    }

    // Close Queue
    await amoSyncQueue.close();
    console.log('✅ All test patients processed and sync jobs enqueued.');
    process.exit(0);
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});

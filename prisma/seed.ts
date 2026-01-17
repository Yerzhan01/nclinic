import { PrismaClient, UserRole } from '@prisma/client';
import type { ProgramTemplateRules } from '@/modules/programs/program.types.js';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting seed...');

    // 1. Create Admin Users
    const admins = [
        { email: 'admin@nclinic.kz', password: 'admin123', fullName: 'System Administrator' },
        { email: 'doctor1@nclinic.kz', password: 'doctor1pass', fullName: 'Doctor One' },
        { email: 'doctor2@nclinic.kz', password: 'doctor2pass', fullName: 'Doctor Two' },
        { email: 'manager@nclinic.kz', password: 'manager123', fullName: 'Clinic Manager' },
        { email: 'nurse@nclinic.kz', password: 'nurse123', fullName: 'Head Nurse' },
    ];

    for (const admin of admins) {
        const existing = await prisma.user.findUnique({ where: { email: admin.email } });
        if (!existing) {
            const passwordHash = await bcrypt.hash(admin.password, 10);
            await prisma.user.create({
                data: {
                    email: admin.email,
                    passwordHash,
                    fullName: admin.fullName,
                    role: UserRole.ADMIN,
                },
            });
            console.log(`✅ Admin created: ${admin.email} / ${admin.password}`);
        }
    }
    console.log('✅ All admin users processed');

    // 2. Create Default Clinic
    const clinicName = 'Main Clinic';
    const existingClinic = await prisma.clinic.findFirst({ where: { name: clinicName } });
    let clinicId = existingClinic?.id;

    if (!existingClinic) {
        const clinic = await prisma.clinic.create({
            data: {
                name: clinicName,
                isActive: true
            }
        });
        clinicId = clinic.id;
        console.log('✅ Default Clinic created');
    }

    // 3. Create Default Program Template with Dynamic Rules
    const templateName = 'Default Weight Loss Program';
    const existingTemplate = await prisma.programTemplate.findFirst({
        where: { name: templateName }
    });

    // Define the dynamic schedule rules - FULL 42 DAY PROGRAM

    // Helper to generate daily schedule
    const generateDaySchedule = (day: number): { day: number; activities: any[] } => {
        const isWeeklyCheck = [7, 14, 21, 28, 35, 42].includes(day);
        const isFirstDay = day === 1;

        const activities: any[] = [];

        // MORNING: Weight + Greeting (every day)
        if (isFirstDay) {
            activities.push({
                slot: 'MORNING',
                time: '09:00',
                type: 'WEIGHT',
                question: 'Доброе утро! 🌱 Начинаем нашу программу. Пожалуйста, взвесьтесь и отправьте ваш текущий вес (в кг). С сегодняшнего дня фотографируйте всё, что вы едите и пьёте ☺️',
                required: true
            });
        } else if (isWeeklyCheck) {
            activities.push({
                slot: 'MORNING',
                time: '09:00',
                type: 'WEIGHT',
                question: `Доброе утро! 🌟 Прошла ${day / 7}-я неделя! Пожалуйста, отправьте ваш контрольный вес. Давайте подведём итоги недели.`,
                required: true
            });
        } else {
            activities.push({
                slot: 'MORNING',
                time: '09:00',
                type: 'FREE_TEXT',
                question: 'Доброе утро, хорошего дня! 🌱 Напоминаю о фото рациона и дневной активности 😉',
                required: false
            });
        }

        // AFTERNOON: Food photo reminder (every day except weekly check days)
        if (!isWeeklyCheck) {
            activities.push({
                slot: 'AFTERNOON',
                time: '13:00',
                type: 'FREE_TEXT',
                question: 'Как проходит день? Не забудьте сфотографировать обед 📸',
                required: false
            });
        }

        // EVENING: Steps + mood check (every day)
        activities.push({
            slot: 'EVENING',
            time: '20:00',
            type: 'STEPS',
            question: '👣 Как сегодня с активностью? Сколько шагов удалось сделать? Минимум 6000 шагов помогает снизить сахар.',
            required: day % 2 === 0 // Required on even days
        });

        // Weekly summary prompt
        if (isWeeklyCheck) {
            activities.push({
                slot: 'EVENING',
                time: '21:00',
                type: 'MOOD',
                question: `🎯 Неделя ${day / 7} позади! Как вы себя чувствуете? Что было сложнее всего? Что получилось лучше всего?`,
                required: true
            });
        }

        return { day, activities };
    };

    // Generate full 42-day schedule
    const programRules: ProgramTemplateRules = {
        schedule: Array.from({ length: 42 }, (_, i) => generateDaySchedule(i + 1))
    };

    if (!existingTemplate) {
        await prisma.programTemplate.create({
            data: {
                name: templateName,
                durationDays: 42,
                slotsPerDay: ['MORNING', 'AFTERNOON', 'EVENING'],
                isActive: true,
                rules: programRules as any // Store as JSON
            }
        });
        console.log('✅ Default Program Template created');
    } else {
        // Update existing template rules
        await prisma.programTemplate.update({
            where: { id: existingTemplate.id },
            data: {
                rules: programRules as any
            }
        });
        console.log('✅ Default Program Template updated with new rules');
    }

    // 4. Create Patient Ержан - fetching template first to link in profile
    const template = await prisma.programTemplate.findFirst({ where: { name: templateName } });
    const yerzhanPhone = '77713877225';
    const existingYerzhan = await prisma.patient.findUnique({ where: { phone: yerzhanPhone } });

    let yerzhanId = existingYerzhan?.id;
    if (!existingYerzhan) {
        const yerzhan = await prisma.patient.create({
            data: {
                fullName: 'Ержан',
                phone: yerzhanPhone,
                timezone: 'Asia/Almaty',
                clinicId: clinicId,
                profile: {
                    heightCm: 178,
                    weightKg: 85.5,
                    targetWeightKg: 75.0,
                    activityLevel: 'medium',
                    goals: ['Снижение веса', 'Контроль питания'],
                    diagnoses: ['Инсулинорезистентность'],
                    allergies: [],
                    program: template ? {
                        templateId: template.id,
                        name: template.name
                    } : undefined,
                    nutritionPlan: {
                        kcalTarget: 1800,
                        proteinG: 140,
                        fatG: 70,
                        carbsG: 150,
                        preferences: ['Мясо', 'Овощи', 'Рыба'],
                        restrictions: ['Сахар', 'Выпечка'],
                        notes: 'Предпочитает краткие сообщения, мотивационный стиль общения'
                    }
                }
            }
        });
        yerzhanId = yerzhan.id;
        console.log('✅ Patient Ержан created');

        // Assign program to Ержан
        if (template) {
            const startDate = new Date();
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + template.durationDays);

            // Check if already assigned
            const existingProgram = await prisma.programInstance.findFirst({
                where: { patientId: yerzhanId, status: 'ACTIVE' }
            });

            if (!existingProgram) {
                await prisma.programInstance.create({
                    data: {
                        patientId: yerzhanId,
                        templateId: template.id,
                        startDate: startDate,
                        endDate: endDate,
                        currentDay: 1,
                        status: 'ACTIVE'
                    }
                });
                console.log('✅ Program assigned to Ержан');
            }
        }
    } else {
        // Update profile for existing patient to ensure UI fields are populated
        await prisma.patient.update({
            where: { id: existingYerzhan.id },
            data: {
                profile: {
                    heightCm: 178,
                    weightKg: 85.5,
                    targetWeightKg: 75.0,
                    activityLevel: 'medium',
                    goals: ['Снижение веса', 'Контроль питания'],
                    diagnoses: ['Инсулинорезистентность'],
                    allergies: [],
                    program: template ? {
                        templateId: template.id,
                        name: template.name
                    } : undefined,
                    nutritionPlan: {
                        kcalTarget: 1800,
                        proteinG: 140,
                        fatG: 70,
                        carbsG: 150,
                        preferences: ['Мясо', 'Овощи', 'Рыба'],
                        restrictions: ['Сахар', 'Выпечка'],
                        notes: 'Предпочитает краткие сообщения, мотивационный стиль общения'
                    }
                }
            }
        });
        console.log('✅ Patient Ержан profile updated with correct UI fields');
    }

    // 5. Create AI Integration Settings
    const existingAISettings = await prisma.integrationSettings.findUnique({
        where: { type: 'ai' }
    });

    const aiPrompt = `Ты — виртуальный ассистент врача-диетолога в клинике N-Clinic. Твоя задача — сопровождать пациентов во время программы снижения веса.

## Твоя роль:
- Ты помощник врача, НЕ сам врач
- Ты дружелюбный, поддерживающий, но профессиональный
- Ты общаешься на "ты" с пациентами
- Используешь эмодзи умеренно (1-2 на сообщение)

## Твои задачи:
1. **Напоминать о чекинах** — утренний вес, фото еды, шаги
2. **Анализировать рацион** — когда пациент присылает фото еды, давай краткий комментарий
3. **Мотивировать** — хвали за успехи, поддерживай при срывах
4. **Отвечать на вопросы** — о питании, активности, программе

## Правила ответов:
- Отвечай КРАТКО (2-4 предложения максимум)
- Если пациент прислал вес — похвали или поддержи, напомни цель
- Если пациент прислал фото еды — кратко прокомментируй (хорошо/можно улучшить)
- Если пациент жалуется — прояви эмпатию, предложи связаться с врачом
- НЕ назначай лекарства и НЕ ставь диагнозы

## Формат ответов:
- Используй короткие абзацы
- Не пиши длинные списки
- Заканчивай вопросом или призывом к действию

## Примеры:
Пациент: "78.5"
Ты: "Отлично! 78.5 кг записал ✅ Ты на правильном пути! Не забудь про 6000 шагов сегодня 👣"

Пациент: "Сорвался вчера на торт"
Ты: "Бывает, не переживай! Главное — не сдаваться. Сегодня новый день 💪 Что планируешь на обед?"`;

    if (!existingAISettings) {
        await prisma.integrationSettings.create({
            data: {
                type: 'ai',
                isEnabled: true,
                config: {
                    model: 'gpt-4o-mini',
                    systemPrompt: aiPrompt,
                    maxTokens: 500,
                    temperature: 0.7
                }
            }
        });
        console.log('✅ AI Integration settings created');
    } else {
        await prisma.integrationSettings.update({
            where: { id: existingAISettings.id },
            data: {
                isEnabled: true,
                config: {
                    model: 'gpt-4o-mini',
                    systemPrompt: aiPrompt,
                    maxTokens: 500,
                    temperature: 0.7
                }
            }
        });
        console.log('✅ AI Integration settings updated');


        console.log('🏁 Seed completed');
    }

    main()
        .catch((e) => {
            console.error(e);
            process.exit(1);
        })
        .finally(async () => {
            await prisma.$disconnect();
        });

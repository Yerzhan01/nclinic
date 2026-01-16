import { PrismaClient, UserRole } from '@prisma/client';
import type { ProgramTemplateRules } from '@/modules/programs/program.types.js';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting seed...');

    // 1. Create Admin User
    const adminEmail = 'admin@nclinic.kz';
    const adminPassword = 'admin123';
    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

    if (!existingAdmin) {
        const passwordHash = await bcrypt.hash(adminPassword, 10);
        await prisma.user.create({
            data: {
                email: adminEmail,
                passwordHash,
                fullName: 'System Administrator',
                role: UserRole.ADMIN,
            },
        });
        console.log('✅ Admin user created (email: admin@nclinic.kz, password: admin123)');
    }

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

    // 3. Create dummy patient for testing
    const demoPhone = '77010000000';
    const existingPatient = await prisma.patient.findUnique({ where: { phone: demoPhone } });

    if (!existingPatient) {
        await prisma.patient.create({
            data: {
                fullName: 'Demo Patient',
                phone: demoPhone,
                timezone: 'Asia/Almaty',
                clinicId: clinicId // Assign to default clinic
            }
        });
        console.log('✅ Demo Patient created');
    }

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

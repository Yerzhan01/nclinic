import { prisma } from '@/config/prisma.js';
import { logger } from '@/common/utils/logger.js';
import { aiABTestService } from './ai.ab-test.service.js';
import { aiSummaryService } from './ai.summary.service.js';
import { ragService } from '@/modules/rag/rag.service.js';
import { buildPatientContext } from '@/common/utils/buildPatientContext.js';
import type { Message } from '@prisma/client';
import type { PatientProfile } from '@/modules/patients/patient-profile.schema.js';

// Default system prompt if no variants configured
const DEFAULT_SYSTEM_PROMPT = `Ты — персональный ИИ-куратор пациента в программе снижения веса клиники NClinic.
Твоя задача — сопровождать пациента так же внимательно и заботливо, как это делает живой куратор.

=== ТВОИ ОБЯЗАННОСТИ ===

1. РАБОТА С ПИТАНИЕМ:
- Анализируй пищевые привычки пациента по его сообщениям
- Мягко корректируй рацион БЕЗ жёстких диет и запретов
- Предлагай замены продуктов на более полезные альтернативы
- Помогай выстроить режим питания
- Подсказывай варианты еды: дома, вне дома, в гостях, в поездках
- Помогай вернуться в режим после срывов БЕЗ чувства вины

2. ФОРМИРОВАНИЕ ПРИВЫЧЕК:
- Помогай постепенно заменять вредные привычки на здоровые
- Обучай осознанному питанию
- Учи отличать: голод от привычки и стресса

3. МОТИВАЦИЯ И ПОДДЕРЖКА:
- Поддерживай пациента регулярно, мотивируй БЕЗ давления
- Помогай не бросить программу при медленном результате, плато, стрессе, срывах
- Напоминай о целях и прогрессе
- Укрепляй веру пациента в себя
- Фокусируйся не только на весе, но и на самочувствии, энергии, качестве жизни

4. КОНТРОЛЬ ПРОЦЕССА:
- Отслеживай динамику веса и самочувствия
- Задавай уточняющие вопросы
- При тревожных сигналах (боль, тошнота, головокружение) — рекомендуй обратиться к врачу
- Напоминай о рекомендациях врачей

5. ОБРАЗОВАНИЕ:
- Объясняй ПРОСТЫМ языком основы питания, БЖУ, роль воды, влияние сна и стресса
- Развенчивай мифы о похудении
- Формируй понимание долгосрочных изменений, а не "быстрый результат любой ценой"

=== ЭКСТРАКЦИЯ ДАННЫХ ===

Автоматически извлекай из сообщений пациента следующие данные и добавляй в поле extractedCheckIns:
- ВЕС: "72 кг", "вешу 71.5" → { type: "WEIGHT", valueNumber: 72 }
- ШАГИ: "прошла 5000 шагов", "сегодня 8к шагов" → { type: "STEPS", valueNumber: 5000 }
- СОН: "спала 7 часов", "легла в 23:00" → { type: "SLEEP", valueNumber: 7 }
- НАСТРОЕНИЕ: "чувствую себя отлично", "устала" → { type: "MOOD", valueText: "..." }
- ЕДА: любое упоминание съеденного → { type: "FOOD_LOG", valueText: "описание" }
- ВОДА: "выпила 2 литра" → { type: "WATER", valueNumber: 2 }

=== ПРАВИЛА БЕЗОПАСНОСТИ ===

❌ Ты НЕ врач — не ставь диагнозы и не назначай лечение
❌ При жалобах на здоровье → ставь handoffRequired: true
❌ Если пациент просит связать с человеком → handoffRequired: true

=== ФОРМАТ ОТВЕТА (JSON) ===

{
    "sentiment": "positive" | "neutral" | "negative",
    "intent": "question" | "complaint" | "checkin" | "urgent" | "chitchat" | "gratitude" | "unknown",
    "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    "summary": "Краткое описание сообщения",
    "shouldReply": true/false,
    "suggestedReply": "Твой тёплый, поддерживающий ответ",
    "handoffRequired": true/false,
    "extractedCheckIns": [
        { "type": "WEIGHT", "valueNumber": 72.5, "confidence": "high" },
        { "type": "STEPS", "valueNumber": 5000, "confidence": "high" }
    ]
}`;

const DEFAULT_STYLE_GUIDE = `=== СТИЛЬ ОБЩЕНИЯ ===

✅ Говори тёпло, заботливо и профессионально
✅ Используй эмодзи умеренно (1-2 на сообщение)
✅ Обращайся на "Вы" (или на "ты" если пациент сам перешёл)
✅ Адаптируй тон к эмоциям пациента
✅ Завершай сообщение вопросом или мягким призывом к действию
✅ Объясни, что "неидеальность — это норма"

❌ НЕ осуждай
❌ НЕ пугай
❌ НЕ дави
❌ НЕ используй жёсткие формулировки
❌ НЕ критикуй за срывы

=== ПРИМЕРЫ ХОРОШИХ ОТВЕТОВ ===

После срыва:
"Это бывает, и это нормально 💙 Главное — не корить себя. Давайте завтра начнём новый день с лёгкого завтрака. Что вы обычно любите на завтрак?"

При плато:
"Понимаю, это может расстраивать. Но плато — это знак, что организм адаптируется. Расскажите, как вы себя чувствуете в целом? Есть ли прилив энергии?"

При хорошем результате:
"Отличная работа! 🎉 Вижу прогресс. Как вам удаётся держать режим? Поделитесь секретом 😊"`;


/**
 * Build time context for personalized responses
 */
function buildTimeContext(): string {
    const now = new Date();
    // Almaty timezone (UTC+5)
    const almatyTime = new Date(now.getTime() + (5 * 60 * 60 * 1000));
    const hour = almatyTime.getUTCHours();

    let timeOfDay: string;
    let greeting: string;

    if (hour >= 5 && hour < 12) {
        timeOfDay = 'утро';
        greeting = 'Доброе утро';
    } else if (hour >= 12 && hour < 18) {
        timeOfDay = 'день';
        greeting = 'Добрый день';
    } else if (hour >= 18 && hour < 22) {
        timeOfDay = 'вечер';
        greeting = 'Добрый вечер';
    } else {
        timeOfDay = 'ночь';
        greeting = 'Доброй ночи';
    }

    const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
    const dayOfWeek = days[almatyTime.getUTCDay()];

    return `Сейчас ${timeOfDay} (${dayOfWeek}). Приветствие: "${greeting}". Учитывай время суток в тоне ответа.`;
}

interface PromptBuildResult {
    prompt: string;
    variantId: string | null;
}

export class AIPromptBuilder {
    /**
     * Build full prompt for AI response generation
     */
    async buildPrompt(patientId: string, recentMessages: Message[]): Promise<PromptBuildResult> {
        // Get patient data with active program
        const patient = await prisma.patient.findUnique({
            where: { id: patientId },
        });

        if (!patient) {
            throw new Error(`Patient not found: ${patientId}`);
        }

        // Get active program separately
        const activeProgram = await prisma.programInstance.findFirst({
            where: {
                patientId,
                status: 'ACTIVE',
            },
            include: { template: true },
        });

        // Select prompt variant (A/B testing)
        const variant = await aiABTestService.selectVariant();
        const systemPrompt = variant?.systemPrompt || DEFAULT_SYSTEM_PROMPT;
        const styleGuide = variant?.styleGuide || DEFAULT_STYLE_GUIDE;

        // Get conversation summary
        const summary = await aiSummaryService.getSummary(patientId);

        // Get RAG context from last user message
        const lastUserMessage = recentMessages.filter(m => m.sender === 'PATIENT').pop();
        const ragContext = lastUserMessage?.content
            ? await ragService.search(lastUserMessage.content, 3)
            : [];

        // Build patient context from profile JSON
        const patientProfile = patient.profile as PatientProfile | null;
        const patientContext = buildPatientContext(patientProfile);

        // Calculate program day
        let programInfo = 'Программа не назначена';
        if (activeProgram) {
            const startDate = activeProgram.startDate;
            const dayNumber = Math.ceil((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            programInfo = `${activeProgram.template.name}, день ${dayNumber} из ${activeProgram.template.durationDays}`;
        }

        // Format recent messages
        const formattedMessages = recentMessages.slice(-10).map(m => {
            const sender = m.sender === 'PATIENT' ? patient.fullName : m.sender;
            const content = m.content || '[медиа]';
            return `[${sender}]: ${content}`;
        }).join('\n');

        // Format RAG context
        const ragContextStr = ragContext.length > 0
            ? ragContext.map(r => `- ${r.content}`).join('\n')
            : 'Релевантной информации не найдено.';

        // Get recent check-ins (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentCheckIns = await prisma.checkIn.findMany({
            where: {
                patientId,
                createdAt: { gte: sevenDaysAgo }
            },
            orderBy: { createdAt: 'desc' },
            take: 20
        });

        // Format check-ins
        const formattedCheckIns = recentCheckIns.length > 0
            ? recentCheckIns.map(c => {
                const date = c.createdAt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
                let val = '';
                if (c.valueNumber !== null) val = String(c.valueNumber);
                if (c.valueText) val = c.valueText;
                if (c.valueBool !== null) val = c.valueBool ? 'Да' : 'Нет';
                return `- ${date}: [${c.type}] ${val}`;
            }).join('\n')
            : 'Нет данных за неделю.';

        // Build final prompt
        const timeContext = buildTimeContext();

        const prompt = `${systemPrompt}

${styleGuide}

=== ВРЕМЯ ===
${timeContext}

=== ПРОФИЛЬ ПАЦИЕНТА ===
Имя: ${patient.fullName}
Программа: ${programInfo}
${patientContext ? patientContext : ''}

=== ПОСЛЕДНИЕ ЧЕК-ИНЫ (7 дней) ===
${formattedCheckIns}

=== ИСТОРИЯ (сжато) ===
${summary || 'Новый диалог, истории нет.'}

=== ПОСЛЕДНИЕ СООБЩЕНИЯ ===
${formattedMessages}

=== БАЗА ЗНАНИЙ (релевантная информация) ===
${ragContextStr}

=== ЗАДАЧА ===
Ответь на последнее сообщение пациента.
Если требуется помощь специалиста или запрос вне твоей компетенции, в конце ответа добавь: [HANDOFF_REQUIRED]`;

        logger.debug({
            patientId,
            variantId: variant?.id,
            hasSummary: !!summary,
            ragContextCount: ragContext.length,
            checkInsCount: recentCheckIns.length,
        }, 'Prompt built');

        return {
            prompt,
            variantId: variant?.id || null,
        };
    }
}

export const aiPromptBuilder = new AIPromptBuilder();

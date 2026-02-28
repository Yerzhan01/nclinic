import { prisma } from '@/config/prisma.js';
import { logger } from '@/common/utils/logger.js';
import { aiABTestService } from './ai.ab-test.service.js';
import { aiSummaryService } from './ai.summary.service.js';
import { aiService } from './ai.service.js';
import { ragService } from '@/modules/rag/rag.service.js';
import { buildPatientContext } from '@/common/utils/buildPatientContext.js';
import type { Message } from '@prisma/client';
import type { PatientProfile } from '@/modules/patients/patient-profile.schema.js';

// Default system prompt if no variants configured
const _DEFAULT_SYSTEM_PROMPT = `Ты — персональный ИИ-куратор пациента в программе снижения веса клиники NClinic.
Твоя задача — сопровождать пациента так же внимательно и заботливо, как это делает живой куратор.

=== ТВОИ ОБЯЗАННОСТИ ===

1. РАБОТА С ПИТАНИЕМ:
- Анализируй пищевые привычки пациента по его сообщениям
- Мягко корректируй рацион БЕЗ жёстких диет и запретов
- Предлагай замены продуктов на более полезные альтернативы
- Помогай выстроить режим питания

2. МОТИВАЦИЯ И ПОДДЕРЖКА:
- Поддерживай пациента регулярно, мотивируй БЕЗ давления
- Укрепляй веру пациента в себя

3. ФОРМАТ ОБЩЕНИЯ (ВАЖНО!):
- ❌ Всегда обращайся на "Вы", пока пациент сам не попросит перейти на "ты".
- ❌ НЕ спрашивай "Как самочувствие?", если ты уже спрашивал это в последних 3 сообщениях.
- ❌ НЕ отвечай молчанием на жалобы. Если есть жалоба → прими её, посочувствуй и скажи, что передашь специалисту.

4. РЕКОМЕНДАЦИИ (ГИБРИДНЫЙ РЕЖИМ):
- Если пациент пишет об успехе или нейтральном событии ("съел суп", "погулял") → ПРОСТО ПОХВАЛИ и подтверди ("Отлично!", "Принято"). Не давай советов, если не просят.
- Если пациент пишет о срыве/проблеме ("съел торт на ночь", "пропустил обед") → ПОДДЕРЖИ и дай МЯГКИЙ КОРОТКИЙ СОВЕТ.
- Если пациент задает вопрос → ОТВЕТЬ и дай рекомендацию.

=== ПРАВИЛА БЕЗОПАСНОСТИ ===

❌ Ты НЕ врач — не ставь диагнозы и не назначай лечение
❌ При жалобах на здоровье → ставь handoffRequired: true, но ОБЯЗАТЕЛЬНО ответь пациенту, что передаешь информацию врачу.
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

const _DEFAULT_STYLE_GUIDE = `=== СТИЛЬ ОБЩЕНИЯ ===

✅ Говори тёпло, заботливо и профессионально
✅ Используй эмодзи умеренно (1-2 на сообщение)
✅ ВСЕГДА обращайся на "Вы" (по умолчанию)
✅ Адаптируй тон к эмоциям пациента
✅ Если пациент сообщил о еде: НЕ спрашивай сразу "Что будете есть дальше?", если это не логично.

❌ НЕ осуждай
❌ НЕ пугай
❌ НЕ дави
❌ НЕ используй жёсткие формулировки
❌ НЕ критикуй за срывы

=== ПРИМЕРЫ ХОРОШИХ ОТВЕТОВ ===

После срыва:
"Ничего страшного, это случается 💙 Главное — не винить себя. Завтра просто вернемся к обычному режиму. Как сейчас настроение?"

При плато:
"Понимаю вас. Плато — это знак, что организм перестраивается. Давайте пока сфокусируемся на самочувствии. Вы чувствуете легкость?"

При хорошем результате (Гибрид - просто хвалим):
"Отличный результат! 🎉 Так держать!"`;


/**
 * Build time context for personalized responses
 */
function buildTimeContext(): string {
    const now = new Date();
    // Almaty timezone (UTC+5)
    const almatyTime = new Date(now.getTime() + (5 * 60 * 60 * 1000));
    const hour = almatyTime.getUTCHours();

    let timeOfDay: string;
    if (hour >= 5 && hour < 12) {
        timeOfDay = 'утро';
    } else if (hour >= 12 && hour < 18) {
        timeOfDay = 'день';
    } else if (hour >= 18 && hour < 22) {
        timeOfDay = 'вечер';
    } else {
        timeOfDay = 'ночь';
    }

    const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
    const dayOfWeek = days[almatyTime.getUTCDay()];

    return `Сейчас ${timeOfDay} (${dayOfWeek}). Учитывай время суток в тоне ответа.`;
}

interface PromptBuildResult {
    prompt: string;
    variantId: string | null;
}

export class AIPromptBuilder {
    /**
     * Build full prompt for AI response generation
     */
    async buildPrompt(patientId: string, recentMessages: Message[]): Promise<PromptBuildResult | null> {
        // Read AI config from DB settings
        const config = await aiService.getConfig();

        // Select prompt variant (A/B testing overrides settings)
        const variant = await aiABTestService.selectVariant();

        // Priority: A/B variant > DB settings > nothing (don't reply)
        const systemPrompt = variant?.systemPrompt
            || config?.agent?.systemPromptBase
            || null;

        if (!systemPrompt) {
            logger.warn({ patientId }, 'No system prompt configured — AI will not reply');
            return null;
        }

        const styleGuide = variant?.styleGuide
            || config?.agent?.styleGuide
            || '';

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
Если требуется помощь специалиста или запрос вне твоей компетенции, в конце ответа добавь: [HANDOFF_REQUIRED]

=== ФОРМАТ ОТВЕТА ===
Ты ОБЯЗАН ответить СТРОГО в формате json. Структура:
{
  "sentiment": "positive" | "neutral" | "negative",
  "intent": "question" | "complaint" | "checkin" | "urgent" | "chitchat" | "gratitude" | "unknown",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "summary": "Краткое описание",
  "shouldReply": true,
  "suggestedReply": "Твой тёплый ответ пациенту",
  "handoffRequired": false,
  "extractedCheckIns": []
}`;

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

// AI Integration Types

// Reply style options
export type ReplyStyle = 'concise' | 'structured' | 'detailed';
export type ReplyFormat = 'bullets' | 'paragraphs';

// Agent settings (editable from Control Center)
export interface AIAgentSettings {
    systemPromptBase?: string;
    styleGuide?: string;
    replyStyle?: ReplyStyle;
    format?: ReplyFormat;
    maxSentences?: number;
    maxOutputTokens?: number;
    handoffTriggers?: string[];
    forbiddenPhrases?: string[];
    commands?: {
        prefix?: string; // default: "#ai"
        pauseKeywords?: string[]; // default: ["off", "pause", "stop"]
        resumeKeywords?: string[]; // default: ["on", "resume", "start"]
        statusKeywords?: string[]; // default: ["status"]
    };
}

// RAG settings
export interface AIRagSettings {
    enabled?: boolean;
    topK?: number;
    maxChars?: number;
}

// Main AI config stored in IntegrationSettings
export interface AIConfig {
    provider?: 'openai';
    apiKey: string;
    model: string;
    temperature?: number;
    agent?: AIAgentSettings;
    rag?: AIRagSettings;
    messageBufferSeconds?: number; // Buffering/Debounce time in seconds (default: 10)
}

// Default agent settings (used when config.agent is undefined)
export const DEFAULT_AGENT_SETTINGS: AIAgentSettings = {
    systemPromptBase: `Ты — профессиональный ассистент клиники NClinic (сервис похудения и здоровья).
Твоя цель — помогать пациентам проходить программу, отвечать на вопросы и поддерживать мотивацию.

Твои обязанности:
1. Анализировать сообщения пациента и контекст.
2. Отвечать на вопросы по программе питания и тренировок (используя RAG).
3. Поддерживать и мотивировать.
4. При жалобах на здоровье или просьбе связать с человеком — переключать на менеджера (handoff).

Правила безопасности:
- Ты НЕ врач. Не ставь диагнозы и не назначай лечение.
- Если пациент жалуется на боли, тошноту, головокружение — рекомендуй обратиться к врачу и ставь handoffRequired=true.

Тон общения:
- Вежливый, эмпатичный, но профессиональный.
- Используй "Вы" или "ты" в зависимости от контекста пациента (по умолчанию "Вы").
- Адаптируй тон в зависимости от эмоций пациента.

ВАЖНО: Ответ ДОЛЖЕН быть в формате JSON:
{
  "sentiment": "positive" | "neutral" | "negative",
  "enhancedSentiment": {
    "overall": "positive" | "neutral" | "negative",
    "emotions": ["anxious", "frustrated", "hopeful", "confused", "calm", "grateful", "discouraged"],
    "intensity": "low" | "medium" | "high"
  },
  "intent": "question" | "complaint" | "checkin" | "urgent" | "chitchat" | "gratitude" | "unknown",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "summary": "Краткое описание сообщения",
  "shouldReply": true/false,
  "suggestedReply": "Твой ответ пациенту",
  "handoffRequired": true/false,
  "checkInSatisfied": true/false
}`,

    styleGuide: `Твой стиль ответа:
- Структурированный текст (абзацы или списки).
- Кратко и по делу (не пиши эссе).
- В конце ответа всегда предлагай или спрашивай что-то, чтобы продолжить диалог (call to action).
- Избегай сложных медицинских терминов.
- Если пациент расстроен или встревожен — посочувствуй и поддержи.`,

    replyStyle: 'structured',
    format: 'bullets',
    maxSentences: 6,
    handoffTriggers: ['врач', 'менеджер', 'человек', 'специалист', 'жалоба', 'боль', 'плохо'],
    forbiddenPhrases: [],
    commands: {
        prefix: '#ai',
        pauseKeywords: ['off', 'pause', 'stop', 'выкл', 'стоп'],
        resumeKeywords: ['on', 'resume', 'start', 'вкл', 'старт'],
        statusKeywords: ['status', 'статус', 'info']
    }
};

// Intent classification types
export type MessageIntent = 'question' | 'complaint' | 'checkin' | 'urgent' | 'chitchat' | 'gratitude' | 'unknown';

// Enhanced sentiment with emotions
export interface EnhancedSentiment {
    overall: 'positive' | 'neutral' | 'negative';
    emotions: ('anxious' | 'frustrated' | 'hopeful' | 'confused' | 'calm' | 'grateful' | 'discouraged')[];
    intensity: 'low' | 'medium' | 'high';
}

// AI analysis result
export interface AIAnalysisResult {
    sentiment: 'positive' | 'neutral' | 'negative';
    enhancedSentiment?: EnhancedSentiment;
    intent?: MessageIntent;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    summary: string;
    shouldReply: boolean;
    suggestedReply?: string;
    promptVariantId?: string | null;
    handoffRequired: boolean;
    checkInSatisfied?: boolean;

    // Auto-extracted check-ins from message content
    extractedCheckIns?: ExtractedCheckIn[];
}

export interface AIConnectionStatus {
    isEnabled: boolean;
    status: 'connected' | 'disconnected' | 'error';
    model?: string;
    error?: string;
}

export interface ConnectAIInput {
    apiKey: string;
    model: string;
    temperature?: number;
}

export interface TestAIInput {
    text: string;
}

// ============================================================================
// Auto Check-in Extraction Types
// ============================================================================

export type ExtractedCheckInType =
    | 'WEIGHT'
    | 'STEPS'
    | 'MOOD'
    | 'DIET_ADHERENCE'
    | 'SLEEP'
    | 'WATER'
    | 'FOOD_LOG'
    | 'EXERCISE'
    | 'FREE_TEXT';

export interface ExtractedCheckIn {
    type: ExtractedCheckInType;
    valueNumber?: number;      // e.g., 72.5 for weight, 5000 for steps
    valueText?: string;        // e.g., "овсянка, салат" for food log
    valueBool?: boolean;       // e.g., true for diet adherence
    confidence: 'high' | 'medium' | 'low';
}

// ============================================================================
// Vision AI Types (Food Photo Analysis)
// ============================================================================

export interface FoodItem {
    name: string;
    portion: string;          // e.g., "1 порция", "200г"
    caloriesEstimate: number; // approximate kcal
}

export interface ImageAnalysisResult {
    imageType: 'food' | 'scale' | 'steps' | 'other';

    // For food photos
    foods?: FoodItem[];
    totalCalories?: number;
    mealAssessment?: 'excellent' | 'good' | 'moderate' | 'needs_improvement';
    suggestion?: string;

    // For scale/steps screenshots
    extractedValue?: number;

    // For other photos
    description?: string;

    // Generated response for patient
    response: string;
}


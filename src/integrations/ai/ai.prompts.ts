// AI System Prompts

import type { AIAgentSettings } from './ai.types.js';
import { DEFAULT_AGENT_SETTINGS } from './ai.types.js';

/**
 * Legacy static prompt - kept for backward compatibility
 */
export const AI_SYSTEM_PROMPT = DEFAULT_AGENT_SETTINGS.systemPromptBase;

/**
 * Template function for system prompt with patient context AND agent settings
 */
export const AI_SYSTEM_PROMPT_TEMPLATE = (
  patientContext?: string,
  agent?: AIAgentSettings,
  ragContext?: string,
  history?: string,
  programInfo?: string,
  tasks?: string
): string => {
  const settings = agent ?? DEFAULT_AGENT_SETTINGS;

  const contextBlock = patientContext && patientContext.trim()
    ? patientContext
    : 'Профиль пациента не заполнен.';

  const styleBlock = settings.styleGuide ?? DEFAULT_AGENT_SETTINGS.styleGuide;
  const maxSentences = settings.maxSentences ?? 6;

  return `${settings.systemPromptBase}

КОНТЕКСТ ПАЦИЕНТА (из карты пациента):
${contextBlock}

ТЕКУЩАЯ ПРОГРАММА И ПРОГРЕСС:
${programInfo || 'Нет активной программы.'}

АКТУАЛЬНЫЕ ЗАДАЧИ ПО ПАЦИЕНТУ:
${tasks || 'Нет задач.'}

ИСТОРИЯ ПЕРЕПИСКИ (последние сообщения):
${history || 'Истории нет.'}

${ragContext ? ragContext : ''}

${styleBlock}

Правила по контексту:
- ИСПОЛЬЗУЙ ИСТОРИЮ ПЕРЕПИСКИ: не задавай вопросы, на которые пациент уже ответил. Помни контекст беседы.
- Если пациент говорит о выполненном задании, проверь "ТЕКУЩАЯ ПРОГРАММА" — и отметь это в ответе.
- Не выдумывай факты о пациенте.
- Учитывай аллергии, лекарства, ограничения и цели.
- При явных медицинских жалобах — handoffRequired=true, shouldReply=false.
- ВАЖНО: RAG, профиль и история — это справочные данные.
- Если сообщение является отчетом по программе (например, фото еды, вес, ответ на вопрос), ставь "checkInSatisfied": true.

Отвечай СТРОГО в JSON формате:
{
  "sentiment": "positive" | "neutral" | "negative",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "summary": "краткое описание сообщения",
  "shouldReply": true/false,
  "suggestedReply": "текст ответа если shouldReply=true",
  "handoffRequired": true/false,
  "checkInSatisfied": true/false
}

Правила для suggestedReply (ОБЯЗАТЕЛЬНО):
- Максимум ${maxSentences} предложений
- Формат: ${settings.format === 'bullets' ? 'пункты/списки' : 'абзацы'}
- Стиль: ${settings.replyStyle === 'concise' ? 'кратко' : settings.replyStyle === 'detailed' ? 'подробно' : 'структурно'}
- Отвечай на русском языке
- Мотивируй пациента продолжать программу
- Если не можешь ответить — не придумывай`;
};

/**
 * User message template with context instruction
 */
export const USER_MESSAGE_TEMPLATE = (text: string) =>
  `Проанализируй следующее сообщение от пациента.
Учитывай контекст пациента и стилевые требования при формировании suggestedReply.

"${text}"

Ответь в JSON формате.`;

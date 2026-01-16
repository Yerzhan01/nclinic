import type { AIAgentSettings } from '@/integrations/ai/ai.types.js';
import { DEFAULT_AGENT_SETTINGS } from '@/integrations/ai/ai.types.js';

export type AICommandAction = 'pause' | 'resume' | 'status' | null;

export interface ParsedAICommand {
    action: AICommandAction;
    raw: string;
}

/**
 * Parse AI command from message text
 * Returns null action if not a valid AI command
 */
export function parseAiCommand(text: string, settings?: AIAgentSettings['commands']): ParsedAICommand {
    const trimmed = text.trim();
    const lowerText = trimmed.toLowerCase();

    // Use defaults if settings not provided
    const prefix = (settings?.prefix ?? DEFAULT_AGENT_SETTINGS.commands?.prefix ?? '#ai').toLowerCase();
    const pauseKeywords = (settings?.pauseKeywords ?? DEFAULT_AGENT_SETTINGS.commands?.pauseKeywords ?? []).map(k => k.toLowerCase());
    const resumeKeywords = (settings?.resumeKeywords ?? DEFAULT_AGENT_SETTINGS.commands?.resumeKeywords ?? []).map(k => k.toLowerCase());
    const statusKeywords = (settings?.statusKeywords ?? DEFAULT_AGENT_SETTINGS.commands?.statusKeywords ?? []).map(k => k.toLowerCase());

    // Check prefix
    if (!lowerText.startsWith(prefix)) {
        return { action: null, raw: text };
    }

    // Extract command part
    const commandPart = lowerText.slice(prefix.length).trim();

    // Pause commands
    if (pauseKeywords.includes(commandPart)) {
        return { action: 'pause', raw: text };
    }

    // Resume commands
    if (resumeKeywords.includes(commandPart)) {
        return { action: 'resume', raw: text };
    }

    // Status command
    if (statusKeywords.includes(commandPart)) {
        return { action: 'status', raw: text };
    }

    // Unknown command
    return { action: null, raw: text };
}

/**
 * Check if text is an AI command
 */
export function isAiCommand(text: string, prefix?: string): boolean {
    const p = (prefix ?? DEFAULT_AGENT_SETTINGS.commands?.prefix ?? '#ai').toLowerCase();
    return text.trim().toLowerCase().startsWith(p);
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// AI Settings Types
export interface AIAgentSettings {
    systemPromptBase?: string;
    styleGuide?: string;
    replyStyle?: 'concise' | 'structured' | 'detailed';
    format?: 'bullets' | 'paragraphs';
    maxSentences?: number;
    maxOutputTokens?: number;
    handoffTriggers?: string[];
    forbiddenPhrases?: string[];
    commands?: {
        prefix?: string;
        pauseKeywords?: string[];
        resumeKeywords?: string[];
        statusKeywords?: string[];
    };
}

export interface AIRagSettings {
    enabled?: boolean;
    topK?: number;
    maxChars?: number;
}

export interface AISettings {
    apiKey?: string;
    model?: string;
    temperature?: number;
    agent?: AIAgentSettings;
    rag?: AIRagSettings;
    messageBufferSeconds?: number;
}

// Fetch AI settings
export function useAISettings() {
    return useQuery({
        queryKey: ['ai-settings'],
        queryFn: async () => {
            const { data } = await api.get<{ data: AISettings }>('/integrations/ai/settings');
            return data.data;
        },
    });
}

// Update AI settings
export function useUpdateAISettings() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (settings: Partial<AISettings>) => {
            const { data } = await api.put<{ data: AISettings }>('/integrations/ai/settings', settings);
            return data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ai-settings'] });
        },
    });
}

// Patient AI Status
export function usePatientAIStatus(patientId: string | undefined) {
    return useQuery({
        queryKey: ['patient-ai-status', patientId],
        queryFn: async () => {
            if (!patientId) return null;
            const { data } = await api.get<{ data: { aiEnabled: boolean; aiPaused: boolean; aiPausedAt?: string; aiPausedBy?: string } }>(
                `/integrations/ai/patients/${patientId}/ai-status`
            );
            return data.data;
        },
        enabled: !!patientId,
    });
}

// Toggle Patient AI
export function useTogglePatientAI() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ patientId, enabled, reason }: { patientId: string; enabled: boolean; reason?: string }) => {
            const { data } = await api.post<{ data: { aiEnabled: boolean } }>(
                `/integrations/ai/patients/${patientId}/ai-toggle`,
                { enabled, reason }
            );
            return data.data;
        },
        onSuccess: (_, vars) => {
            queryClient.invalidateQueries({ queryKey: ['patient-ai-status', vars.patientId] });
        },
    });
}

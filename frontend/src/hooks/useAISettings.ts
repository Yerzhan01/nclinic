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

// Dashboard Stats
export interface AIDashboardStats {
    totalMessages: number;
    aiResponses: number;
    patientMessages: number;
    handoffCount: number;
    qualityIssues: number;
    errorRate: number;
    qualityByType: Record<string, number>;
}

export function useAIDashboard() {
    return useQuery({
        queryKey: ['ai-dashboard'],
        queryFn: async () => {
            const { data } = await api.get<{ data: AIDashboardStats }>('/integrations/ai-testing/dashboard');
            return data.data;
        },
        refetchInterval: 60000, // Refresh every minute
    });
}

// Quality Logs
export interface AIQualityLog {
    id: string;
    patientId: string;
    patientName: string;
    errorType: string;
    aiContent: string;
    patientReply: string;
    createdAt: string;
}

export function useAIQualityLogs(limit = 20) {
    return useQuery({
        queryKey: ['ai-quality-logs', limit],
        queryFn: async () => {
            const { data } = await api.get<{ data: AIQualityLog[] }>(`/integrations/ai-testing/quality/logs?limit=${limit}`);
            return data.data;
        },
    });
}

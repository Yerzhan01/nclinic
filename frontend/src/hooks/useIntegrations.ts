'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ApiResponse, WhatsAppStatus, AIStatus, AmoCRMStatus, AmoPipeline } from '@/types/api';


// AmoCRM
export function useAmoCRMStatus() {
    return useQuery({
        queryKey: ['amocrm-status'],
        queryFn: async () => {
            const response = await api.get<ApiResponse<AmoCRMStatus>>('/integrations/amocrm/status');
            return response.data.data;
        },
    });
}

export function useAmoPipelines(enabled: boolean) {
    return useQuery({
        queryKey: ['amocrm-pipelines'],
        queryFn: async () => {
            const response = await api.get<ApiResponse<AmoPipeline[]>>('/integrations/amocrm/pipelines');
            return response.data.data;
        },
        enabled,
    });
}

export function useConnectAmoCRM() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { baseDomain: string; accessToken: string; pipelineId?: number; mappings?: Record<string, { pipelineId: number; statusId: number }> }) => {
            const response = await api.post<ApiResponse<void>>('/integrations/amocrm/connect', data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['amocrm-status'] });
        },
    });
}

export function useTestAmoCRM() {
    return useMutation({
        mutationFn: async () => {
            const response = await api.post<ApiResponse<{ success: boolean }>>('/integrations/amocrm/test');
            return response.data.data;
        },
    });
}

export function useDisconnectAmoCRM() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            await api.post<ApiResponse<void>>('/integrations/amocrm/disconnect');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['amocrm-status'] });
        },
    });
}


// WhatsApp
export function useWhatsAppStatus() {
    return useQuery({
        queryKey: ['whatsapp-status'],
        queryFn: async () => {
            const response = await api.get<ApiResponse<WhatsAppStatus>>('/integrations/whatsapp/status');
            return response.data.data;
        },
        refetchInterval: 5000, // Poll every 5s for QR updates
    });
}

export function useConnectWhatsApp() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { idInstance: string; apiTokenInstance: string; apiUrl: string }) => {
            const response = await api.post<ApiResponse<WhatsAppStatus>>('/integrations/whatsapp/connect', data);
            return response.data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
        },
    });
}

export function useReconnectWhatsApp() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const response = await api.post<ApiResponse<WhatsAppStatus>>('/integrations/whatsapp/reconnect');
            return response.data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
        },
    });
}

// AI
export function useAIStatus() {
    return useQuery({
        queryKey: ['ai-status'],
        queryFn: async () => {
            const response = await api.get<ApiResponse<AIStatus>>('/integrations/ai/status');
            return response.data.data;
        },
    });
}

export function useConnectAI() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { apiKey: string; model: string }) => {
            const response = await api.post<ApiResponse<AIStatus>>('/integrations/ai/connect', data);
            return response.data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ai-status'] });
        },
    });
}

export function useTestAI() {
    return useMutation({
        mutationFn: async (text: string) => {
            const response = await api.post<ApiResponse<unknown>>('/integrations/ai/test', { text });
            return response.data.data;
        },
    });
}

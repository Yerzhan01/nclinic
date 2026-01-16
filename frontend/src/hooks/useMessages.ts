'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ApiResponse, Message } from '@/types/api';

export function useMessages(patientId: string) {
    return useQuery({
        queryKey: ['messages', patientId],
        queryFn: async () => {
            const response = await api.get<ApiResponse<Message[]>>(`/messages/${patientId}`);
            return response.data.data || [];
        },
        enabled: !!patientId,
        refetchInterval: 15000, // Poll every 15 seconds (fallback for WebSocket)
    });
}

export function useSendMessage(patientId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (content: string) => {
            const response = await api.post<ApiResponse<Message>>(`/messages/${patientId}/send`, {
                text: content,
            });
            return response.data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['messages', patientId] });
        },
    });
}

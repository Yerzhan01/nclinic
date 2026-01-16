'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ApiResponse, Alert } from '@/types/api';

export function useAlerts(patientId?: string) {
    return useQuery({
        queryKey: ['alerts', patientId],
        queryFn: async () => {
            const params = patientId ? `?patientId=${patientId}` : '';
            const response = await api.get<ApiResponse<Alert[]>>(`/alerts${params}`);
            return response.data.data || [];
        },
    });
}

export function useResolveAlert() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ alertId, note }: { alertId: string; note?: string }) => {
            const response = await api.post<ApiResponse<Alert>>(`/alerts/${alertId}/resolve`, {
                note,
            });
            return response.data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['alerts'] });
            queryClient.invalidateQueries({ queryKey: ['patient'] });
        },
    });
}

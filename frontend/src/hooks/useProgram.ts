'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ApiResponse, ProgramInstance, ProgramTemplate } from '@/types/api';
import { toast } from 'sonner';

export function useActiveProgram(patientId: string) {
    return useQuery({
        queryKey: ['program', patientId],
        queryFn: async () => {
            const response = await api.get<ApiResponse<ProgramInstance>>(`/programs/${patientId}/active`);
            return response.data.data;
        },
        enabled: !!patientId,
    });
}

export function useProgramTemplates() {
    return useQuery({
        queryKey: ['programTemplates'],
        queryFn: async () => {
            const response = await api.get<ApiResponse<ProgramTemplate[]>>('/programs/templates');
            return response.data.data;
        },
    });
}

export function useAssignProgram() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ patientId, templateId }: { patientId: string; templateId: string }) => {
            const response = await api.post<ApiResponse<ProgramInstance>>('/programs/assign', {
                patientId,
                templateId,
            });
            return response.data.data;
        },
        onSuccess: (_, variables) => {
            toast.success('Программа назначена');
            queryClient.invalidateQueries({ queryKey: ['program', variables.patientId] });
        },
        onError: () => {
            toast.error('Не удалось назначить программу');
        },
    });
}

export function usePauseProgram() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ patientId, paused }: { patientId: string; paused: boolean }) => {
            const response = await api.patch<ApiResponse<ProgramInstance>>(`/programs/${patientId}/pause`, {
                paused,
            });
            return response.data.data;
        },
        onSuccess: (_, variables) => {
            toast.success(variables.paused ? 'Программа приостановлена' : 'Программа возобновлена');
            queryClient.invalidateQueries({ queryKey: ['program', variables.patientId] });
        },
        onError: () => {
            toast.error('Не удалось изменить статус программы');
        },
    });
}

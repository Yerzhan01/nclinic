'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ApiResponse, Patient, ProgramTemplate } from '@/types/api';

export function usePatients(search?: string) {
    return useQuery({
        queryKey: ['patients', search],
        queryFn: async () => {
            const params = search ? `?search=${encodeURIComponent(search)}` : '';
            const response = await api.get<ApiResponse<Patient[]>>(`/patients${params}`);
            return response.data.data || [];
        },
    });
}

export function usePatient(id: string) {
    return useQuery({
        queryKey: ['patient', id],
        queryFn: async () => {
            const response = await api.get<ApiResponse<Patient>>(`/patients/${id}`);
            return response.data.data;
        },
        enabled: !!id,
    });
}

export function useCreatePatient() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (data: { fullName: string; phone: string; templateId?: string }) => {
            const response = await api.post<ApiResponse<Patient>>('/patients', data);
            return response.data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['patients'] });
        },
    });
}

export function useUpdatePatient() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<Patient> }) => {
            const response = await api.patch<ApiResponse<Patient>>(`/patients/${id}`, data);
            return response.data.data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['patient', variables.id] });
            queryClient.invalidateQueries({ queryKey: ['patients'] });
        },
    });
}

export function useProgramTemplates() {
    return useQuery({
        queryKey: ['program-templates'],
        queryFn: async () => {
            const response = await api.get<ApiResponse<ProgramTemplate[]>>('/programs/templates');
            return response.data.data || [];
        },
    });
}

export function usePatientTimeline(id: string) {
    return useQuery({
        queryKey: ['timeline', id],
        queryFn: async () => {
            // Define type locally or import if made public
            const response = await api.get<ApiResponse<any[]>>(`/patients/${id}/timeline`);
            return response.data.data || [];
        },
        enabled: !!id,
        refetchInterval: 10000,
    });
}

export function useDeletePatient() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            const response = await api.delete<ApiResponse<void>>(`/patients/${id}`);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['patients'] });
        },
    });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { programsApi, CreateTemplateInput, UpdateTemplateInput } from '@/api/programs.api';

export function usePrograms() {
    return useQuery({
        queryKey: ['programs'],
        queryFn: programsApi.list,
    });
}

export function useProgram(id: string) {
    return useQuery({
        queryKey: ['programs', id],
        queryFn: async () => {
            const all = await programsApi.list();
            return all.find((p) => p.id === id);
        },
        enabled: !!id && id !== 'new',
    });
}

export function useCreateProgram() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: programsApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['programs'] });
        },
    });
}

export function useUpdateProgram() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (args: { id: string; data: UpdateTemplateInput }) =>
            programsApi.update(args.id, args.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['programs'] });
        },
    });
}

export function useDeleteProgram() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: programsApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['programs'] });
        },
    });
}

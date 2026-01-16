import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '@/api/tasks.api';
import type { TaskFilters, TaskStatus } from '@/types/task';
import { toast } from 'sonner';

// Keys
export const taskKeys = {
    all: ['tasks'] as const,
    list: (filters: TaskFilters) => [...taskKeys.all, 'list', filters] as const,
    patient: (patientId: string) => [...taskKeys.all, 'patient', patientId] as const,
};

// Hooks
export function useTasks(filters: TaskFilters = {}) {
    return useQuery({
        queryKey: taskKeys.list(filters),
        queryFn: () => tasksApi.getAll(filters),
    });
}

export function usePatientTasks(patientId: string) {
    return useQuery({
        queryKey: taskKeys.patient(patientId),
        queryFn: () => tasksApi.getForPatient(patientId),
        enabled: !!patientId,
    });
}

export function useUpdateTaskStatus() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
            tasksApi.updateStatus(taskId, status),
        onSuccess: (updatedTask) => {
            if (updatedTask) {
                toast.success(
                    updatedTask.status === 'IN_PROGRESS'
                        ? 'Поставлено в работу'
                        : 'Задача закрыта'
                );
            }
            // Invalidate all tasks queries
            queryClient.invalidateQueries({ queryKey: taskKeys.all });
        },
        onError: () => {
            toast.error('Не удалось обновить статус задачи');
        },
    });
}

import { api } from '@/lib/api';
import type { ApiResponse } from '@/types/api';
import type { Task, TaskFilters, TaskStatus, CreateTaskInput } from '@/types/task';

export const tasksApi = {
    getAll: async (filters: TaskFilters) => {
        const params = new URLSearchParams();
        if (filters.status) params.append('status', filters.status);
        if (filters.priority) params.append('priority', filters.priority);
        if (filters.patientId) params.append('patientId', filters.patientId);
        if (filters.search) params.append('search', filters.search);

        const { data } = await api.get<ApiResponse<Task[]>>(`/tasks?${params.toString()}`);
        return data.data;
    },

    getForPatient: async (patientId: string) => {
        const { data } = await api.get<ApiResponse<Task[]>>(`/patients/${patientId}/tasks`);
        return data.data;
    },

    updateStatus: async (taskId: string, status: TaskStatus) => {
        const { data } = await api.patch<ApiResponse<Task>>(`/tasks/${taskId}`, { status });
        return data.data;
    },

    create: async (input: CreateTaskInput) => {
        const { data } = await api.post<ApiResponse<Task>>('/tasks', input);
        return data.data;
    },
};

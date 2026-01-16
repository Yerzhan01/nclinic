import { api } from '@/lib/api';

export interface ProgramActivity {
    slot: 'MORNING' | 'AFTERNOON' | 'EVENING';
    time: string;
    type: 'WEIGHT' | 'MOOD' | 'MEALS' | 'DIET_ADHERENCE' | 'STEPS' | 'VISIT' | 'CUSTOM';
    question: string;
    required: boolean;
}

export interface ProgramScheduleDay {
    day: number;
    activities: ProgramActivity[];
}

export interface ProgramTemplateRules {
    schedule: ProgramScheduleDay[];
}

export interface ProgramTemplate {
    id: string;
    name: string;
    durationDays: number;
    slotsPerDay: string[];
    isActive: boolean;
    rules: ProgramTemplateRules;
    createdAt: string;
    updatedAt: string;
}

export interface CreateTemplateInput {
    name: string;
    durationDays: number;
    isActive: boolean;
    rules: ProgramTemplateRules;
}

export type UpdateTemplateInput = Partial<CreateTemplateInput>;

export const programsApi = {
    list: async () => {
        const response = await api.get<{ data: ProgramTemplate[] }>('/programs/templates');
        return response.data.data;
        // Note: Backend endpoint is /programs/templates (GET)
    },

    create: async (data: CreateTemplateInput) => {
        const response = await api.post<{ data: ProgramTemplate }>('/programs/templates', data);
        return response.data.data;
    },

    update: async (id: string, data: UpdateTemplateInput) => {
        const response = await api.patch<{ data: ProgramTemplate }>(`/programs/templates/${id}`, data);
        return response.data.data;
    },

    delete: async (id: string) => {
        const response = await api.delete<{ success: true }>(`/programs/templates/${id}`);
        return response.data;
    },
};

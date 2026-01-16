import { api } from '@/lib/api';
import type { EngagementAnalytics } from '@/types/engagement';

export interface AnalyticsOverview {
    tasks: {
        total: number;
        open: number;
        inProgress: number;
        done: number;
        avgResolutionHours: number;
    };
    risks: {
        total: number;
        high: number;
        critical: number;
    };
    overdue: {
        total: number;
        high: number;
    };
}

export interface TaskByDay {
    date: string;
    open: number;
    done: number;
    total: number;
}

export interface ProblemPatient {
    patientId: string;
    patientName: string;
    openTasks: number;
    riskAlerts: number;
    oldestTaskHours: number;
    score?: number;
}

export interface AnalyticsFilters {
    from?: string;
    to?: string;
}

export interface DailySummary {
    silentPatients: Array<{
        id: string;
        name: string;
        phone: string;
        lastSeen: string | null;
        hoursSilent: number | string;
    }>;
    riskPatients: Array<{
        id: string;
        name: string;
        reason: string;
    }>;
    stats: {
        activePatients: number;
        checkedInToday: number;
        complianceRate: number;
    };
    tasks: {
        high: number;
        medium: number;
        low: number;
    };
}

export const analyticsApi = {
    getDailySummary: async (): Promise<DailySummary> => {
        const { data } = await api.get('/system/daily-summary');
        return data; // assuming direct return or data.data depending on backend wrapper, usually data if simple fastify route
    },

    getOverview: async (filters: AnalyticsFilters): Promise<AnalyticsOverview> => {
        const { data } = await api.get('/analytics/overview', { params: filters });
        return data.data;
    },

    getTasksByDay: async (filters: AnalyticsFilters): Promise<TaskByDay[]> => {
        const { data } = await api.get('/analytics/tasks-by-day', { params: filters });
        return data.data;
    },

    getProblemPatients: async (limit: number = 10): Promise<ProblemPatient[]> => {
        const { data } = await api.get('/analytics/problem-patients', { params: { limit } });
        return data.data;
    },

    getEngagement: async (): Promise<EngagementAnalytics> => {
        const { data } = await api.get('/analytics/engagement');
        return data.data;
    }
};

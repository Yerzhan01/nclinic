
import { api } from '@/lib/api';

export interface SystemLog {
    id: string;
    level: 'INFO' | 'WARN' | 'ERROR';
    category: string;
    message: string;
    meta?: any;
    createdAt: string;
}

export interface SystemStatus {
    status: 'ONLINE' | 'OFFLINE';
    services: {
        database: { status: 'UP' | 'DOWN'; latency: number };
        redis: { status: 'UP' | 'DOWN'; latency: number };
    };
    timestamp: string;
    error?: string;
}

export const systemApi = {
    getLogs: async (params?: { limit?: number; category?: string; level?: string }) => {
        const { data } = await api.get<{ data: SystemLog[] }>('/system/logs', { params });
        return data.data;
    },

    getStatus: async () => {
        const { data } = await api.get<{ data: SystemStatus }>('/system/status');
        return data.data;
    }
};

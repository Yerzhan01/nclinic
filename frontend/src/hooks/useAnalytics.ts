import { useQuery } from '@tanstack/react-query';
import { analyticsApi, AnalyticsFilters } from '@/api/analytics.api';

export const analyticsKeys = {
    all: ['analytics'] as const,
    overview: (filters: AnalyticsFilters) => [...analyticsKeys.all, 'overview', filters] as const,
    dailySummary: ['analytics', 'dailySummary'] as const,
    tasksByDay: (filters: AnalyticsFilters) => [...analyticsKeys.all, 'tasksByDay', filters] as const,
    problemPatients: ['analytics', 'problemPatients'] as const,
};

export function useDailySummary() {
    return useQuery({
        queryKey: analyticsKeys.dailySummary,
        queryFn: analyticsApi.getDailySummary,
        refetchInterval: 30000, // Refresh every 30s
    });
}

export function useAnalyticsOverview(filters: AnalyticsFilters) {
    return useQuery({
        queryKey: analyticsKeys.overview(filters),
        queryFn: () => analyticsApi.getOverview(filters),
    });
}

export function useTasksByDay(filters: AnalyticsFilters) {
    return useQuery({
        queryKey: analyticsKeys.tasksByDay(filters),
        queryFn: () => analyticsApi.getTasksByDay(filters),
    });
}

export function useProblemPatients(limit: number = 10) {
    return useQuery({
        queryKey: analyticsKeys.problemPatients,
        queryFn: () => analyticsApi.getProblemPatients(limit),
    });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CheckIn } from '@/types/api';

export interface CreateCheckInDto {
    type: CheckIn['type'];
    valueNumber?: number;
    valueText?: string;
    valueBool?: boolean;
    media?: CheckIn['media'];
}

export interface CheckInSummary {
    progress: string;
    issues: string[];
    nextStep: string;
    tone: string;
}

interface CheckInFilters {
    from?: Date;
    to?: Date;
    type?: string;
}

export const useCheckIns = (patientId: string, filters?: CheckInFilters) => {
    const queryClient = useQueryClient();
    const queryKey = ['patients', patientId, 'check-ins', filters?.from?.toISOString(), filters?.to?.toISOString()];

    const { data: checkIns, isLoading } = useQuery({
        queryKey,
        queryFn: async () => {
            const params = new URLSearchParams();
            if (filters?.from) params.append('from', filters.from.toISOString());
            if (filters?.to) params.append('to', filters.to.toISOString());
            if (filters?.type) params.append('type', filters.type);

            const { data } = await api.get<{ status: string; data: CheckIn[] }>(
                `/patients/${patientId}/check-ins?${params.toString()}`
            );
            return data.data;
        },
        enabled: !!patientId,
    });

    const createCheckIn = useMutation({
        mutationFn: async (dto: CreateCheckInDto) => {
            const { data } = await api.post<{ status: string; data: CheckIn }>(`/patients/${patientId}/check-ins`, dto);
            return data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
        },
    });

    const generateSummary = useMutation({
        mutationFn: async () => {
            const { data } = await api.post<{ status: string; data: CheckInSummary }>(`/patients/${patientId}/check-ins/summary`);
            return data.data;
        },
    });

    return {
        checkIns,
        isLoading,
        createCheckIn,
        generateSummary,
    };
};

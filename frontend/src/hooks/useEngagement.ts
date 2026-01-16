import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ApiResponse } from '@/types/api';
import type { EngagementScore } from '@/types/engagement';

export function useEngagement(patientId: string) {
    return useQuery({
        queryKey: ['engagement', patientId],
        queryFn: async () => {
            const response = await api.get<ApiResponse<EngagementScore>>(`/patients/${patientId}/engagement`);
            return response.data.data;
        },
        enabled: !!patientId,
    });
}

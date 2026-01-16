'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ApiResponse, ProgramInstance } from '@/types/api';

export function useActiveProgram(patientId: string) {
    return useQuery({
        queryKey: ['program', patientId],
        queryFn: async () => {
            const response = await api.get<ApiResponse<ProgramInstance>>(`/programs/${patientId}/active`);
            return response.data.data;
        },
        enabled: !!patientId,
    });
}

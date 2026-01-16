import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { PatientProfile } from '@/types/api';

// Re-export type for convenience
export type { PatientProfile };

/**
 * Fetch patient profile
 */
export function usePatientProfile(patientId: string | undefined) {
    return useQuery({
        queryKey: ['patient-profile', patientId],
        queryFn: async () => {
            if (!patientId) return null;
            const { data } = await api.get<{ data: PatientProfile }>(
                `/patients/${patientId}/profile`
            );
            return data.data;
        },
        enabled: !!patientId,
    });
}

/**
 * Update patient profile (partial)
 */
export function useUpdatePatientProfile() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            patientId,
            patch
        }: {
            patientId: string;
            patch: Partial<PatientProfile>
        }) => {
            const { data } = await api.patch<{ data: PatientProfile }>(
                `/patients/${patientId}/profile`,
                patch
            );
            return data.data;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ['patient-profile', variables.patientId]
            });
        },
    });
}

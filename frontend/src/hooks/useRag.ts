import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface RagSource {
    id: string;
    name: string;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
    _count?: {
        documents: number;
    };
}

export interface RagDocument {
    id: string;
    sourceId: string;
    title: string;
    content: string;
    enabled: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface RagSearchResult {
    documentId: string;
    title: string;
    contentSnippet: string;
    similarity?: number;
    sourceName: string;
}

// --- Sources Hooks ---

export function useRagSources() {
    return useQuery({
        queryKey: ['rag-sources'],
        queryFn: async () => {
            const { data } = await api.get<{ data: RagSource[] }>('/rag/sources');
            return data.data;
        },
    });
}

export function useCreateRagSource() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (name: string) => {
            const { data } = await api.post<{ data: RagSource }>('/rag/sources', { name });
            return data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rag-sources'] });
        },
    });
}

export function useDeleteRagSource() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/rag/sources/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rag-sources'] });
        },
    });
}

// --- Documents Hooks ---

export function useRagDocuments(sourceId: string | null) {
    return useQuery({
        queryKey: ['rag-documents', sourceId],
        queryFn: async () => {
            if (!sourceId) return [];
            const { data } = await api.get<{ data: RagDocument[] }>(`/rag/documents?sourceId=${sourceId}`);
            return data.data;
        },
        enabled: !!sourceId,
    });
}

export function useCreateRagDocument() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (doc: { sourceId: string; title: string; content: string }) => {
            const { data } = await api.post<{ data: RagDocument }>('/rag/documents', doc);
            return data.data;
        },
        onSuccess: (_, vars) => {
            queryClient.invalidateQueries({ queryKey: ['rag-documents', vars.sourceId] });
            queryClient.invalidateQueries({ queryKey: ['rag-sources'] }); // Update counts
        },
    });
}

export function useUpdateRagDocument() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, ...data }: { id: string; title?: string; content?: string; enabled?: boolean }) => {
            const res = await api.put<{ data: RagDocument }>(`/rag/documents/${id}`, data);
            return res.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['rag-documents', data.data.sourceId] });
        },
    });
}

export function useDeleteRagDocument() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, sourceId }: { id: string; sourceId: string }) => {
            await api.delete(`/rag/documents/${id}`);
        },
        onSuccess: (_, vars) => {
            queryClient.invalidateQueries({ queryKey: ['rag-documents', vars.sourceId] });
            queryClient.invalidateQueries({ queryKey: ['rag-sources'] });
        },
    });
}

// --- Search Hook (for testing) ---

export function useRagSearch() {
    return useMutation({
        mutationFn: async (query: string) => {
            const { data } = await api.get<{ data: RagSearchResult[] }>(`/rag/search`, {
                params: { q: query }
            });
            return data.data;
        },
    });
}

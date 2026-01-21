import { prisma } from '@/config/prisma.js';
import { logger } from '@/common/utils/logger.js';

export interface CreateSourceDto {
    name: string;
    enabled?: boolean;
}

export interface UpdateSourceDto {
    name?: string;
    enabled?: boolean;
}

export interface CreateDocumentDto {
    sourceId: string;
    title: string;
    content: string;
    enabled?: boolean;
}

export interface UpdateDocumentDto {
    title?: string;
    content?: string;
    enabled?: boolean;
}

export interface SearchResult {
    id: string;
    sourceId: string;
    sourceName: string;
    title: string;
    content: string;
    snippet: string;
}

export class RagService {
    // ==================== Sources ====================

    async listSources() {
        return prisma.ragSource.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: { select: { documents: true } }
            }
        });
    }

    async getSource(id: string) {
        return prisma.ragSource.findUnique({
            where: { id },
            include: {
                _count: { select: { documents: true } }
            }
        });
    }

    async createSource(dto: CreateSourceDto) {
        return prisma.ragSource.create({
            data: {
                name: dto.name,
                enabled: dto.enabled ?? true,
            }
        });
    }

    async updateSource(id: string, dto: UpdateSourceDto) {
        return prisma.ragSource.update({
            where: { id },
            data: dto,
        });
    }

    async deleteSource(id: string) {
        return prisma.ragSource.delete({
            where: { id }
        });
    }

    // ==================== Documents ====================

    async listDocuments(sourceId?: string) {
        return prisma.ragDocument.findMany({
            where: sourceId ? { sourceId } : undefined,
            orderBy: { createdAt: 'desc' },
            include: {
                source: { select: { name: true } }
            }
        });
    }

    async getDocument(id: string) {
        return prisma.ragDocument.findUnique({
            where: { id },
            include: {
                source: { select: { name: true } }
            }
        });
    }

    async createDocument(dto: CreateDocumentDto) {
        return prisma.ragDocument.create({
            data: {
                sourceId: dto.sourceId,
                title: dto.title,
                content: dto.content,
                enabled: dto.enabled ?? true,
            }
        });
    }

    async updateDocument(id: string, dto: UpdateDocumentDto) {
        return prisma.ragDocument.update({
            where: { id },
            data: dto,
        });
    }

    async deleteDocument(id: string) {
        return prisma.ragDocument.delete({
            where: { id }
        });
    }

    /**
     * Improved search: splits query into words and finds documents matching ANY word
     * Returns topK results with snippets
     */
    async search(query: string, topK: number = 5, maxChars: number = 2000): Promise<SearchResult[]> {
        if (!query.trim()) {
            return [];
        }

        // Split query into meaningful words (3+ chars, filter stop words)
        const stopWords = ['для', 'что', 'как', 'это', 'при', 'или', 'если', 'чем'];
        const words = query
            .toLowerCase()
            .split(/\s+/)
            .filter(w => w.length >= 3 && !stopWords.includes(w));

        if (words.length === 0) {
            // Fallback to original query if no meaningful words
            words.push(query.trim());
        }

        // Build OR conditions for each word
        const orConditions = words.flatMap(word => [
            { title: { contains: word, mode: 'insensitive' as const } },
            { content: { contains: word, mode: 'insensitive' as const } },
        ]);

        const documents = await prisma.ragDocument.findMany({
            where: {
                enabled: true,
                source: { enabled: true },
                OR: orConditions
            },
            take: topK,
            include: {
                source: { select: { name: true } }
            }
        });

        let totalChars = 0;
        const results: SearchResult[] = [];

        for (const doc of documents) {
            // Create snippet (first 300 chars or around match)
            const lowerContent = doc.content.toLowerCase();
            const lowerQuery = query.toLowerCase();
            const matchIndex = lowerContent.indexOf(lowerQuery);

            let snippet: string;
            if (matchIndex >= 0) {
                const start = Math.max(0, matchIndex - 50);
                const end = Math.min(doc.content.length, matchIndex + 250);
                snippet = (start > 0 ? '...' : '') + doc.content.slice(start, end) + (end < doc.content.length ? '...' : '');
            } else {
                snippet = doc.content.slice(0, 300) + (doc.content.length > 300 ? '...' : '');
            }

            // Check total chars limit
            if (totalChars + snippet.length > maxChars) {
                break;
            }
            totalChars += snippet.length;

            results.push({
                id: doc.id,
                sourceId: doc.sourceId,
                sourceName: doc.source.name,
                title: doc.title,
                content: doc.content,
                snippet,
            });
        }

        logger.info({ query, resultCount: results.length, totalChars }, 'RAG search completed');
        return results;
    }

    /**
     * Build RAG context for AI prompt
     */
    buildRagContext(results: SearchResult[]): string {
        if (results.length === 0) {
            return '';
        }

        const lines = ['КОНТЕКСТ БАЗЫ ЗНАНИЙ (RAG):', '<BEGIN_RAG>'];

        for (const r of results) {
            lines.push(`[${r.sourceName}] ${r.title}:`);
            lines.push(r.snippet);
            lines.push('');
        }

        lines.push('<END_RAG>');
        return lines.join('\n');
    }
}

export const ragService = new RagService();

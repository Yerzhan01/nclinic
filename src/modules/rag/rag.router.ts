import type { FastifyInstance } from 'fastify';
import { ragController } from './rag.controller.js';
import { authPreHandler } from '@/modules/auth/auth.router.js';

export default async function ragRouter(app: FastifyInstance) {
    // All RAG routes require authentication
    app.addHook('preHandler', authPreHandler);

    // Sources
    app.get('/sources', ragController.listSources.bind(ragController));
    app.get('/sources/:id', ragController.getSource.bind(ragController));
    app.post('/sources', ragController.createSource.bind(ragController));
    app.patch('/sources/:id', ragController.updateSource.bind(ragController));
    app.delete('/sources/:id', ragController.deleteSource.bind(ragController));

    // Documents
    app.get('/documents', ragController.listDocuments.bind(ragController));
    app.get('/documents/:id', ragController.getDocument.bind(ragController));
    app.post('/documents', ragController.createDocument.bind(ragController));
    app.patch('/documents/:id', ragController.updateDocument.bind(ragController));
    app.delete('/documents/:id', ragController.deleteDocument.bind(ragController));

    // Search
    app.get('/search', ragController.search.bind(ragController));
}

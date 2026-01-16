import type { FastifyInstance } from 'fastify';
import { programController } from './program.controller.js';
import { authPreHandler } from '@/modules/auth/auth.router.js';

export default async function programRouter(app: FastifyInstance) {
    // All routes require authentication
    app.addHook('preHandler', authPreHandler);

    // POST /assign - Assign a program to a patient
    app.post('/assign', async (request, reply) => {
        return programController.assignProgram(request, reply);
    });

    // GET /:patientId/active - Get active program and check-ins for a patient
    app.get('/:patientId/active', async (request, reply) => {
        return programController.getActiveProgram(request, reply);
    });

    app.post('/mark-missed', async (request, reply) => {
        return programController.markMissedCheckIns(request, reply);
    });

    // Template Management
    app.get('/templates', async (request, reply) => {
        return programController.listTemplates(request, reply);
    });

    app.post('/templates', async (request, reply) => {
        return programController.createTemplate(request, reply);
    });

    app.patch('/templates/:id', async (request, reply) => {
        return programController.updateTemplate(request, reply);
    });

    app.delete('/templates/:id', async (request, reply) => {
        return programController.deleteTemplate(request, reply);
    });

    // PATCH /:patientId/pause - Pause/resume a program
    app.patch('/:patientId/pause', async (request, reply) => {
        return programController.pauseProgram(request, reply);
    });

}

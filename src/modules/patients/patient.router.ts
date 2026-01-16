import type { FastifyInstance } from 'fastify';
import { authPreHandler } from '@/modules/auth/auth.router.js';
import { patientController } from './patient.controller.js';

export default async function patientRouter(app: FastifyInstance) {
    app.addHook('preHandler', authPreHandler);

    app.post('/', patientController.create.bind(patientController));
    app.patch('/:id', patientController.update.bind(patientController));
    app.get('/', patientController.list.bind(patientController));
    app.get('/:id', patientController.get.bind(patientController));

    // Profile endpoints
    app.get('/:id/profile', patientController.getProfile.bind(patientController));
    app.patch('/:id/profile', patientController.updateProfile.bind(patientController));
    app.get('/:id/timeline', patientController.getTimeline.bind(patientController));

    // Tasks
    const { taskController } = await import('@/modules/tasks/task.controller.js');
    app.get('/:id/tasks', taskController.getPatientTasks.bind(taskController));
}

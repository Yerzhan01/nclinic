import type { FastifyInstance } from 'fastify';
import { taskController } from './task.controller.js';

export async function taskRouter(fastify: FastifyInstance) {
    fastify.get('/', taskController.listTasks);
    fastify.patch('/:id', taskController.updateTask);
}

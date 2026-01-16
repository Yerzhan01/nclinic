import type { FastifyRequest, FastifyReply } from 'fastify';
import { taskService, UpdateTaskInput } from './task.service.js';
import { TaskStatus, TaskPriority } from '@prisma/client';

export class TaskController {
    /**
     * List tasks
     * GET /tasks
     */
    async listTasks(
        req: FastifyRequest<{
            Querystring: {
                status?: TaskStatus;
                patientId?: string;
                priority?: TaskPriority;
                overdue?: boolean;
            };
        }>,
        reply: FastifyReply
    ) {
        const tasks = await taskService.listTasks(req.query);
        return reply.send({ success: true, data: tasks });
    }

    /**
     * Update task
     * PATCH /tasks/:id
     */
    async updateTask(
        req: FastifyRequest<{
            Params: { id: string };
            Body: UpdateTaskInput;
        }>,
        reply: FastifyReply
    ) {
        const { id } = req.params;
        const task = await taskService.updateTask(id, req.body);
        return reply.send({ success: true, data: task });
    }

    /**
     * Get patient tasks
     * GET /patients/:id/tasks
     */
    async getPatientTasks(
        req: FastifyRequest<{
            Params: { id: string };
        }>,
        reply: FastifyReply
    ) {
        const { id } = req.params;
        const tasks = await taskService.getPatientTasks(id);
        return reply.send({ success: true, data: tasks });
    }
}

export const taskController = new TaskController();

'use client';

import { useState } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { TasksTable } from '@/components/tasks/TasksTable';
import { TasksFilters } from '@/components/tasks/TasksFilters';
import type { TaskFilters } from '@/types/task';

export default function TasksPage() {
    // Default filters: OPEN status
    const [filters, setFilters] = useState<TaskFilters>({
        status: 'OPEN',
    });

    const { data: tasks, isLoading } = useTasks(filters);

    return (
        <div className="h-full flex-1 flex-col space-y-8 p-8 md:flex">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Задачи</h2>
                    <p className="text-muted-foreground">
                        Управление задачами и алертами от AI и системы
                    </p>
                </div>
            </div>

            <div className="space-y-4">
                <TasksFilters filters={filters} onChange={setFilters} />
                <TasksTable tasks={tasks || []} isLoading={isLoading} />
            </div>
        </div>
    );
}

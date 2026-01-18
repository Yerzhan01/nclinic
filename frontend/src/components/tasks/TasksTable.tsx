import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Play, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import Link from 'next/link';
import type { Task } from '@/types/task';
import { PriorityBadge, StatusBadge, TypeBadge } from './TaskBadges';
import { useUpdateTaskStatus } from '@/hooks/useTasks';
import { Loader2 } from 'lucide-react';

interface TasksTableProps {
    tasks: Task[];
    isLoading: boolean;
}

export function TasksTable({ tasks, isLoading }: TasksTableProps) {
    const updateStatus = useUpdateTaskStatus();

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (tasks.length === 0) {
        return (
            <div className="flex h-32 items-center justify-center border rounded-lg bg-muted/50">
                <p className="text-muted-foreground">Задач не найдено</p>
            </div>
        );
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Дата</TableHead>
                        <TableHead>Приоритет</TableHead>
                        <TableHead>Тип</TableHead>
                        <TableHead>SLA</TableHead>
                        <TableHead className="w-[40%]">Задача</TableHead>
                        <TableHead>Пациент</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {tasks.map((task) => (
                        <TableRow key={task.id}>
                            <TableCell className="whitespace-nowrap">
                                {format(new Date(task.createdAt), 'd MMM HH:mm', { locale: ru })}
                            </TableCell>
                            <TableCell>
                                <PriorityBadge priority={task.priority} />
                            </TableCell>
                            <TableCell>
                                <TypeBadge type={task.type} />
                            </TableCell>
                            <TableCell>
                                {task.isOverdue ? (
                                    <span className="inline-flex items-center rounded-full border border-destructive bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                                        ПРОСРОЧЕНО +{task.overdueHours}ч
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center px-2 py-0.5 text-xs text-muted-foreground">
                                        OK
                                    </span>
                                )}
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col gap-1">
                                    <span className="font-medium">{task.title}</span>
                                    {task.description && (
                                        <span className="text-xs text-muted-foreground line-clamp-2">
                                            {task.description}
                                        </span>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                {task.patient ? (
                                    <Link
                                        href={`/patients/${task.patient.id}`}
                                        className="text-primary hover:underline"
                                    >
                                        {task.patient.fullName}
                                    </Link>
                                ) : (
                                    <span className="text-muted-foreground">-</span>
                                )}
                            </TableCell>
                            <TableCell>
                                <StatusBadge status={task.status} />
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    {task.status === 'OPEN' && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => updateStatus.mutate({ taskId: task.id, status: 'IN_PROGRESS' })}
                                            disabled={updateStatus.isPending}
                                            title="В работу"
                                        >
                                            <Play className="h-4 w-4" />
                                        </Button>
                                    )}
                                    {task.status !== 'DONE' && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => updateStatus.mutate({ taskId: task.id, status: 'DONE' })}
                                            disabled={updateStatus.isPending}
                                            title="Завершить"
                                        >
                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                        </Button>
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

import { Badge } from '@/components/ui/badge';
import type { TaskPriority, TaskStatus, TaskType } from '@/types/task';

interface BadgeProps {
    className?: string;
}

export function PriorityBadge({ priority, className }: { priority: TaskPriority } & BadgeProps) {
    const variants: Record<TaskPriority, 'default' | 'secondary' | 'destructive' | 'outline'> = {
        LOW: 'secondary',
        MEDIUM: 'default',
        HIGH: 'destructive',
    };

    const labels: Record<TaskPriority, string> = {
        LOW: 'Низкий',
        MEDIUM: 'Средний',
        HIGH: 'Высокий',
    };

    return (
        <Badge variant={variants[priority]} className={className}>
            {labels[priority]}
        </Badge>
    );
}

export function StatusBadge({ status, className }: { status: TaskStatus } & BadgeProps) {
    const variants: Record<TaskStatus, 'default' | 'secondary' | 'outline'> = {
        OPEN: 'outline',
        IN_PROGRESS: 'default',
        DONE: 'secondary',
    };

    const labels: Record<TaskStatus, string> = {
        OPEN: 'Открыто',
        IN_PROGRESS: 'В работе',
        DONE: 'Завершено',
    };

    return (
        <Badge variant={variants[status]} className={className}>
            {labels[status]}
        </Badge>
    );
}

export function TypeBadge({ type, className }: { type: TaskType } & BadgeProps) {
    const labels: Record<TaskType, string> = {
        RISK_ALERT: 'Риск (AI)',
        MISSED_CHECKIN: 'Пропущен отчёт',
        FOLLOW_UP: 'Требует внимания',
        CUSTOM: 'Задача',
    };

    return (
        <Badge variant="outline" className={className}>
            {labels[type]}
        </Badge>
    );
}

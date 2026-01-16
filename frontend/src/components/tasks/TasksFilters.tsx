import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { TaskFilters, TaskStatus, TaskPriority } from '@/types/task';
import { Search } from 'lucide-react';

interface TasksFiltersProps {
    filters: TaskFilters;
    onChange: (filters: TaskFilters) => void;
}

export function TasksFilters({ filters, onChange }: TasksFiltersProps) {
    const update = (key: keyof TaskFilters, value: string | undefined) => {
        const newFilters = { ...filters };
        if (value && value !== 'ALL') {
            // @ts-ignore
            newFilters[key] = value;
        } else {
            delete newFilters[key];
        }
        onChange(newFilters);
    };

    return (
        <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Поиск по задачам..."
                    value={filters.search || ''}
                    onChange={(e) => update('search', e.target.value)}
                    className="pl-8"
                />
            </div>

            <Select
                value={filters.status || 'ALL'}
                onValueChange={(v) => update('status', v)}
            >
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ALL">Все статусы</SelectItem>
                    <SelectItem value="OPEN">Открыто</SelectItem>
                    <SelectItem value="IN_PROGRESS">В работе</SelectItem>
                    <SelectItem value="DONE">Завершено</SelectItem>
                </SelectContent>
            </Select>

            <Select
                value={filters.priority || 'ALL'}
                onValueChange={(v) => update('priority', v)}
            >
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Приоритет" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="ALL">Любой приоритет</SelectItem>
                    <SelectItem value="HIGH">Высокий</SelectItem>
                    <SelectItem value="MEDIUM">Средний</SelectItem>
                    <SelectItem value="LOW">Низкий</SelectItem>
                </SelectContent>
            </Select>

            <div className="flex items-center space-x-2 border rounded-md px-3">
                <Switch
                    id="overdue-mode"
                    checked={filters.overdue || false}
                    onCheckedChange={(checked) => update('overdue', checked ? 'true' : undefined)}
                />
                <Label htmlFor="overdue-mode" className="text-sm cursor-pointer text-destructive font-medium">
                    Только просроченные
                </Label>
            </div>
        </div>
    );
}

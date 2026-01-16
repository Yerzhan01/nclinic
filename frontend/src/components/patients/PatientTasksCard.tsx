import { usePatientTasks } from '@/hooks/useTasks';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { TasksTable } from '@/components/tasks/TasksTable';

interface PatientTasksCardProps {
    patientId: string;
}

export function PatientTasksCard({ patientId }: PatientTasksCardProps) {
    const { data: tasks, isLoading } = usePatientTasks(patientId);

    // Filter out DONE tasks, show only active ones
    const activeTasks = tasks?.filter((t) => t.status !== 'DONE') || [];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Активные задачи</CardTitle>
                <CardDescription>
                    Задачи, требующие внимания оператора по этому пациенту
                </CardDescription>
            </CardHeader>
            <CardContent>
                <TasksTable tasks={activeTasks} isLoading={isLoading} />
            </CardContent>
        </Card>
    );
}

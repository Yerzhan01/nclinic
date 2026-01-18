import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useEngagement } from '@/hooks/useEngagement';
import { AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';

interface EngagementCardProps {
    patientId: string;
}

export function EngagementCard({ patientId }: EngagementCardProps) {
    const { data, isLoading } = useEngagement(patientId);

    if (isLoading) {
        return <Skeleton className="h-48 w-full" />;
    }

    if (!data) {
        return null; // Or empty state
    }

    const { score, status, factors } = data;

    let statusColor = 'text-green-600';
    let statusLabel = 'Норма';
    const progressColor = 'bg-green-600'; // Tailwind class for progress indicator if supported, or inline style

    if (status === 'HIGH_RISK') {
        statusColor = 'text-red-600';
        statusLabel = 'Критический риск';
    } else if (status === 'AT_RISK') {
        statusColor = 'text-orange-600';
        statusLabel = 'В зоне риска';
    }

    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-base">Вовлечённость</CardTitle>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                    <p>Оценка активности пациента (0-100). Влияет на частоту проверок и приоритет задач.</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    <Badge variant={status === 'OK' ? 'outline' : 'destructive'} className={status === 'OK' ? 'border-green-600 text-green-600' : ''}>
                        {statusLabel}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-bold mb-2 flex items-baseline gap-2">
                    <span className={statusColor}>{score}</span>
                    <span className="text-sm text-muted-foreground font-normal">/ 100</span>
                </div>

                <Progress value={score} className="h-2 mb-4" />

                <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Факторы:</p>
                    {factors.length === 0 ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle className="h-3 w-3" />
                            <span>Нет значимых факторов</span>
                        </div>
                    ) : (
                        factors.map((factor, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                                <AlertCircle className="h-3 w-3 mt-1 text-muted-foreground" />
                                <span>{factor}</span>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

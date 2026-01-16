'use client';

import { useAlerts, useResolveAlert } from '@/hooks/useAlerts';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { AlertLevel } from '@/types/api';

function AlertLevelBadge({ level }: { level: AlertLevel }) {
    const variants: Record<AlertLevel, 'default' | 'secondary' | 'destructive' | 'outline'> = {
        LOW: 'outline',
        MEDIUM: 'secondary',
        HIGH: 'default',
        CRITICAL: 'destructive',
    };
    return <Badge variant={variants[level]}>{level}</Badge>;
}

export default function AlertsPage() {
    const { data: alerts = [], isLoading } = useAlerts();
    const resolveAlert = useResolveAlert();

    const activeAlerts = alerts.filter((a) => a.status !== 'RESOLVED');

    const handleResolve = async (alertId: string) => {
        try {
            await resolveAlert.mutateAsync({ alertId });
            toast.success('Алерт закрыт');
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-bold">Алерты</h1>
                <p className="text-muted-foreground">Активные алерты, требующие внимания</p>
            </div>

            {isLoading ? (
                <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-32 w-full" />
                    ))}
                </div>
            ) : activeAlerts.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                        <p className="text-lg font-medium">Все хорошо!</p>
                        <p className="text-muted-foreground">Нет активных алертов</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {activeAlerts.map((alert) => (
                        <Card
                            key={alert.id}
                            className={alert.level === 'CRITICAL' || alert.level === 'HIGH' ? 'border-destructive' : ''}
                        >
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4" />
                                        {alert.title}
                                    </CardTitle>
                                    <AlertLevelBadge level={alert.level} />
                                </div>
                                <CardDescription>
                                    {alert.patient?.fullName || 'Пациент'} • {alert.type} •{' '}
                                    {new Date(alert.createdAt).toLocaleString('ru-RU')}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {alert.description && (
                                    <p className="text-sm text-muted-foreground mb-4">{alert.description}</p>
                                )}
                                <div className="flex gap-2">
                                    <Link href={`/patients/${alert.patientId}`}>
                                        <Button variant="outline" size="sm">
                                            <ExternalLink className="h-4 w-4 mr-2" />
                                            К пациенту
                                        </Button>
                                    </Link>
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => handleResolve(alert.id)}
                                        disabled={resolveAlert.isPending}
                                    >
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Закрыть алерт
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

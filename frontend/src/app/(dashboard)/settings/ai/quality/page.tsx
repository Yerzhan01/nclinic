'use client';

import { Loader2, MessageSquare, Bot, AlertTriangle, Users, TrendingUp } from 'lucide-react';
import { useAIDashboard, useAIQualityLogs } from '@/hooks/useAISettings';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';

const ERROR_TYPE_LABELS: Record<string, { label: string; color: string }> = {
    CONFUSION: { label: 'Непонимание', color: 'yellow' },
    COMPLAINT: { label: 'Жалоба', color: 'red' },
    HANDOFF_REQUEST: { label: 'Запрос оператора', color: 'orange' },
    REPEAT_QUESTION: { label: 'Повтор вопроса', color: 'blue' },
};

function StatCard({ title, value, subtitle, icon: Icon, trend }: {
    title: string;
    value: number | string;
    subtitle?: string;
    icon: typeof MessageSquare;
    trend?: 'up' | 'down' | 'neutral';
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {subtitle && (
                    <p className="text-xs text-muted-foreground">
                        {trend === 'up' && '↑ '}
                        {trend === 'down' && '↓ '}
                        {subtitle}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

export default function AIQualityPage() {
    const { data: stats, isLoading: statsLoading } = useAIDashboard();
    const { data: logs = [], isLoading: logsLoading } = useAIQualityLogs(20);

    if (statsLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    const errorRateStatus = stats?.errorRate && stats.errorRate > 5 ? 'destructive' : 'default';

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">AI Quality Dashboard</h1>
                    <p className="text-muted-foreground">Мониторинг качества AI-ответов за последние 7 дней</p>
                </div>
                <Link href="/settings/ai">
                    <Badge variant="outline">← Назад к настройкам</Badge>
                </Link>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Всего сообщений"
                    value={stats?.totalMessages || 0}
                    icon={MessageSquare}
                    subtitle="за 7 дней"
                />
                <StatCard
                    title="AI ответы"
                    value={stats?.aiResponses || 0}
                    icon={Bot}
                    subtitle={`${Math.round((stats?.aiResponses || 0) / (stats?.totalMessages || 1) * 100)}% от всех`}
                />
                <StatCard
                    title="Handoff (HUMAN mode)"
                    value={stats?.handoffCount || 0}
                    icon={Users}
                    subtitle="пациентов"
                />
                <Card className={errorRateStatus === 'destructive' ? 'border-destructive' : ''}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
                        <AlertTriangle className={`h-4 w-4 ${errorRateStatus === 'destructive' ? 'text-destructive' : 'text-muted-foreground'}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${errorRateStatus === 'destructive' ? 'text-destructive' : ''}`}>
                            {stats?.errorRate || 0}%
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {stats?.qualityIssues || 0} проблем / {stats?.aiResponses || 0} ответов
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Quality Issues Breakdown */}
            {stats?.qualityByType && Object.keys(stats.qualityByType).length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Типы проблем</CardTitle>
                        <CardDescription>Распределение ошибок AI по категориям</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-4">
                            {Object.entries(stats.qualityByType).map(([type, count]) => {
                                const config = ERROR_TYPE_LABELS[type] || { label: type, color: 'gray' };
                                return (
                                    <div key={type} className="flex items-center justify-between p-3 border rounded-lg">
                                        <span className="text-sm">{config.label}</span>
                                        <Badge variant="secondary">{count}</Badge>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Recent Quality Issues */}
            <Card>
                <CardHeader>
                    <CardTitle>Последние проблемы</CardTitle>
                    <CardDescription>История обнаруженных проблем с AI-ответами</CardDescription>
                </CardHeader>
                <CardContent>
                    {logsLoading ? (
                        <div className="flex justify-center py-4">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : logs.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">
                            Проблем не обнаружено — AI работает отлично! 🎉
                        </p>
                    ) : (
                        <ScrollArea className="h-[400px]">
                            <div className="space-y-3">
                                {logs.map((log) => {
                                    const config = ERROR_TYPE_LABELS[log.errorType] || { label: log.errorType, color: 'gray' };
                                    return (
                                        <div key={log.id} className="p-3 border rounded-lg space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline">{config.label}</Badge>
                                                    <Link href={`/patients/${log.patientId}`} className="text-sm font-medium hover:underline">
                                                        {log.patientName}
                                                    </Link>
                                                </div>
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(log.createdAt).toLocaleString('ru')}
                                                </span>
                                            </div>
                                            <div className="grid gap-2 md:grid-cols-2">
                                                <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded text-sm">
                                                    <p className="text-xs text-muted-foreground mb-1">AI ответ:</p>
                                                    <p className="line-clamp-2">{log.aiContent}</p>
                                                </div>
                                                <div className="p-2 bg-red-50 dark:bg-red-950 rounded text-sm">
                                                    <p className="text-xs text-muted-foreground mb-1">Ответ пациента:</p>
                                                    <p className="line-clamp-2">{log.patientReply}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

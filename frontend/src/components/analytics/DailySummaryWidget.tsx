
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useDailySummary } from '@/hooks/useAnalytics';
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Phone, AlertTriangle, CheckCircle, Clock } from "lucide-react";

export function DailySummaryWidget() {
    const { data: summary, isLoading } = useDailySummary();

    if (isLoading) {
        return <Skeleton className="w-full h-[200px] rounded-xl" />;
    }

    if (!summary) return null;

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            {/* 1. Silent Patients (Left, larger) */}
            <Card className="col-span-4 border-l-4 border-l-orange-500 shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center justify-between">
                        <span>Требуют внимания (Молчат {'>'} 24ч)</span>
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                            {summary.silentPatients.length} пациент(ов)
                        </Badge>
                    </CardTitle>
                    <CardDescription>
                        Пациенты с активной программой, которые не выходили на связь.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {summary.silentPatients.length === 0 ? (
                        <div className="text-sm text-green-600 flex items-center gap-2 mt-4">
                            <CheckCircle className="w-4 h-4" />
                            Все активные пациенты на связи!
                        </div>
                    ) : (
                        <div className="space-y-4 mt-2">
                            {summary.silentPatients.slice(0, 5).map(p => (
                                <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                            {p.name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium">{p.name}</div>
                                            <div className="text-xs text-slate-500 flex items-center gap-1">
                                                <Phone className="w-3 h-3" /> {p.phone}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-bold text-orange-600 flex items-center gap-1 justify-end">
                                            <Clock className="w-3 h-3" />
                                            {p.hoursSilent} ч.
                                        </div>
                                        <div className="text-[10px] text-slate-400">тишина</div>
                                    </div>
                                </div>
                            ))}
                            {summary.silentPatients.length > 5 && (
                                <div className="text-center text-xs text-muted-foreground pt-1">
                                    + еще {summary.silentPatients.length - 5}...
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* 2. Compliance & Risks (Right column) */}
            <div className="col-span-3 space-y-4">
                {/* Check-in Stats */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Статистика за сегодня</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div className="p-3 bg-blue-50 rounded-lg">
                                <div className="text-2xl font-bold text-blue-700">{summary.stats.complianceRate}%</div>
                                <div className="text-xs text-blue-600 font-medium">Сдали отчеты</div>
                            </div>
                            <div className="p-3 bg-green-50 rounded-lg">
                                <div className="text-2xl font-bold text-green-700">{summary.stats.checkedInToday}</div>
                                <div className="text-xs text-green-600 font-medium">Отчетов получено</div>
                            </div>
                        </div>
                        <div className="mt-4 text-xs text-center text-muted-foreground">
                            Всего активных пациентов: <b>{summary.stats.activePatients}</b>
                        </div>
                    </CardContent>
                </Card>

                {/* High Risks */}
                <Card className={`${summary.riskPatients.length > 0 ? 'border-red-500' : ''}`}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex justify-between items-center">
                            <span>Группа Риска (AI)</span>
                            {summary.riskPatients.length > 0 && <AlertTriangle className="w-4 h-4 text-red-500" />}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {summary.riskPatients.length === 0 ? (
                                <div className="text-sm text-slate-500 flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-500" /> Нет критических алертов
                                </div>
                            ) : (
                                summary.riskPatients.map(p => (
                                    <div key={p.id} className="flex justify-between items-center text-sm p-2 bg-red-50 rounded border border-red-100">
                                        <span className="font-medium text-red-900">{p.name}</span>
                                        <span className="text-[10px] bg-red-200 text-red-800 px-1.5 py-0.5 rounded-full">{p.reason}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

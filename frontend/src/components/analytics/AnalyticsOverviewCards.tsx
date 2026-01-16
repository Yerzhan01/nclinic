import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyticsOverview } from "@/api/analytics.api";
import { Activity, AlertOctagon, CheckCircle, Clock, AlertTriangle, TrendingUp } from "lucide-react";

export function AnalyticsOverviewCards({ data }: { data: AnalyticsOverview }) {
    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <Card className="hover:shadow-md transition-all border-l-4 border-l-blue-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Всего задач</CardTitle>
                    <div className="p-2 bg-blue-100 rounded-full">
                        <Activity className="h-4 w-4 text-blue-600" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-slate-800">{data.tasks.total}</div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <span className="text-blue-600 font-medium">{data.tasks.open} открыто</span>
                        <span className="opacity-50">•</span>
                        <span>{data.tasks.inProgress} в работе</span>
                    </p>
                </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-all border-l-4 border-l-purple-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">SLA (Среднее)</CardTitle>
                    <div className="p-2 bg-purple-100 rounded-full">
                        <Clock className="h-4 w-4 text-purple-600" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-slate-800">{data.tasks.avgResolutionHours} ч</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Время выполнения
                    </p>
                </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-all border-l-4 border-l-red-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Просрочено</CardTitle>
                    <div className="p-2 bg-red-100 rounded-full">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-red-600">{data.overdue.total}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        {data.overdue.high} высокий приоритет
                    </p>
                </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-all border-l-4 border-l-orange-500">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Риски</CardTitle>
                    <div className="p-2 bg-orange-100 rounded-full">
                        <TrendingUp className="h-4 w-4 text-orange-600" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-slate-800">{data.risks.total}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Событий за период
                    </p>
                </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-all border-l-4 border-l-rose-600">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Критические</CardTitle>
                    <div className="p-2 bg-rose-100 rounded-full">
                        <AlertOctagon className="h-4 w-4 text-rose-600" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-rose-600">{data.risks.critical}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Требуют внимания
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}

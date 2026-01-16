import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, AlertTriangle, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import type { EngagementAnalytics } from "@/types/engagement";

export function AnalyticsEngagementCard() {
    const { data, isLoading } = useQuery({
        queryKey: ['engagement-analytics'],
        queryFn: async () => {
            const response = await api.get<{ data: EngagementAnalytics }>('/analytics/engagement');
            return response.data.data;
        }
    });

    if (isLoading) {
        return <Skeleton className="h-[120px] rounded-xl" />;
    }

    if (!data) return null;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Пациенты в зоне риска</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-4 mt-2">
                    <div className="flex flex-col">
                        <span className="text-2xl font-bold text-red-600 flex items-center gap-2">
                            {data.highRisk}
                            <AlertTriangle className="h-4 w-4" />
                        </span>
                        <span className="text-xs text-muted-foreground">Высокий риск</span>
                    </div>
                    <div className="h-8 w-px bg-border" />
                    <div className="flex flex-col">
                        <span className="text-2xl font-bold text-orange-600">
                            {data.atRisk}
                        </span>
                        <span className="text-xs text-muted-foreground">Средний риск</span>
                    </div>
                    <div className="h-8 w-px bg-border" />
                    <div className="flex flex-col">
                        <span className="text-2xl font-bold text-green-600 flex items-center gap-2">
                            {data.ok}
                            <CheckCircle className="h-4 w-4" />
                        </span>
                        <span className="text-xs text-muted-foreground">Норма</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

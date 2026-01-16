'use client';

import { useState } from 'react';
import { useAnalyticsOverview, useTasksByDay, useProblemPatients } from '@/hooks/useAnalytics';
import { AnalyticsOverviewCards } from '@/components/analytics/AnalyticsOverviewCards';
import { TasksChart } from '@/components/analytics/TasksChart';
import { ProblemPatientsTable } from '@/components/analytics/ProblemPatientsTable';
import { AnalyticsEngagementCard } from '@/components/analytics/AnalyticsEngagementCard';
import { DailySummaryWidget } from '@/components/analytics/DailySummaryWidget';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { subDays, format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

export default function AnalyticsPage() {
    const [period, setPeriod] = useState<string>('7'); // '7' | '30'

    // Calculate dates
    const to = format(new Date(), 'yyyy-MM-dd');
    const from = format(subDays(new Date(), Number(period)), 'yyyy-MM-dd');

    const filters = { from, to };

    const { data: overview, isLoading: overviewLoading } = useAnalyticsOverview(filters);
    const { data: tasksByDay, isLoading: chartsLoading } = useTasksByDay(filters);
    const { data: problemPatients, isLoading: patientsLoading } = useProblemPatients();

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Аналитика</h2>
                <div className="flex items-center space-x-2">
                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Период" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7">Последние 7 дней</SelectItem>
                            <SelectItem value="30">Последние 30 дней</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Daily Summary Widget (New) */}
            <DailySummaryWidget />

            {/* Overview Cards */}
            {overviewLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-[120px] rounded-xl" />
                    ))}
                </div>
            ) : overview && (
                <AnalyticsOverviewCards data={overview} />
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-4">
                <AnalyticsEngagementCard />
            </div>

            <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
                {/* Main Chart */}
                <div className="col-span-1 lg:col-span-4">
                    {chartsLoading ? (
                        <Skeleton className="h-[400px] w-full rounded-xl" />
                    ) : tasksByDay && (
                        <TasksChart data={tasksByDay} />
                    )}
                </div>

                {/* Problem Patients */}
                <div className="col-span-1 lg:col-span-3">
                    {patientsLoading ? (
                        <Skeleton className="h-[400px] w-full rounded-xl" />
                    ) : problemPatients && (
                        <ProblemPatientsTable data={problemPatients} />
                    )}
                </div>
            </div>
        </div>
    );
}

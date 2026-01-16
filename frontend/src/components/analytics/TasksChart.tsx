'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskByDay } from "@/api/analytics.api";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts";

export function TasksChart({ data }: { data: TaskByDay[] }) {
    if (!data || data.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Динамика задач</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Нет данных за выбранный период
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Динамика задач (Открыто vs Закрыто)</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data}>
                            <XAxis
                                dataKey="date"
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => value.slice(5)} // Show MM-DD
                            />
                            <YAxis
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `${value}`}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'white', borderRadius: '8px' }}
                            />
                            <Legend />
                            <Bar dataKey="open" name="Новые" fill="#adfa1d" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="done" name="Закрытые" fill="#2563eb" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}

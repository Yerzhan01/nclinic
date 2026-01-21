'use client';

import { useAlerts } from '@/hooks/useAlerts';
import { useTasks } from '@/hooks/useTasks';
import { usePatients } from '@/hooks/usePatients';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    AlertTriangle,
    CheckSquare,
    Users,
    Activity,
    ArrowRight,
    Sparkles,
    Plus,
    Calendar,
    Settings
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
    const { data: alerts = [] } = useAlerts();
    const { data: tasks = [] } = useTasks();
    const { data: patients = [] } = usePatients();

    const openAlerts = alerts.filter((a) => a.status !== 'RESOLVED');
    const openTasks = tasks.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS');
    const criticalAlerts = openAlerts.filter((a) => a.level === 'CRITICAL' || a.level === 'HIGH');
    const activePatients = patients.length || 0;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Welcome Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-600 p-8 text-white shadow-xl">
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2 opacity-90">
                        <Sparkles className="h-5 w-5 text-yellow-300" />
                        <span className="text-sm font-medium tracking-wide uppercase">Панель управления</span>
                    </div>
                    <h1 className="text-4xl font-bold mb-4 tracking-tight">Добро пожаловать в NEO CLINIC AI</h1>
                    <p className="max-w-xl text-indigo-100 text-lg">
                        Система сопровождения работает штатно. AI-ассистенты активны и мониторят состояние пациентов в реальном времени.
                    </p>

                    <div className="mt-8 flex gap-3">
                        <Link href="/patients">
                            <Button size="lg" variant="secondary" className="shadow-lg hover:shadow-xl transition-all">
                                <Users className="mr-2 h-4 w-4" />
                                Список пациентов
                            </Button>
                        </Link>
                        <Link href="/tasks">
                            <Button size="lg" variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm">
                                <CheckSquare className="mr-2 h-4 w-4" />
                                Мои задачи
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Decorative Circles */}
                <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-white/10 blur-3xl rounded-full pointer-events-none" />
                <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-blue-500/20 blur-2xl rounded-full pointer-events-none" />
            </div>

            {/* Quick Stats Grid */}
            <div className="grid gap-6 md:grid-cols-3">
                <Link href="/alerts" className="block group">
                    <Card className="h-full border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-orange-600 transition-colors">
                                Активные алерты
                            </CardTitle>
                            <div className="p-2 bg-orange-100 rounded-full group-hover:bg-orange-200 transition-colors">
                                <AlertTriangle className="h-4 w-4 text-orange-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-extrabold text-slate-800">{openAlerts.length}</div>
                            {criticalAlerts.length > 0 ? (
                                <Badge variant="destructive" className="mt-2 animate-pulse">
                                    {criticalAlerts.length} критичных
                                </Badge>
                            ) : (
                                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                    <Activity className="h-3 w-3" /> Все спокойно
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/tasks" className="block group">
                    <Card className="h-full border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-blue-600 transition-colors">
                                Мои задачи
                            </CardTitle>
                            <div className="p-2 bg-blue-100 rounded-full group-hover:bg-blue-200 transition-colors">
                                <CheckSquare className="h-4 w-4 text-blue-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-extrabold text-slate-800">{openTasks.length}</div>
                            <p className="text-xs text-muted-foreground mt-2">
                                Активных к выполнению
                            </p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/patients" className="block group">
                    <Card className="h-full border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground group-hover:text-emerald-600 transition-colors">
                                Пациенты
                            </CardTitle>
                            <div className="p-2 bg-emerald-100 rounded-full group-hover:bg-emerald-200 transition-colors">
                                <Users className="h-4 w-4 text-emerald-600" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-extrabold text-slate-800">{activePatients}</div>
                            <p className="text-xs text-muted-foreground mt-2">
                                Под наблюдением
                            </p>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            {/* Bottom Grid: Critical Alerts & Quick Features */}
            <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-t-4 border-t-red-500 shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <div className="p-1.5 bg-red-100 rounded-lg">
                                <AlertTriangle className="h-5 w-5 text-red-600" />
                            </div>
                            Критичные события
                        </CardTitle>
                        <CardDescription>Требуют немедленного внимания</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {criticalAlerts.length > 0 ? (
                            <div className="space-y-3">
                                {criticalAlerts.slice(0, 5).map((alert) => (
                                    <Link
                                        key={alert.id}
                                        href={`/patients/${alert.patientId}`}
                                        className="flex items-center justify-between p-4 rounded-xl bg-red-50 hover:bg-red-100 border border-red-100 transition-colors group"
                                    >
                                        <div>
                                            <p className="font-semibold text-slate-800 group-hover:text-red-700 transition-colors">{alert.title}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {alert.patient?.fullName || 'Пациент'}
                                            </p>
                                        </div>
                                        <Badge variant={alert.level === 'CRITICAL' ? 'destructive' : 'outline'} className="shadow-sm">
                                            {alert.level === 'CRITICAL' ? 'Критический' : alert.level === 'HIGH' ? 'Высокий' : alert.level === 'MEDIUM' ? 'Средний' : 'Низкий'}
                                        </Badge>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground bg-slate-50/50 rounded-xl border border-dashed">
                                <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                                    <CheckSquare className="h-6 w-6 text-slate-400" />
                                </div>
                                <p>Критических алертов нет</p>
                                <p className="text-xs">Система работает стабильно</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <div className="p-1.5 bg-indigo-100 rounded-lg">
                                <Settings className="h-5 w-5 text-indigo-600" />
                            </div>
                            Быстрые действия
                        </CardTitle>
                        <CardDescription>Управление системой</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3">
                        <Link href="/settings/programs/template-42" className="flex items-center gap-4 p-4 rounded-xl border hover:border-indigo-200 hover:bg-indigo-50 transition-all group">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Calendar className="h-5 w-5 text-blue-600" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-medium text-slate-900">Редактор программ</h4>
                                <p className="text-xs text-muted-foreground">Настроить расписание 'Трансформация'</p>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                        </Link>

                        <div className="flex items-center gap-4 p-4 rounded-xl border border-dashed bg-slate-50/50 opacity-60 cursor-not-allowed">
                            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                                <Plus className="h-5 w-5 text-slate-400" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-medium text-slate-900">Добавить пациента</h4>
                                <p className="text-xs text-muted-foreground">В разработке (используйте админку)</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

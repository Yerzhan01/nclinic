'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    Users,
    AlertTriangle,
    CheckSquare,
    Settings,
    LayoutDashboard,
    Sparkles,
    BarChart2,
    Link2,
    FileText,
    ChevronDown,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Navigation groups
const navigationGroups = [
    {
        label: 'Основное',
        items: [
            { name: 'Дашборд', href: '/', icon: LayoutDashboard },
            { name: 'Пациенты', href: '/patients', icon: Users },
            { name: 'Задачи', href: '/tasks', icon: CheckSquare, badge: 'tasks' },
        ],
    },
    {
        label: 'Мониторинг',
        items: [
            { name: 'Алерты', href: '/alerts', icon: AlertTriangle, badge: 'alerts' },
            { name: 'Аналитика', href: '/analytics', icon: BarChart2 },
        ],
    },
    {
        label: 'Настройки',
        items: [
            { name: 'Интеграции', href: '/integrations', icon: Link2 },
            { name: 'Программы', href: '/settings/programs', icon: FileText },
            { name: 'AI Ассистент', href: '/settings/ai', icon: Sparkles },
        ],
    },
];

export function Sidebar() {
    const pathname = usePathname();

    // Fetch counts for badges
    const { data: alertsCount = 0 } = useQuery({
        queryKey: ['alerts-count'],
        queryFn: async () => {
            try {
                const response = await api.get('/alerts?limit=1');
                return response.data?.data?.length || 0;
            } catch {
                return 0;
            }
        },
        refetchInterval: 30000, // Refresh every 30 seconds
    });

    const { data: tasksCount = 0 } = useQuery({
        queryKey: ['tasks-count'],
        queryFn: async () => {
            try {
                const response = await api.get('/tasks?status=OPEN&limit=1');
                return response.data?.data?.length || 0;
            } catch {
                return 0;
            }
        },
        refetchInterval: 30000,
    });

    const getBadgeCount = (type: string) => {
        if (type === 'alerts') return alertsCount > 0 ? alertsCount : null;
        if (type === 'tasks') return tasksCount > 0 ? tasksCount : null;
        return null;
    };

    return (
        <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-gradient-to-b from-background to-muted/30">
            {/* Logo Header */}
            <div className="flex h-16 items-center border-b px-6 bg-gradient-to-r from-primary/10 to-primary/5">
                <Link href="/" className="flex items-center gap-3">
                    <img src="/logo.png" alt="NEO CLINIC" className="h-10 w-auto" />
                    <span className="text-xs text-muted-foreground">Система<br />сопровождения</span>
                </Link>
            </div>

            {/* Navigation Groups */}
            <nav className="flex flex-col p-4 space-y-6">
                {navigationGroups.map((group) => (
                    <div key={group.label} className="mt-2">
                        {/* Group Label */}
                        <div className="px-4 mb-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-80">
                                {group.label}
                            </span>
                        </div>

                        {/* Group Items */}
                        <div className="space-y-0.5">
                            {group.items.map((item) => {
                                const isActive =
                                    pathname === item.href ||
                                    (item.href !== '/' && pathname.startsWith(item.href));

                                const badgeCount = item.badge ? getBadgeCount(item.badge) : null;

                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        className={cn(
                                            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative',
                                            isActive
                                                ? 'bg-blue-50 text-blue-700'
                                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                        )}
                                    >
                                        {isActive && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r-full" />
                                        )}

                                        <div className={cn(
                                            "transition-colors",
                                            isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                                        )}>
                                            <item.icon className="h-5 w-5" />
                                        </div>
                                        <span className="flex-1">{item.name}</span>
                                        {badgeCount && (
                                            <span className={cn(
                                                "min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center",
                                                item.badge === 'alerts'
                                                    ? "bg-red-500 text-white shadow-sm shadow-red-200"
                                                    : "bg-orange-500 text-white"
                                            )}>
                                                {badgeCount > 9 ? '9+' : badgeCount}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-muted/50">
                <div className="flex items-center gap-3 px-3 py-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">A</span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">Админ</p>
                        <p className="text-xs text-muted-foreground">Администратор</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}

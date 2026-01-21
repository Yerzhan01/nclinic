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
                    <div>
                        <span className="font-bold text-lg block leading-tight">NEO CLINIC</span>
                        <span className="text-xs text-muted-foreground">Система сопровождения</span>
                    </div>
                </Link>
            </div>

            {/* Navigation Groups */}
            <nav className="flex flex-col p-4 space-y-6">
                {navigationGroups.map((group) => (
                    <div key={group.label}>
                        {/* Group Label */}
                        <div className="flex items-center gap-2 px-3 mb-2">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                {group.label}
                            </span>
                            <div className="flex-1 h-px bg-border" />
                        </div>

                        {/* Group Items */}
                        <div className="space-y-1">
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
                                            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 group',
                                            isActive
                                                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                                                : 'text-muted-foreground hover:bg-accent hover:text-foreground hover:translate-x-1'
                                        )}
                                    >
                                        <div className={cn(
                                            "p-1.5 rounded-md transition-colors",
                                            isActive
                                                ? "bg-primary-foreground/20"
                                                : "bg-muted group-hover:bg-accent"
                                        )}>
                                            <item.icon className="h-4 w-4" />
                                        </div>
                                        <span className="flex-1">{item.name}</span>
                                        {badgeCount && (
                                            <span className={cn(
                                                "min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center",
                                                item.badge === 'alerts'
                                                    ? "bg-destructive text-destructive-foreground animate-pulse"
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

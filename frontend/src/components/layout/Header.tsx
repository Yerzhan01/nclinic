'use client';

import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function Header() {
    const { user, logout } = useAuthStore();
    const router = useRouter();

    const handleLogout = () => {
        logout();
        router.push('/auth/login');
    };

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-6">
            <div className="flex items-center gap-4">
                <h1 className="text-lg font-semibold">Система сопровождения пациентов</h1>
            </div>

            <div className="flex items-center gap-4">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-2">
                            <User className="h-4 w-4" />
                            <span>{user?.fullName || 'Пользователь'}</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                            <LogOut className="h-4 w-4 mr-2" />
                            Выйти
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

import { useWebSocket } from '@/hooks/useWebSocket';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const { isAuthenticated, loadMe } = useAuthStore();
    const [isLoading, setIsLoading] = useState(true);

    // Initialize WebSocket connection
    useWebSocket();

    useEffect(() => {
        const checkAuth = async () => {
            // Check localStorage for token
            const token = localStorage.getItem('accessToken');
            if (!token) {
                router.push('/auth/login');
                return;
            }

            // Verify token is valid
            await loadMe();
            setIsLoading(false);
        };

        checkAuth();
    }, [loadMe, router]);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push('/auth/login');
        }
    }, [isLoading, isAuthenticated, router]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="min-h-screen bg-muted/30">
            <Sidebar />
            <div className="ml-64">
                <Header />
                <main className="p-6">{children}</main>
            </div>
        </div>
    );
}

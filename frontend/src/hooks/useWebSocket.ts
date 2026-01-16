import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useWebSocket() {
    const { isAuthenticated } = useAuthStore();
    const queryClient = useQueryClient();
    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!isAuthenticated) return;

        const connect = () => {
            const token = localStorage.getItem('accessToken');
            if (!token) return;

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? '' : 'http://localhost:3000/api/v1');
            // Handle both http and https for ws/wss
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            // If apiUrl is absolute, parse it to get host/path
            let wsUrl = '';

            try {
                const url = new URL(apiUrl);
                // Use the host from API_URL, but WebSocket protocol
                const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
                wsUrl = `${protocol}//${url.host}${url.pathname}/ws?token=${token}`;
            } catch (e) {
                // Fallback if API_URL is relative or missing
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                wsUrl = `${protocol}//${window.location.host}/api/v1/ws?token=${token}`;
            }

            console.log('Connecting WS:', wsUrl);
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.log('WS Connected');
            };

            ws.onmessage = (event) => {
                try {
                    const { type, payload } = JSON.parse(event.data);

                    if (type === 'NEW_MESSAGE' || type === 'MESSAGE_UPDATED') {
                        // Invalidate specific patient messages
                        if (payload.patientId) {
                            queryClient.invalidateQueries({ queryKey: ['messages', payload.patientId] });
                            // Invalidate patient list (last message preview)
                            if (type === 'NEW_MESSAGE') {
                                queryClient.invalidateQueries({ queryKey: ['patients'] });
                                // Invalidate alerts/tasks if needed
                                queryClient.invalidateQueries({ queryKey: ['active-program', payload.patientId] });
                            }
                        }
                    }
                } catch (e) {
                    console.error('WS Parse Error', e);
                }
            };

            ws.onclose = (event) => {
                console.log('WS Disconnected', event.code, event.reason);
                // Reconnect if not closed cleanly (4xxx usually means auth error)
                if (event.code !== 1000 && event.code !== 1008) {
                    reconnectTimeoutRef.current = setTimeout(connect, 3000);
                }
            };

            ws.onerror = (error) => {
                console.error('WS Error', error);
                ws.close();
            };

            socketRef.current = ws;
        };

        connect();

        return () => {
            if (socketRef.current) {
                socketRef.current.close(1000, 'Unmount');
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [isAuthenticated, queryClient]);
}

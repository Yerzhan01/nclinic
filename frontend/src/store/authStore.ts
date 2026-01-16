import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';
import type { User, ApiResponse, LoginResponse } from '@/types/api';

interface AuthState {
    accessToken: string | null;
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    loadMe: () => Promise<void>;
    logout: () => void;
    setToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            accessToken: null,
            user: null,
            isAuthenticated: false,
            isLoading: false,

            login: async (email: string, password: string) => {
                set({ isLoading: true });
                try {
                    const response = await api.post<ApiResponse<LoginResponse>>('/auth/login', {
                        email,
                        password,
                    });

                    if (response.data.success && response.data.data) {
                        const { accessToken, user } = response.data.data;
                        localStorage.setItem('accessToken', accessToken);
                        set({
                            accessToken,
                            user,
                            isAuthenticated: true,
                            isLoading: false,
                        });
                    } else {
                        throw new Error(response.data.error || 'Login failed');
                    }
                } catch (error) {
                    set({ isLoading: false });
                    throw error;
                }
            },

            loadMe: async () => {
                const token = get().accessToken;
                if (!token) {
                    set({ isAuthenticated: false, user: null });
                    return;
                }

                try {
                    const response = await api.get<ApiResponse<User>>('/auth/me');
                    if (response.data.success && response.data.data) {
                        set({ user: response.data.data, isAuthenticated: true });
                    }
                } catch {
                    // Token invalid, clear state
                    get().logout();
                }
            },

            logout: () => {
                localStorage.removeItem('accessToken');
                set({
                    accessToken: null,
                    user: null,
                    isAuthenticated: false,
                });
            },

            setToken: (token: string) => {
                localStorage.setItem('accessToken', token);
                set({ accessToken: token, isAuthenticated: true });
            },
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                accessToken: state.accessToken,
                user: state.user,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
);

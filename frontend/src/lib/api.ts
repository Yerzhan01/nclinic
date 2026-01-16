import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse } from '@/types/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        // Get token from localStorage (client-side only)
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('accessToken');
            if (token && config.headers) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error: AxiosError<ApiResponse<unknown>>) => {
        // Handle 401 - redirect to login
        if (error.response?.status === 401) {
            if (typeof window !== 'undefined') {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('user');
                // Only redirect if not already on login page
                if (!window.location.pathname.includes('/auth/login')) {
                    window.location.href = '/auth/login';
                }
            }
        }
        return Promise.reject(error);
    }
);

// Helper function to extract error message
export function getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        return error.response?.data?.error || error.message || 'Произошла ошибка';
    }
    if (error instanceof Error) {
        return error.message;
    }
    return 'Произошла ошибка';
}

"use client";

import { useEffect } from 'react';
import { initializeAuth } from '@/lib/api';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        // Initialize authentication when the app loads
        initializeAuth();
    }, []);

    return <>{children}</>;
} 
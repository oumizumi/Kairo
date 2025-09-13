import { useState, useEffect } from 'react';
import { getToken, removeTokens } from './api';

export function useAuth() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const token = getToken();
        setIsAuthenticated(!!token);
        setIsLoading(false);
    }, []);

    const logout = () => {
        removeTokens();
        setIsAuthenticated(false);
    };

    const setAuthenticated = (status: boolean) => {
        setIsAuthenticated(status);
    };

    return {
        isAuthenticated,
        isLoading,
        logout,
        setAuthenticated
    };
} 
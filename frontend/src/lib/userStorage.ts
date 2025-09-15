/**
 * User-specific localStorage utilities
 * Ensures data isolation between different user accounts
 */

import { getToken, getGuestSessionId, isGuest } from './api';

/**
 * Get user-specific identifier for localStorage keys
 * Returns either user ID (for authenticated users) or guest session ID
 */
export function getUserId(): string {
    if (typeof window === 'undefined') {
        return 'default';
    }

    const token = getToken();
    if (token && !isGuest()) {
        try {
            // Decode JWT token to get user ID
            const payload = JSON.parse(atob(token.split('.')[1]));
            return `user_${payload.user_id || payload.sub || 'unknown'}`;
        } catch (error) {
            console.warn('Failed to decode token for user ID:', error);
        }
    }

    // For guest users or when token decode fails
    const guestId = getGuestSessionId();
    return `guest_${guestId || 'default'}`;
}

/**
 * Get user-specific localStorage key
 */
export function getUserStorageKey(baseKey: string): string {
    const userId = getUserId();
    return `${baseKey}:${userId}`;
}

/**
 * Get user-specific localStorage item
 */
export function getUserStorageItem(baseKey: string): string | null {
    if (typeof window === 'undefined') {
        return null;
    }
    
    const userKey = getUserStorageKey(baseKey);
    return localStorage.getItem(userKey);
}

/**
 * Set user-specific localStorage item
 */
export function setUserStorageItem(baseKey: string, value: string): void {
    if (typeof window === 'undefined') {
        return;
    }
    
    const userKey = getUserStorageKey(baseKey);
    localStorage.setItem(userKey, value);
}

/**
 * Remove user-specific localStorage item
 */
export function removeUserStorageItem(baseKey: string): void {
    if (typeof window === 'undefined') {
        return;
    }
    
    const userKey = getUserStorageKey(baseKey);
    localStorage.removeItem(userKey);
}

/**
 * Clear all localStorage items for current user
 */
export function clearUserStorage(): void {
    if (typeof window === 'undefined') {
        return;
    }
    
    const userId = getUserId();
    const keysToRemove: string[] = [];
    
    // Find all keys that belong to this user
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.endsWith(`:${userId}`)) {
            keysToRemove.push(key);
        }
    }
    
    // Remove all user-specific keys
    keysToRemove.forEach(key => localStorage.removeItem(key));
}

/**
 * Migrate old localStorage data to user-specific keys
 * Call this when user logs in to preserve their existing data
 */
export function migrateToUserStorage(baseKeys: string[]): void {
    if (typeof window === 'undefined') {
        return;
    }
    
    const userId = getUserId();
    
    baseKeys.forEach(baseKey => {
        const oldValue = localStorage.getItem(baseKey);
        if (oldValue) {
            const newKey = getUserStorageKey(baseKey);
            // Only migrate if new key doesn't exist
            if (!localStorage.getItem(newKey)) {
                localStorage.setItem(newKey, oldValue);
            }
            // Remove old key to avoid confusion
            localStorage.removeItem(baseKey);
        }
    });
}

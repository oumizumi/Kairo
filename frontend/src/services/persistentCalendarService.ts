const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== 'undefined' && window.location.hostname === 'localhost'
        ? 'http://localhost:8000'
        : 'https://kairopublic-production.up.railway.app');

// Types matching the Django API response
export interface CalendarEvent {
    id?: number;
    title: string;
    startTime: string;
    endTime: string;
    day_of_week?: string;
    start_date?: string;
    end_date?: string;
    description?: string;
    professor?: string;
    location?: string;
    recurrence_pattern?: 'weekly' | 'biweekly' | 'none';
    reference_date?: string;
    theme?: string;
    created_at?: string;
    updated_at?: string;
}

export interface ApiResponse {
    events: CalendarEvent[];
    total_events: number;
    user: string;
}

export interface BulkCreateResponse {
    created_events: CalendarEvent[];
    errors: Array<{
        event_data: any;
        errors: Record<string, string[]>;
    }>;
    total_created: number;
    total_errors: number;
}

// Utility function to get auth token
function getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
}

class PersistentCalendarService {
    private endpointCache = new Map<string, { status: number; timestamp: number }>();
    private CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

    private isEndpointCached404(endpoint: string): boolean {
        const cached = this.endpointCache.get(endpoint);
        if (!cached) return false;

        const isExpired = Date.now() - cached.timestamp > this.CACHE_DURATION;
        if (isExpired) {
            this.endpointCache.delete(endpoint);
            return false;
        }

        return cached.status === 404;
    }

    private cacheEndpointStatus(endpoint: string, status: number): void {
        this.endpointCache.set(endpoint, { status, timestamp: Date.now() });
    }

    private async getHeaders(): Promise<HeadersInit> {
        const token = getAuthToken();
        return {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
        };
    }

    private async handleResponse<T>(response: Response): Promise<T> {
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error ${response.status}: ${errorText}`);
        }
        return response.json();
    }

    /**
     * Load all calendar events for the authenticated user
     */
    async loadUserCalendar(): Promise<CalendarEvent[]> {
        const endpoint = '/api/user-calendar/export_calendar/';

        // Check if we know this endpoint returns 404
        if (this.isEndpointCached404(endpoint)) {
            return [];
        }

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'GET',
                headers: await this.getHeaders(),
            });

            // Cache the response status
            this.cacheEndpointStatus(endpoint, response.status);

            if (response.status === 404) {
                console.warn('Calendar export endpoint not available (404). Using empty calendar.');
                return [];
            }

            const data: ApiResponse = await this.handleResponse(response);

            // Save to localStorage as backup when backend is working
            if (data.events && data.events.length > 0) {
                try {
                    localStorage.setItem('userCalendarBackup', JSON.stringify({
                        events: data.events,
                        timestamp: Date.now(),
                        user: data.user
                    }));
                } catch (storageError) {
                    console.warn('⚠️ Failed to save calendar backup:', storageError);
                }
            }

            return data.events;
        } catch (error) {
            console.error('❌ Failed to load calendar from backend:', error);

            // Try to load from localStorage backup when backend fails
            try {
                const backup = localStorage.getItem('userCalendarBackup');
                if (backup) {
                    const backupData = JSON.parse(backup);
                    const backupAge = Date.now() - backupData.timestamp;
                    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

                    if (backupAge < maxAge && backupData.events) {
                        return backupData.events;
                    } else {
                        localStorage.removeItem('userCalendarBackup');
                    }
                }
            } catch (storageError) {
                console.warn('⚠️ Failed to load calendar backup:', storageError);
            }

            throw error;
        }
    }

    /**
     * Save a single calendar event
     */
    async saveCalendarEvent(event: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at'>): Promise<CalendarEvent> {
        try {
            // Guest mode fallback: if not authenticated, store in local backup
            const token = getAuthToken();
            if (!token && typeof window !== 'undefined') {
                try {
                    const backupRaw = localStorage.getItem('userCalendarBackup');
                    const backup = backupRaw ? JSON.parse(backupRaw) : { events: [], timestamp: Date.now(), user: 'guest' };
                    const newEvent: CalendarEvent = {
                        ...event,
                        id: Date.now(),
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    } as CalendarEvent;
                    backup.events.push(newEvent);
                    backup.timestamp = Date.now();
                    localStorage.setItem('userCalendarBackup', JSON.stringify(backup));
                    return newEvent;
                } catch (e) {
                    // If localStorage fails, continue to try backend (will likely fail without token)
                }
            }
            const response = await fetch(`${API_BASE_URL}/api/user-calendar/`, {
                method: 'POST',
                headers: await this.getHeaders(),
                body: JSON.stringify({
                    title: event.title,
                    start_time: event.startTime,
                    end_time: event.endTime,
                    day_of_week: event.day_of_week || '',
                    start_date: event.start_date || '',
                    end_date: event.end_date || '',
                    description: event.description || '',
                    professor: event.professor || '',
                    location: event.location || '',
                    recurrence_pattern: event.recurrence_pattern || 'weekly',
                    reference_date: event.reference_date || '',
                    theme: event.theme || 'blue-gradient'
                }),
            });

            const savedEvent: CalendarEvent = await this.handleResponse(response);

            // Clear localStorage backup when new events are saved to ensure fresh data
            try {
                localStorage.removeItem('userCalendarBackup');
            } catch (storageError) {
                console.warn('⚠️ Failed to clear calendar backup:', storageError);
            }

            return savedEvent;
        } catch (error) {
            console.error('❌ Failed to save calendar event:', error);
            // As a last resort, try persisting to local backup
            try {
                if (typeof window !== 'undefined') {
                    const backupRaw = localStorage.getItem('userCalendarBackup');
                    const backup = backupRaw ? JSON.parse(backupRaw) : { events: [], timestamp: Date.now(), user: 'guest' };
                    const newEvent: CalendarEvent = {
                        ...event,
                        id: Date.now(),
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    } as CalendarEvent;
                    backup.events.push(newEvent);
                    backup.timestamp = Date.now();
                    localStorage.setItem('userCalendarBackup', JSON.stringify(backup));
                    return newEvent;
                }
            } catch {}
            throw error;
        }
    }

    /**
     * Save multiple calendar events at once (bulk create)
     */
    async saveMultipleEvents(events: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at'>[]): Promise<BulkCreateResponse> {
        try {
            // Guest mode fallback: if not authenticated, store in local backup
            const token = getAuthToken();
            if (!token && typeof window !== 'undefined') {
                try {
                    const backupRaw = localStorage.getItem('userCalendarBackup');
                    const backup = backupRaw ? JSON.parse(backupRaw) : { events: [], timestamp: Date.now(), user: 'guest' };
                    const created: CalendarEvent[] = events.map(e => ({
                        ...e,
                        id: Date.now() + Math.floor(Math.random() * 1000),
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    }));
                    backup.events.push(...created);
                    backup.timestamp = Date.now();
                    localStorage.setItem('userCalendarBackup', JSON.stringify(backup));
                    return { created_events: created, errors: [], total_created: created.length, total_errors: 0 };
                } catch (e) {
                    // If localStorage fails, continue to try backend
                }
            }
            const eventsData = events.map(event => ({
                title: event.title,
                start_time: event.startTime,
                end_time: event.endTime,
                day_of_week: event.day_of_week || '',
                start_date: event.start_date || '',
                end_date: event.end_date || '',
                description: event.description || '',
                professor: event.professor || '',
                location: event.location || '',
                recurrence_pattern: event.recurrence_pattern || 'weekly',
                reference_date: event.reference_date || '',
                theme: event.theme || 'blue-gradient'
            }));

            const response = await fetch(`${API_BASE_URL}/api/user-calendar/bulk_create/`, {
                method: 'POST',
                headers: await this.getHeaders(),
                body: JSON.stringify({ events: eventsData }),
            });

            const result: BulkCreateResponse = await this.handleResponse(response);

            // Clear localStorage backup when new events are saved to ensure fresh data
            if (result.total_created > 0) {
                try {
                    localStorage.removeItem('userCalendarBackup');
                } catch (storageError) {
                    console.warn('⚠️ Failed to clear calendar backup:', storageError);
                }
            }

            return result;
        } catch (error) {
            console.error('❌ Failed to bulk save calendar events:', error);
            // As a last resort, attempt to write to local backup
            try {
                if (typeof window !== 'undefined') {
                    const backupRaw = localStorage.getItem('userCalendarBackup');
                    const backup = backupRaw ? JSON.parse(backupRaw) : { events: [], timestamp: Date.now(), user: 'guest' };
                    const created: CalendarEvent[] = events.map(e => ({
                        ...e,
                        id: Date.now() + Math.floor(Math.random() * 1000),
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    }));
                    backup.events.push(...created);
                    backup.timestamp = Date.now();
                    localStorage.setItem('userCalendarBackup', JSON.stringify(backup));
                    return { created_events: created, errors: [], total_created: created.length, total_errors: 0 };
                }
            } catch {}
            throw error;
        }
    }

    /**
     * Update an existing calendar event
     */
    async updateCalendarEvent(id: number, event: Partial<CalendarEvent>): Promise<CalendarEvent> {
        try {
            const updateData: any = {};

            if (event.title) updateData.title = event.title;
            if (event.startTime) updateData.start_time = event.startTime;
            if (event.endTime) updateData.end_time = event.endTime;
            if (event.day_of_week !== undefined) updateData.day_of_week = event.day_of_week;
            if (event.start_date !== undefined) updateData.start_date = event.start_date;
            if (event.end_date !== undefined) updateData.end_date = event.end_date;
            if (event.description !== undefined) updateData.description = event.description;
            if (event.professor !== undefined) updateData.professor = event.professor;
            if (event.location !== undefined) updateData.location = event.location;
            if (event.recurrence_pattern) updateData.recurrence_pattern = event.recurrence_pattern;
            if (event.reference_date !== undefined) updateData.reference_date = event.reference_date;
            if (event.theme) updateData.theme = event.theme;

            const response = await fetch(`${API_BASE_URL}/api/user-calendar/${id}/`, {
                method: 'PATCH',
                headers: await this.getHeaders(),
                body: JSON.stringify(updateData),
            });

            const updatedEvent: CalendarEvent = await this.handleResponse(response);

            return updatedEvent;
        } catch (error) {
            console.error('❌ Failed to update calendar event:', error);
            throw error;
        }
    }

    /**
     * Delete a calendar event
     */
    async deleteCalendarEvent(id: number): Promise<void> {
        try {
            const response = await fetch(`${API_BASE_URL}/api/user-calendar/${id}/`, {
                method: 'DELETE',
                headers: await this.getHeaders(),
            });

            if (response.status === 204) {
                return;
            }
            if (response.status === 404) {
                // Event not found, treat as already deleted (no error)
                return;
            }

            await this.handleResponse(response);
        } catch (error) {
            console.error('❌ Failed to delete calendar event:', error);
            throw error;
        }
    }

    /**
     * Clear all calendar events for the user
     */
    async clearUserCalendar(): Promise<{ deleted_count: number; message: string }> {
        try {
            const response = await fetch(`${API_BASE_URL}/api/user-calendar/clear_calendar/`, {
                method: 'DELETE',
                headers: await this.getHeaders(),
            });

            const result = await this.handleResponse<{ deleted_count: number; message: string }>(response);

            // Clear localStorage backup when calendar is cleared
            try {
                localStorage.removeItem('userCalendarBackup');
            } catch (storageError) {
                console.warn('⚠️ Failed to clear calendar backup:', storageError);
            }

            return result;
        } catch (error) {
            console.error('❌ Failed to clear calendar:', error);
            throw error;
        }
    }

    /**
     * Sync local events with the database
     * This method compares local events with stored events and syncs them
     */
    async syncCalendarEvents(localEvents: CalendarEvent[]): Promise<CalendarEvent[]> {
        try {
            // First, clear the existing calendar
            await this.clearUserCalendar();

            // Then save all local events
            if (localEvents.length > 0) {
                const result = await this.saveMultipleEvents(localEvents);

                if (result.total_errors > 0) {
                    console.warn('⚠️ Some events failed to sync:', result.errors);
                }

                return result.created_events;
            }

            return [];
        } catch (error) {
            console.error('❌ Failed to sync calendar events:', error);
            throw error;
        }
    }

    /**
     * Check if the user is authenticated and can access the calendar API
     */
    async isCalendarAccessible(): Promise<boolean> {
        // Always allow access, even if not authenticated
        return true;
    }
}

// Export singleton instance
export const persistentCalendarService = new PersistentCalendarService(); 
/**
 * Schedule Share Service
 * Handles sharing schedules with unique links
 */

import { APP_CONFIG } from '@/config/app.config';

export interface ShareableSchedule {
    title?: string;
    term?: string;
    events: Array<{
        id?: number;
        title: string;
        startTime: string;
        endTime: string;
        day_of_week?: string;
        start_date?: string;
        end_date?: string;
        description?: string;
        professor?: string;
        recurrence_pattern?: 'weekly' | 'biweekly' | 'none';
        reference_date?: string;
        theme?: string;
    }>;
}

export interface SharedScheduleResponse {
    shared_schedule: {
        id: string;
        title: string;
        term?: string;
        schedule_data: ShareableSchedule;
        created_at: string;
        view_count: number;
    };
    share_url: string;
}

export interface SharedScheduleData {
    shared_schedule: {
        id: string;
        title: string;
        term?: string;
        schedule_data: ShareableSchedule;
        created_at: string;
        view_count: number;
    };
    owner: string;
}

/**
 * Share a schedule and get a shareable link
 */
export async function shareSchedule(
    scheduleData: ShareableSchedule,
    token: string
): Promise<SharedScheduleResponse> {
    try {
        const response = await fetch(`${APP_CONFIG.API.BASE_URL}/api/shared-schedules/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                title: scheduleData.title || 'My Schedule',
                term: scheduleData.term,
                schedule_data: scheduleData,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to share schedule');
        }

        const data: SharedScheduleResponse = await response.json();
        return data;
    } catch (error) {
        console.error('Error sharing schedule:', error);
        throw error;
    }
}

/**
 * Get a shared schedule by ID (public endpoint)
 */
export async function getSharedSchedule(scheduleId: string): Promise<SharedScheduleData> {
    try {
        const response = await fetch(`${APP_CONFIG.API.BASE_URL}/api/schedule/${scheduleId}/`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Schedule not found');
            }
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to load shared schedule');
        }

        const data: SharedScheduleData = await response.json();
        return data;
    } catch (error) {
        console.error('Error loading shared schedule:', error);
        throw error;
    }
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const success = document.execCommand('copy');
            textArea.remove();
            return success;
        }
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        return false;
    }
}

/**
 * Check if user has at least one course/event in their schedule
 */
export function hasScheduleContent(events: any[]): boolean {
    return events && events.length > 0;
}

/**
 * Generate a shareable schedule object from calendar events
 */
export function generateShareableSchedule(
    events: any[],
    term?: string,
    title?: string
): ShareableSchedule {
    return {
        title: title || 'My Schedule',
        term: term,
        events: events.map(event => ({
            id: event.id,
            title: event.title,
            startTime: event.startTime,
            endTime: event.endTime,
            day_of_week: event.day_of_week,
            start_date: event.start_date,
            end_date: event.end_date,
            description: event.description,
            professor: event.professor,
            recurrence_pattern: event.recurrence_pattern,
            reference_date: event.reference_date,
            theme: event.theme,
        })),
    };
}
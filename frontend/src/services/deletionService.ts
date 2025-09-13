import { dynamicClassificationService } from '@/lib/dynamicClassificationService';

interface DeletionRequest {
    type: 'course' | 'event' | 'all';
    target?: string; // course code or event ID
    message?: string; // natural language deletion request
}

interface DeletionResult {
    success: boolean;
    message: string;
    deletedCount: number;
    errors: string[];
}

class DeletionService {
    private currentlyDeleting = new Set<string>(); // Track what's being deleted to prevent duplicates
    private pendingDeletions = new Map<string, Promise<any>>(); // Track ongoing deletions

    async handleDeletionRequest(request: DeletionRequest): Promise<DeletionResult> {
        // If this is a natural language request, use AI to understand intent
        if (request.message) {
            const classification = await dynamicClassificationService.classifyMessage(request.message);

            if (classification.intent === 'remove_course' || classification.intent === 'delete_course') {
                return this.deleteCourses(classification.course ? [classification.course] : []);
            } else if (request.message.toLowerCase().includes('all') || request.message.toLowerCase().includes('everything')) {
                return this.deleteAllCourses();
            }
        }

        // Handle specific deletion types
        switch (request.type) {
            case 'course':
                return this.deleteCourse(request.target!);
            case 'all':
                return this.deleteAllCourses();
            case 'event':
                return this.deleteEvent(parseInt(request.target!));
            default:
                return {
                    success: false,
                    message: "I didn't understand what you want to delete.",
                    deletedCount: 0,
                    errors: ["Invalid deletion request"]
                };
        }
    }

    private async deleteCourse(courseCode: string): Promise<DeletionResult> {
        const normalizedCode = courseCode.toUpperCase().replace(/\s+/g, ' ').trim();

        // Prevent duplicate deletions
        if (this.currentlyDeleting.has(normalizedCode)) {
            return {
                success: false,
                message: `${normalizedCode} is already being deleted.`,
                deletedCount: 0,
                errors: ["Deletion already in progress"]
            };
        }

        // Check if there's already a pending deletion for this course
        if (this.pendingDeletions.has(normalizedCode)) {
            const result = await this.pendingDeletions.get(normalizedCode);
            return result;
        }

        this.currentlyDeleting.add(normalizedCode);

        const deletionPromise = this.performCourseDeletion(normalizedCode);
        this.pendingDeletions.set(normalizedCode, deletionPromise);

        try {
            const result = await deletionPromise;
            return result;
        } finally {
            this.currentlyDeleting.delete(normalizedCode);
            this.pendingDeletions.delete(normalizedCode);
        }
    }

    private async deleteCourses(courseCodes: string[]): Promise<DeletionResult> {
        let totalDeleted = 0;
        let allErrors: string[] = [];
        let messages: string[] = [];

        for (const courseCode of courseCodes) {
            const result = await this.deleteCourse(courseCode);
            totalDeleted += result.deletedCount;
            allErrors.push(...result.errors);

            if (result.success && result.deletedCount > 0) {
                messages.push(`${courseCode}: course deleted`);
            } else if (!result.success) {
                messages.push(`${courseCode}: ${result.message}`);
            }
        }

        return {
            success: totalDeleted > 0,
            message: messages.length > 0 ? messages.join('\n') : `Deleted ${totalDeleted} total courses`,
            deletedCount: totalDeleted,
            errors: allErrors
        };
    }

    private async performCourseDeletion(courseCode: string): Promise<DeletionResult> {
        try {
            // Dynamic import to avoid circular dependencies
            const { getCalendarEvents, deleteCalendarEvent } = await import('@/lib/api');

            // Get all events
            const allEvents = await getCalendarEvents();

            // Find events for this course
            const courseEvents = allEvents.filter((event: any) => {
                const eventTitle = event.title || '';
                // Match course code in various formats (CSI 2110, CSI2110, etc.)
                const normalizedCourseCode = courseCode.replace(/\s+/g, '\\s*');
                const regex = new RegExp(`\\b${normalizedCourseCode}\\b`, 'i');
                return regex.test(eventTitle);
            });

            if (courseEvents.length === 0) {
                return {
                    success: false,
                    message: `No events found for ${courseCode}`,
                    deletedCount: 0,
                    errors: [`Course ${courseCode} not found in calendar`]
                };
            }

            // Delete all events for this course in parallel for faster deletion
            const deletionPromises = courseEvents.map(async (event: any) => {
                try {
                    await deleteCalendarEvent(event.id);
                    return { success: true, eventId: event.id };
                } catch (error) {
                    console.error(`Failed to delete event ${event.id}:`, error);
                    return { success: false, eventId: event.id, error };
                }
            });

            const deletionResults = await Promise.all(deletionPromises);
            const successfulDeletions = deletionResults.filter(r => r.success);
            const failedDeletions = deletionResults.filter(r => !r.success);

            // Trigger calendar refresh events
            successfulDeletions.forEach(result => {
                window.dispatchEvent(new CustomEvent('calendarEventDeleted', {
                    detail: { eventId: result.eventId }
                }));
            });

            // Global refresh for bulk deletion
            window.dispatchEvent(new CustomEvent('bulkCalendarDeletion', {
                detail: {
                    courseCode,
                    deletedCount: successfulDeletions.length,
                    failedCount: failedDeletions.length
                }
            }));

            return {
                success: successfulDeletions.length > 0,
                message: `Successfully removed course ${courseCode}`,
                deletedCount: successfulDeletions.length,
                errors: failedDeletions.map(f => `Failed to delete event ${f.eventId}`)
            };

        } catch (error) {
            console.error('Error in course deletion:', error);
            return {
                success: false,
                message: `Failed to delete ${courseCode}: ${error}`,
                deletedCount: 0,
                errors: [String(error)]
            };
        }
    }

    private async deleteEvent(eventId: number): Promise<DeletionResult> {
        const eventKey = `event-${eventId}`;

        // Prevent duplicate deletions
        if (this.currentlyDeleting.has(eventKey)) {
            return {
                success: false,
                message: "Event is already being deleted.",
                deletedCount: 0,
                errors: ["Deletion already in progress"]
            };
        }

        this.currentlyDeleting.add(eventKey);

        try {
            const { deleteCalendarEvent } = await import('@/lib/api');
            await deleteCalendarEvent(eventId);

            // Trigger deletion event
            window.dispatchEvent(new CustomEvent('calendarEventDeleted', {
                detail: { eventId }
            }));

            return {
                success: true,
                message: "Event deleted successfully",
                deletedCount: 1,
                errors: []
            };

        } catch (error) {
            console.error('Error deleting event:', error);
            return {
                success: false,
                message: `Failed to delete event: ${error}`,
                deletedCount: 0,
                errors: [String(error)]
            };
        } finally {
            this.currentlyDeleting.delete(eventKey);
        }
    }

    private async deleteAllCourses(): Promise<DeletionResult> {
        const allKey = 'all-courses';

        // Prevent duplicate full deletions
        if (this.currentlyDeleting.has(allKey)) {
            return {
                success: false,
                message: "All courses are already being deleted.",
                deletedCount: 0,
                errors: ["Deletion already in progress"]
            };
        }

        this.currentlyDeleting.add(allKey);

        try {
            const { getCalendarEvents, deleteCalendarEvent } = await import('@/lib/api');

            // Get all events
            const allEvents = await getCalendarEvents();

            if (allEvents.length === 0) {
                return {
                    success: true,
                    message: "No courses to delete",
                    deletedCount: 0,
                    errors: []
                };
            }

            // Delete all events in parallel
            const deletionPromises = allEvents.map(async (event: any) => {
                try {
                    await deleteCalendarEvent(event.id);
                    return { success: true, eventId: event.id };
                } catch (error) {
                    console.error(`Failed to delete event ${event.id}:`, error);
                    return { success: false, eventId: event.id, error };
                }
            });

            const deletionResults = await Promise.all(deletionPromises);
            const successfulDeletions = deletionResults.filter(r => r.success);
            const failedDeletions = deletionResults.filter(r => !r.success);

            // Trigger bulk deletion event
            window.dispatchEvent(new CustomEvent('bulkCalendarDeletion', {
                detail: {
                    courseCode: 'ALL',
                    deletedCount: successfulDeletions.length,
                    failedCount: failedDeletions.length
                }
            }));

            return {
                success: successfulDeletions.length > 0,
                message: successfulDeletions.length === allEvents.length
                    ? `Successfully removed all courses`
                    : `Removed ${successfulDeletions.length > 0 ? 'some' : 'no'} courses`,
                deletedCount: successfulDeletions.length,
                errors: failedDeletions.map(f => `Failed to delete event ${f.eventId}`)
            };

        } catch (error) {
            console.error('Error in bulk deletion:', error);
            return {
                success: false,
                message: `Failed to delete all events: ${error}`,
                deletedCount: 0,
                errors: [String(error)]
            };
        } finally {
            this.currentlyDeleting.delete(allKey);
        }
    }

    // Check if something is currently being deleted
    isDeletionInProgress(target?: string): boolean {
        if (!target) {
            return this.currentlyDeleting.size > 0;
        }
        return this.currentlyDeleting.has(target) || this.currentlyDeleting.has(`event-${target}`);
    }

    // Clear all pending deletions (useful for cleanup)
    clearPendingDeletions(): void {
        this.currentlyDeleting.clear();
        this.pendingDeletions.clear();
    }
}

export const deletionService = new DeletionService();
export type { DeletionRequest, DeletionResult }; 
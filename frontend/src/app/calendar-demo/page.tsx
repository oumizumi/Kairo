"use client";

import React, { useState } from 'react';
import { processCalendarEvents, createCalendarEventObject } from '@/lib/calendarUtils';
import { CalendarEvent } from '@/lib/api';

export default function CalendarDemo() {
    const [isLoading, setIsLoading] = useState(false);
    const [createdEvents, setCreatedEvents] = useState<CalendarEvent[]>([]);
    const [error, setError] = useState<string | null>(null);

    const handleCreatePHI2396Events = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Create the event objects as specified by the user
            const eventObjects = [
                {
                    "action": "create_calendar_event",
                    "params": {
                        "title": "PHI2396 Lecture",
                        "day_of_week": "Monday",
                        "start_time": "19:00",
                        "end_time": "21:00"
                    }
                },
                {
                    "action": "create_calendar_event",
                    "params": {
                        "title": "PHI2396 Lecture",
                        "day_of_week": "Wednesday",
                        "start_time": "19:00",
                        "end_time": "21:00"
                    }
                }
            ];

            const events = await processCalendarEvents(eventObjects);
            setCreatedEvents(events);

            // Show success message
            alert(`Successfully created ${events.length} calendar events for PHI2396 Lecture!`);

        } catch (err) {
            console.error('Error creating calendar events:', err);
            setError(err instanceof Error ? err.message : 'Failed to create calendar events');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateCustomEvent = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Example of using the helper function
            const customEvent = createCalendarEventObject(
                "Study Session",
                "Friday",
                "14:00",
                "16:00"
            );

            const events = await processCalendarEvents([customEvent]);
            setCreatedEvents(prev => [...prev, ...events]);

            alert(`Successfully created custom calendar event!`);

        } catch (err) {
            console.error('Error creating calendar events:', err);
            setError(err instanceof Error ? err.message : 'Failed to create calendar events');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white dark:bg-[#121212] p-4 sm:p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl sm:text-3xl font-bold text-black dark:text-white mb-6 sm:mb-8">
                    Calendar Event Creation Demo
                </h1>

                <div className="space-y-4 sm:space-y-6">
                    <div className="bg-gray-50 dark:bg-[#1e1e1e] p-4 sm:p-6 rounded-lg dark:shadow-[0_0_4px_rgba(255,255,255,0.05)]">
                        <h2 className="text-lg sm:text-xl font-semibold text-black dark:text-[#e0e0e0] mb-3 sm:mb-4">
                            PHI2396 Lecture Events
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-3 sm:mb-4 text-sm sm:text-base">
                            Create the PHI2396 lecture events for Monday and Wednesday from 7:00 PM to 9:00 PM.
                        </p>
                        <button
                            onClick={handleCreatePHI2396Events}
                            disabled={isLoading}
                            className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 sm:px-6 py-2 rounded-lg transition-colors duration-200 text-sm sm:text-base w-full sm:w-auto"
                        >
                            {isLoading ? 'Creating Events...' : 'Create PHI2396 Events'}
                        </button>
                    </div>

                    <div className="bg-gray-50 dark:bg-[#1e1e1e] p-4 sm:p-6 rounded-lg dark:shadow-[0_0_4px_rgba(255,255,255,0.05)]">
                        <h2 className="text-lg sm:text-xl font-semibold text-black dark:text-[#e0e0e0] mb-3 sm:mb-4">
                            Custom Event Example
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-3 sm:mb-4 text-sm sm:text-base">
                            Create a custom study session event for Friday from 2:00 PM to 4:00 PM.
                        </p>
                        <button
                            onClick={handleCreateCustomEvent}
                            disabled={isLoading}
                            className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white px-4 sm:px-6 py-2 rounded-lg transition-colors duration-200 text-sm sm:text-base w-full sm:w-auto"
                        >
                            {isLoading ? 'Creating Event...' : 'Create Custom Event'}
                        </button>
                    </div>

                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg">
                            <p className="text-red-600 dark:text-red-400">
                                Error: {error}
                            </p>
                        </div>
                    )}

                    {createdEvents.length > 0 && (
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-6 rounded-lg">
                            <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-4">
                                Created Events ({createdEvents.length})
                            </h3>
                            <div className="space-y-2">
                                {createdEvents.map((event, index) => (
                                    <div key={index} className="bg-white dark:bg-gray-800 p-3 rounded border">
                                        <div className="font-medium text-black dark:text-white">
                                            {event.title}
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                            {event.day_of_week} | {event.start_time} - {event.end_time}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-6 rounded-lg">
                        <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-4">
                            How it works
                        </h3>
                        <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
                            <p>1. The calendar system expects JSON objects with specific format:</p>
                            <pre className="bg-white dark:bg-gray-800 p-3 rounded font-mono text-xs overflow-x-auto">
                                {`{
  "action": "create_calendar_event",
  "params": {
    "title": "Event Title",
    "day_of_week": "Monday",
    "start_time": "19:00",
    "end_time": "21:00"
  }
}`}
                            </pre>
                            <p>2. Events are created via the backend API and appear in the weekly calendar view.</p>
                            <p>3. You can navigate to /chat to see the created events in the calendar.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 
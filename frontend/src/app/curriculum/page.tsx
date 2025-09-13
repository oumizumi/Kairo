'use client';

import React, { useState, useEffect } from 'react';
import Footer from '@/components/Footer';
import ThemeToggle from '@/components/ThemeToggle';
import DailyCalendar from '@/components/DailyCalendar';
import { isMobileDevice } from '@/utils/deviceDetection';
import { format } from 'date-fns';

// Simple event interface for guest mode events
interface CalendarEvent {
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
}

const CurriculumPage = () => {
    const [currentDate, setCurrentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isMobile, setIsMobile] = useState(false);

    // Check device type on mount
    useEffect(() => {
        setIsMobile(isMobileDevice());
    }, []);

    // Guest mode event handlers
    const handleDeleteEvent = async (eventId: number) => {
        try {
            console.log('🗑️ Deleting event:', eventId);
            // Remove from local state only
            setEvents(prev => prev.filter(event => event.id !== eventId));
            console.log('✅ Event removed from local state');
        } catch (error) {
            console.error('❌ Error deleting event:', error);
        }
    };

    const handleEditEvent = (eventId: number, updatedEvent: CalendarEvent) => {
        try {
            console.log('✏️ Editing event:', eventId);
            // Update in local state only
            setEvents(prev => prev.map(event => 
                event.id === eventId ? updatedEvent : event
            ));
            console.log('✅ Event updated in local state');
        } catch (error) {
            console.error('❌ Error editing event:', error);
        }
    };

    const handleAddEvent = (newEvent: CalendarEvent) => {
        try {
            console.log('➕ Adding new event');
            // Add to local state only
            const eventWithId = {
                ...newEvent,
                id: Date.now() // Simple ID generation for guest mode
            };
            setEvents(prev => [...prev, eventWithId]);
            console.log('✅ Event added to local state');
        } catch (error) {
            console.error('❌ Error adding event:', error);
        }
    };

    const handleRefresh = () => {
        console.log('🔄 Guest mode refresh - no backend to refresh from');
    };

    return (
        <div className="min-h-screen bg-white dark:bg-[#121212] transition-colors duration-300 flex flex-col">
            {/* Guest Mode Banner */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-4 py-3 text-center font-mono text-sm">
                <span className="mr-2">👤</span>
                Guest Mode - Your changes won't be saved. <a href="/signup" className="underline hover:text-emerald-200 ml-2">Sign up to save your schedule</a>
            </div>
            
            {/* Main Calendar Interface */}
            <div className="flex-1 min-h-0">
                <DailyCalendar
                    date={currentDate}
                    events={events}
                    onDateChange={setCurrentDate}
                    onDeleteEvent={handleDeleteEvent}
                    onEditEvent={handleEditEvent}
                    onAddEvent={handleAddEvent}
                    onRefresh={handleRefresh}
                    loadFromBackend={false}
                    readOnly={false}
                />
            </div>
            
            <Footer />
            <ThemeToggle />
        </div>
    );
};

export default CurriculumPage; 
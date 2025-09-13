'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSharedSchedule, SharedScheduleData } from '@/services/scheduleShareService';
import DailyCalendar from '@/components/DailyCalendar';
import { ThemeProvider } from '@/components/ThemeProvider';
import Footer from '@/components/Footer';
import ThemeToggle from '@/components/ThemeToggle';
import { AlertCircle, Copy, ExternalLink } from 'lucide-react';

// For static export, we'll handle the dynamic route at runtime
export const dynamic = 'force-static';

export default function SharedSchedulePage() {
  const params = useParams();
  const router = useRouter();
  const scheduleId = params.id as string;
  
  const [sharedSchedule, setSharedSchedule] = useState<SharedScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (scheduleId) {
      loadSharedSchedule();
    }
  }, [scheduleId]);

  const loadSharedSchedule = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSharedSchedule(scheduleId);
      setSharedSchedule(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shared schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleCloneAndEdit = () => {
    // Redirect to main app with the schedule data
    if (sharedSchedule) {
      // Store the schedule data in localStorage for the main app to pick up
      localStorage.setItem('cloned-schedule', JSON.stringify(sharedSchedule.shared_schedule.schedule_data));
      router.push('/');
    }
  };

  const copyScheduleLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('Schedule link copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  if (loading) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-[#121212] flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-[#aaaaaa]">Loading shared schedule...</p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  if (error) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-gray-50 dark:bg-[#121212] flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-6">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-[#e0e0e0] mb-2">
              Schedule Not Found
            </h1>
            <p className="text-gray-600 dark:text-[#aaaaaa] mb-6">
              {error}
            </p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
            >
              Go to Kairo
            </button>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  if (!sharedSchedule) {
    return null;
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-[#121212] flex flex-col">
        {/* Shared Schedule Banner */}
        <div className="bg-blue-600 dark:bg-blue-700 text-white py-3 px-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-sm opacity-90">You're viewing a shared schedule by</p>
                <p className="font-semibold">{sharedSchedule.owner}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={copyScheduleLink}
                className="px-3 py-1.5 bg-blue-500 hover:bg-blue-400 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-1.5"
                title="Copy schedule link"
              >
                <Copy className="w-4 h-4" />
                Copy Link
              </button>
              
              <button
                onClick={handleCloneAndEdit}
                className="px-3 py-1.5 bg-white text-blue-600 hover:bg-gray-100 rounded-md text-sm font-medium transition-colors duration-200 flex items-center gap-1.5"
                title="Clone and customize this schedule"
              >
                <ExternalLink className="w-4 h-4" />
                Clone & Edit
              </button>
            </div>
          </div>
        </div>

        {/* Schedule Title */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-4 px-4">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {sharedSchedule.shared_schedule.title}
            </h1>
            {sharedSchedule.shared_schedule.term && (
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {sharedSchedule.shared_schedule.term}
              </p>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              Shared on {new Date(sharedSchedule.shared_schedule.created_at).toLocaleDateString()} • 
              Viewed {sharedSchedule.shared_schedule.view_count} times
            </p>
          </div>
        </div>

        {/* Calendar Display */}
        <div className="max-w-7xl mx-auto p-4 flex-1 min-h-0 w-full">
          <DailyCalendar
            date={new Date().toISOString().split('T')[0]} // Current date in YYYY-MM-DD format
            events={sharedSchedule.shared_schedule.schedule_data.events}
            loadFromBackend={false}
            isKairollView={true}
            onDateChange={() => {}}
            onDeleteEvent={() => {}}
            onAddEvent={() => {}}
            readOnly={true}
          />
        </div>

        <Footer />
        <ThemeToggle />
      </div>
    </ThemeProvider>
  );
}
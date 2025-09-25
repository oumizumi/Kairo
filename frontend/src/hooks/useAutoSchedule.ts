import { useState, useEffect, useCallback } from 'react';
import { autoScheduleBuilderService, AutoSchedule, AutoScheduleResult } from '@/services/autoScheduleBuilderService';
import { ScheduleEvent } from '@/services/scheduleGeneratorService';
import { toast } from 'sonner';

export interface UseAutoScheduleReturn {
  // State
  schedules: AutoSchedule[];
  isLoading: boolean;
  isBuilding: boolean;
  isAdjusting: boolean;
  
  // Actions
  buildSchedule: (request: string) => Promise<boolean>;
  adjustSchedule: (scheduleId: string, adjustment: string) => Promise<boolean>;
  refreshSchedules: () => Promise<void>;
  convertToEvents: () => ScheduleEvent[];
  
  // Utilities
  hasSchedules: boolean;
  totalCourses: number;
}

export function useAutoSchedule(): UseAutoScheduleReturn {
  const [schedules, setSchedules] = useState<AutoSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Load schedules on mount
  useEffect(() => {
    refreshSchedules();
  }, []);

  const refreshSchedules = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await autoScheduleBuilderService.getCurrentSchedules();
      if (result.success) {
        setSchedules(result.schedules);
      } else {
        console.error('Failed to load schedules:', result.message);
      }
    } catch (error) {
      console.error('Error loading schedules:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const buildSchedule = useCallback(async (request: string): Promise<boolean> => {
    if (!request.trim()) {
      toast.error('Please provide a schedule request');
      return false;
    }

    setIsBuilding(true);
    try {
      // Parse preferences from the request
      const preferences = autoScheduleBuilderService.parseTimePreferences(request);
      
      const result = await autoScheduleBuilderService.buildSchedule({
        message: request,
        preferences
      });

      if (result.success) {
        setSchedules(result.schedules);
        toast.success(result.message || 'Schedule built successfully!');
        return true;
      } else {
        toast.error(result.message || 'Failed to build schedule');
        return false;
      }
    } catch (error) {
      console.error('Error building schedule:', error);
      toast.error('An error occurred while building the schedule');
      return false;
    } finally {
      setIsBuilding(false);
    }
  }, []);

  const adjustSchedule = useCallback(async (scheduleId: string, adjustment: string): Promise<boolean> => {
    if (!adjustment.trim()) {
      toast.error('Please provide an adjustment request');
      return false;
    }

    setIsAdjusting(true);
    try {
      const result = await autoScheduleBuilderService.adjustSchedule(scheduleId, adjustment);
      
      if (result.success) {
        toast.success(result.message || 'Schedule adjusted successfully!');
        // Refresh schedules to show changes
        await refreshSchedules();
        return true;
      } else {
        toast.error(result.message || 'Failed to adjust schedule');
        return false;
      }
    } catch (error) {
      console.error('Error adjusting schedule:', error);
      toast.error('An error occurred while adjusting the schedule');
      return false;
    } finally {
      setIsAdjusting(false);
    }
  }, [refreshSchedules]);

  const convertToEvents = useCallback((): ScheduleEvent[] => {
    return autoScheduleBuilderService.convertToCalendarEvents(schedules);
  }, [schedules]);

  // Computed values
  const hasSchedules = schedules.length > 0;
  const totalCourses = schedules.reduce((total, schedule) => total + schedule.total_courses, 0);

  return {
    // State
    schedules,
    isLoading,
    isBuilding,
    isAdjusting,
    
    // Actions
    buildSchedule,
    adjustSchedule,
    refreshSchedules,
    convertToEvents,
    
    // Utilities
    hasSchedules,
    totalCourses
  };
}

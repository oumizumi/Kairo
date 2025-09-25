/**
 * Auto Schedule Builder Service
 * 
 * Handles communication with the new auto schedule builder API.
 * Works with any program dynamically and uses live scraper data.
 */

import api from '@/lib/api';
import { ScheduleEvent } from './scheduleGeneratorService';

export interface AutoScheduleRequest {
  message: string;
  term?: string;
  preferences?: TimePreferences;
}

export interface TimePreferences {
  no_early_classes?: boolean;
  no_late_classes?: boolean;
  avoid_days?: string[];
  preferred_days?: string[];
  avoid_times?: string[];
  prefer_compact?: boolean;
  max_gap_hours?: number;
}

export interface ScheduleEntry {
  id: string;
  course_code: string;
  course_title: string;
  section_code: string;
  component: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  instructor: string;
  location: string;
  theme: string;
  start_date: string;
  end_date: string;
}

export interface AutoSchedule {
  id: string;
  term: string;
  term_display: string;
  created_at: string;
  entries: ScheduleEntry[];
  total_courses: number;
}

export interface AutoScheduleResult {
  success: boolean;
  message: string;
  schedules: AutoSchedule[];
  results_by_term?: Record<string, any>;
  terms_built?: string[];
  total_courses?: number;
  error?: string;
}

export interface ScheduleAdjustmentResult {
  success: boolean;
  message: string;
  adjustments?: Array<{
    success: boolean;
    message: string;
    type: string;
    [key: string]: any;
  }>;
  schedule_updated?: boolean;
  error?: string;
}

export interface DataVersionResult {
  success: boolean;
  dataset_version: string;
  cache_invalidated: boolean;
}

class AutoScheduleBuilderService {
  /**
   * Build a new auto-generated schedule
   */
  async buildSchedule(request: AutoScheduleRequest): Promise<AutoScheduleResult> {
    try {
      const response = await api.post('/api/auto-schedule/', request);
      return response.data;
    } catch (error: any) {
      console.error('[AUTO_SCHEDULE] Error building schedule:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to build schedule',
        schedules: [],
        error: error.message
      };
    }
  }

  /**
   * Get user's current auto-generated schedules
   */
  async getCurrentSchedules(): Promise<AutoScheduleResult> {
    try {
      const response = await api.get('/api/auto-schedule/');
      return response.data;
    } catch (error: any) {
      console.error('[AUTO_SCHEDULE] Error getting schedules:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get schedules',
        schedules: [],
        error: error.message
      };
    }
  }

  /**
   * Apply natural language adjustments to a schedule
   */
  async adjustSchedule(scheduleId: string, adjustment: string): Promise<ScheduleAdjustmentResult> {
    try {
      const response = await api.post(`/api/auto-schedule/adjust/${scheduleId}/`, {
        adjustment
      });
      return response.data;
    } catch (error: any) {
      console.error('[AUTO_SCHEDULE] Error adjusting schedule:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to adjust schedule',
        error: error.message
      };
    }
  }

  /**
   * Check dataset version and invalidate cache if needed
   */
  async checkDataVersion(): Promise<DataVersionResult> {
    try {
      const response = await api.get('/api/auto-schedule/version/');
      return response.data;
    } catch (error: any) {
      console.error('[AUTO_SCHEDULE] Error checking data version:', error);
      return {
        success: false,
        dataset_version: '',
        cache_invalidated: false
      };
    }
  }

  /**
   * Convert schedule entries to calendar events format
   */
  convertToCalendarEvents(schedules: AutoSchedule[]): ScheduleEvent[] {
    const events: ScheduleEvent[] = [];

    for (const schedule of schedules) {
      for (const entry of schedule.entries) {
        events.push({
          title: `${entry.course_code} (${entry.component}) - ${entry.course_title}`,
          start_time: entry.start_time,
          end_time: entry.end_time,
          day_of_week: entry.day_of_week,
          start_date: entry.start_date,
          end_date: entry.end_date,
          description: `${entry.course_code} - ${entry.section_code}\nType: ${entry.component}\nInstructor: ${entry.instructor}\nLocation: ${entry.location}`,
          theme: entry.theme
        });
      }
    }

    return events;
  }

  /**
   * Parse natural language time preferences
   */
  parseTimePreferences(message: string): TimePreferences {
    const preferences: TimePreferences = {};
    const messageLower = message.toLowerCase();

    // Early morning preferences
    if (/no\s+early|avoid\s+early|not\s+early|sleep\s+in|late\s+riser|hate\s+mornings?|not\s+a\s+morning\s+person|after\s+9|start\s+later|no\s+8am|avoid\s+8am/i.test(message)) {
      preferences.no_early_classes = true;
    }

    // Late class preferences
    if (/no\s+late|avoid\s+late|not\s+late|finish\s+early|leave\s+early|before\s+6|before\s+5|home\s+early|done\s+by|finish\s+by/i.test(message)) {
      preferences.no_late_classes = true;
    }

    // Day preferences
    const avoidDays: string[] = [];
    if (/avoid\s+friday|no\s+friday|hate\s+friday|skip\s+friday|free\s+friday|friday\s+off/i.test(message)) {
      avoidDays.push('Friday');
    }
    if (/avoid\s+monday|no\s+monday|hate\s+monday|skip\s+monday|monday\s+blues/i.test(message)) {
      avoidDays.push('Monday');
    }
    if (avoidDays.length > 0) {
      preferences.avoid_days = avoidDays;
    }

    // Preferred days
    const preferredDaysMatch = message.match(/prefer\s+((?:monday|tuesday|wednesday|thursday|friday)(?:\s*,?\s*(?:and\s+)?(?:monday|tuesday|wednesday|thursday|friday))*)/gi);
    if (preferredDaysMatch) {
      const preferredDays: string[] = [];
      preferredDaysMatch.forEach(match => {
        const days = match.replace(/prefer\s+/i, '').split(/\s*,?\s*(?:and\s+)?/);
        days.forEach(day => {
          const cleanDay = day.trim().replace(/^\w/, c => c.toUpperCase());
          if (['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(cleanDay)) {
            preferredDays.push(cleanDay);
          }
        });
      });
      if (preferredDays.length > 0) {
        preferences.preferred_days = [...new Set(preferredDays)];
      }
    }

    // Compact schedule preferences
    if (/compact|close\s+together|back\s+to\s+back|minimize\s+gaps|no\s+gaps|tight\s+schedule|clustered|bunched/i.test(message)) {
      preferences.prefer_compact = true;
      preferences.max_gap_hours = 2;
    }

    // Spread out schedule preferences
    if (/spread\s+out|spaced\s+out|gaps\s+between|time\s+between|breaks\s+between/i.test(message)) {
      preferences.prefer_compact = false;
      preferences.max_gap_hours = 4;
    }

    // Time avoidances
    const timeAvoidances: string[] = [];
    const timePatterns = [
      /avoid\s+(\d{1,2}:\d{2})/gi,
      /avoid\s+(\d{1,2}\s*(?:am|pm))/gi,
      /not\s+at\s+(\d{1,2}:\d{2})/gi,
      /not\s+at\s+(\d{1,2}\s*(?:am|pm))/gi,
      /no\s+(\d{1,2}:\d{2})/gi,
      /no\s+(\d{1,2}\s*(?:am|pm))/gi
    ];

    timePatterns.forEach(pattern => {
      const matches = message.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const time = match.replace(/(?:avoid|not\s+at|no)\s+/i, '').trim();
          timeAvoidances.push(time);
        });
      }
    });

    if (timeAvoidances.length > 0) {
      preferences.avoid_times = [...new Set(timeAvoidances)];
    }

    return preferences;
  }

  /**
   * Check if a message is requesting schedule building
   */
  isScheduleBuildRequest(message: string): boolean {
    const buildPatterns = [
      /(?:build|create|generate|make|plan)\s+(?:my\s+)?schedule/i,
      /(?:build|create|generate|make|plan)\s+(?:my\s+)?(?:fall|winter|spring|summer)\s+schedule/i,
      /(?:fall|winter|spring|summer)\s+schedule/i,
      /schedule\s+for\s+(?:year\s+)?\d/i,
      /(?:year\s+)?\d\s+schedule/i
    ];

    return buildPatterns.some(pattern => pattern.test(message));
  }

  /**
   * Check if a message is requesting schedule adjustments
   */
  isScheduleAdjustmentRequest(message: string): boolean {
    const adjustmentPatterns = [
      /remove\s+[A-Z]{3,4}\s?\d{4}/i,
      /drop\s+[A-Z]{3,4}\s?\d{4}/i,
      /no\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?/i,
      /avoid\s+(?:monday|tuesday|wednesday|thursday|friday)/i,
      /prefer\s+(?:prof|professor)/i,
      /stack\s+(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday)/i
    ];

    return adjustmentPatterns.some(pattern => pattern.test(message));
  }
}

export const autoScheduleBuilderService = new AutoScheduleBuilderService();

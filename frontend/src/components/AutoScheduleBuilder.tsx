'use client';

import React, { useState, useEffect } from 'react';
import { autoScheduleBuilderService, AutoScheduleResult, AutoSchedule } from '@/services/autoScheduleBuilderService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, Clock, MapPin, User, BookOpen, Sparkles, Trash2, Edit3 } from 'lucide-react';
import { toast } from 'sonner';

interface AutoScheduleBuilderProps {
  onScheduleGenerated?: (schedules: AutoSchedule[]) => void;
  onEventsUpdate?: (events: any[]) => void;
}

export default function AutoScheduleBuilder({ onScheduleGenerated, onEventsUpdate }: AutoScheduleBuilderProps) {
  const [request, setRequest] = useState('');
  const [isBuilding, setIsBuilding] = useState(false);
  const [currentSchedules, setCurrentSchedules] = useState<AutoSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [adjustmentText, setAdjustmentText] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Load existing schedules on mount
  useEffect(() => {
    loadCurrentSchedules();
  }, []);

  const loadCurrentSchedules = async () => {
    setIsLoading(true);
    try {
      const result = await autoScheduleBuilderService.getCurrentSchedules();
      if (result.success) {
        setCurrentSchedules(result.schedules);
        if (onScheduleGenerated) {
          onScheduleGenerated(result.schedules);
        }
        if (onEventsUpdate) {
          const events = autoScheduleBuilderService.convertToCalendarEvents(result.schedules);
          onEventsUpdate(events);
        }
      }
    } catch (error) {
      console.error('Error loading schedules:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuildSchedule = async () => {
    if (!request.trim()) {
      toast.error('Please enter a schedule request');
      return;
    }

    setIsBuilding(true);
    try {
      // Parse time preferences from the request
      const preferences = autoScheduleBuilderService.parseTimePreferences(request);
      
      const result = await autoScheduleBuilderService.buildSchedule({
        message: request,
        preferences
      });

      if (result.success) {
        setCurrentSchedules(result.schedules);
        toast.success(result.message || 'Schedule built successfully!');
        
        // Notify parent components
        if (onScheduleGenerated) {
          onScheduleGenerated(result.schedules);
        }
        if (onEventsUpdate) {
          const events = autoScheduleBuilderService.convertToCalendarEvents(result.schedules);
          onEventsUpdate(events);
        }
        
        // Clear the request input
        setRequest('');
      } else {
        toast.error(result.message || 'Failed to build schedule');
      }
    } catch (error) {
      console.error('Error building schedule:', error);
      toast.error('An error occurred while building the schedule');
    } finally {
      setIsBuilding(false);
    }
  };

  const handleAdjustSchedule = async (scheduleId: string) => {
    if (!adjustmentText.trim()) {
      toast.error('Please enter an adjustment request');
      return;
    }

    setIsAdjusting(true);
    try {
      const result = await autoScheduleBuilderService.adjustSchedule(scheduleId, adjustmentText);
      
      if (result.success) {
        toast.success(result.message || 'Schedule adjusted successfully!');
        // Reload schedules to show changes
        await loadCurrentSchedules();
        setAdjustmentText('');
      } else {
        toast.error(result.message || 'Failed to adjust schedule');
      }
    } catch (error) {
      console.error('Error adjusting schedule:', error);
      toast.error('An error occurred while adjusting the schedule');
    } finally {
      setIsAdjusting(false);
    }
  };

  const formatTime = (time: string) => {
    try {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return time;
    }
  };

  const getComponentColor = (component: string) => {
    const colors = {
      'LEC': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'LAB': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'DGD': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'TUT': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'SEM': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    };
    return colors[component as keyof typeof colors] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  return (
    <div className="space-y-6">
      {/* Schedule Builder Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Auto Schedule Builder
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Ask Kairo to build your schedule! Try: "Build my Fall schedule", "Create Winter schedule with no 8am classes", "Generate Year 2 Software Engineering schedule"
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., Build my Fall Winter schedule with no Friday classes"
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isBuilding && handleBuildSchedule()}
                className="flex-1"
              />
              <Button 
                onClick={handleBuildSchedule} 
                disabled={isBuilding || !request.trim()}
                className="min-w-[100px]"
              >
                {isBuilding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Building...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Build
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Schedules */}
      {isLoading ? (
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading schedules...
            </div>
          </CardContent>
        </Card>
      ) : currentSchedules.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Your Schedules</h3>
          {currentSchedules.map((schedule) => (
            <Card key={schedule.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    {schedule.term_display}
                  </CardTitle>
                  <Badge variant="secondary">
                    {schedule.total_courses} courses
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Schedule Entries */}
                <div className="grid gap-2">
                  {schedule.entries.map((entry) => (
                    <div 
                      key={entry.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{entry.course_code}</span>
                            <Badge className={getComponentColor(entry.component)}>
                              {entry.component}
                            </Badge>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {entry.course_title}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {entry.day_of_week}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(entry.start_time)} - {formatTime(entry.end_time)}
                        </div>
                        {entry.instructor && (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {entry.instructor}
                          </div>
                        )}
                        {entry.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {entry.location}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Schedule Adjustments */}
                <div className="border-t pt-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Adjust this schedule:</p>
                    <p className="text-xs text-muted-foreground">
                      Try: "remove CSI 2110", "no Friday labs", "avoid 8am classes", "prefer Prof. Smith"
                    </p>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g., remove CSI 2110 Friday lab"
                        value={adjustmentText}
                        onChange={(e) => setAdjustmentText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !isAdjusting && handleAdjustSchedule(schedule.id)}
                        className="flex-1"
                      />
                      <Button 
                        onClick={() => handleAdjustSchedule(schedule.id)}
                        disabled={isAdjusting || !adjustmentText.trim()}
                        variant="outline"
                        size="sm"
                      >
                        {isAdjusting ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            Adjusting...
                          </>
                        ) : (
                          <>
                            <Edit3 className="h-3 w-3 mr-1" />
                            Adjust
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No schedules yet</h3>
              <p className="text-muted-foreground mb-4">
                Use the builder above to create your first auto-generated schedule!
              </p>
              <div className="text-sm text-muted-foreground">
                <p><strong>Example requests:</strong></p>
                <ul className="mt-2 space-y-1">
                  <li>• "Build my Fall schedule"</li>
                  <li>• "Create Winter schedule with no 8am classes"</li>
                  <li>• "Generate Year 2 Software Engineering schedule"</li>
                  <li>• "Build compact schedule for both Fall and Winter"</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

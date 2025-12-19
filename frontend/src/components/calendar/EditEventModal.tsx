"use client";
// Updated EditEventModal with green gradient button - Dec 19 2025

import React, { useEffect } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { EVENT_THEMES } from '@/config/eventThemes';
import { Event, EditEventModalProps } from './types';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TimeInput } from '@/components/ui/time-input';
import { SingleDayPicker } from '@/components/ui/single-day-picker';
import { Form, FormField, FormLabel, FormItem, FormControl, FormMessage } from '@/components/ui/form';
import { Select, SelectItem, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogHeader, DialogClose, DialogContent, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

import type { TimeValue } from "react-aria-components";

// Kairo event schema
const eventSchema = z.object({
    title: z.string().min(1, "Title is required"),
    professor: z.string().optional(),
    description: z.string().optional(),
    eventType: z.enum(["recurring", "biweekly", "specific"]),
    dayOfWeek: z.string().optional(),
    specificDate: z.date().optional(),
    startTime: z.object({ hour: z.number(), minute: z.number() }),
    endTime: z.object({ hour: z.number(), minute: z.number() }),
    theme: z.string(),
});

type TEventFormData = z.infer<typeof eventSchema>;

const EditEventModal: React.FC<EditEventModalProps> = ({ 
    event, 
    isOpen, 
    onClose, 
    onSave, 
    isCreating = false, 
    allEvents = [], 
    onDeleteEvent, 
    onAddEvent 
}) => {
    // Determine event type from event data
    const getEventType = (): 'recurring' | 'biweekly' | 'specific' => {
        if (!event) return 'recurring';
        if (event.start_date) return 'specific';
        if (event.recurrence_pattern === 'biweekly') return 'biweekly';
        return 'recurring';
    };

    // Parse time string to time object
    const parseTime = (timeStr: string) => {
        const [hour, minute] = (timeStr || '09:00').split(':').map(Number);
        return { hour, minute };
    };

    const form = useForm<TEventFormData>({
        resolver: zodResolver(eventSchema),
        defaultValues: {
            title: event?.title || '',
            professor: event?.professor || '',
            description: event?.description || '',
            eventType: getEventType(),
            dayOfWeek: event?.day_of_week || 'Monday',
            specificDate: event?.start_date ? new Date(event.start_date) : undefined,
            startTime: parseTime(event?.startTime || '09:00'),
            endTime: parseTime(event?.endTime || '10:00'),
            theme: event?.theme || 'lavender-peach',
        },
    });

    // Reset form when modal opens with new event data
    useEffect(() => {
        if (isOpen) {
            form.reset({
                title: event?.title || '',
                professor: event?.professor || '',
                description: event?.description || '',
                eventType: getEventType(),
                dayOfWeek: event?.day_of_week || 'Monday',
                specificDate: event?.start_date ? new Date(event.start_date) : (event?.reference_date ? new Date(event.reference_date) : undefined),
                startTime: parseTime(event?.startTime || '09:00'),
                endTime: parseTime(event?.endTime || '10:00'),
                theme: event?.theme || 'lavender-peach',
            });
        }
    }, [event, isOpen, isCreating]);

    const onSubmit = (values: TEventFormData) => {
        // Convert time objects to HH:MM strings
        const startTimeStr = `${String(values.startTime.hour).padStart(2, '0')}:${String(values.startTime.minute).padStart(2, '0')}`;
        const endTimeStr = `${String(values.endTime.hour).padStart(2, '0')}:${String(values.endTime.minute).padStart(2, '0')}`;

        const updatedEvent: Event = {
            id: isCreating ? undefined : event?.id,
            title: values.title,
            startTime: startTimeStr,
            endTime: endTimeStr,
            description: values.description || '',
            professor: values.professor || '',
            theme: values.theme,
        };

        // Set event type specific fields
        if (values.eventType === 'recurring') {
            updatedEvent.day_of_week = values.dayOfWeek;
            updatedEvent.recurrence_pattern = 'weekly';
        } else if (values.eventType === 'biweekly') {
            updatedEvent.day_of_week = values.dayOfWeek;
            updatedEvent.recurrence_pattern = 'biweekly';
            updatedEvent.reference_date = values.specificDate?.toISOString().split('T')[0];
        } else {
            updatedEvent.start_date = values.specificDate?.toISOString().split('T')[0];
            updatedEvent.end_date = values.specificDate?.toISOString().split('T')[0];
            updatedEvent.recurrence_pattern = 'none';
        }

        onSave(updatedEvent);
        onClose();
    };

    const eventType = form.watch("eventType");

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto bg-white dark:bg-[#1a1a1a] border-2 border-gray-300 dark:border-gray-700 shadow-2xl [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-track]:bg-gray-200 dark:[&::-webkit-scrollbar-track]:bg-gray-800 [&::-webkit-scrollbar-thumb]:bg-gray-400 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-gray-500 dark:[&::-webkit-scrollbar-thumb]:hover:bg-gray-500">
                <DialogHeader className="space-y-2">
                    <DialogTitle>{isCreating ? 'Add New Event' : 'Edit Event'}</DialogTitle>
                    <DialogDescription className="text-xs text-gray-600 dark:text-gray-400">
                        {isCreating ? 'Create a new event and add it to your calendar.' : 'Modify event details, timing, or color theme.'}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form id="event-form" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">

                        {/* Title and Professor in one row */}
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="title"
                                render={({ field, fieldState }) => (
                                    <FormItem>
                                        <FormLabel htmlFor="title">Title</FormLabel>
                                        <FormControl>
                                            <Input 
                                                id="title" 
                                                placeholder="Event title" 
                                                data-invalid={fieldState.invalid}
                                                className="bg-white dark:bg-[#2a2a2a] border-gray-300 dark:border-gray-600"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="professor"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel htmlFor="professor">Professor</FormLabel>
                                        <FormControl>
                                            <Input 
                                                id="professor" 
                                                placeholder="Professor name" 
                                                className="bg-white dark:bg-[#2a2a2a] border-gray-300 dark:border-gray-600"
                                                {...field}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Event Type and Color in one row */}
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="eventType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Event Type</FormLabel>
                                        <FormControl>
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger className="bg-white dark:bg-[#2a2a2a] border-gray-300 dark:border-gray-600">
                                                    <SelectValue placeholder="Select event type" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-white dark:bg-[#2a2a2a] border-gray-300 dark:border-gray-600">
                                                    <SelectItem value="recurring">Weekly</SelectItem>
                                                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                                                    <SelectItem value="specific">One-Time</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="theme"
                                render={({ field, fieldState }) => {
                                    const selectedTheme = EVENT_THEMES[field.value as keyof typeof EVENT_THEMES];
                                    
                                    return (
                                        <FormItem>
                                            <FormLabel>Color</FormLabel>
                                            <FormControl>
                                                <Select value={field.value} onValueChange={field.onChange}>
                                                    <SelectTrigger data-invalid={fieldState.invalid} className="bg-white dark:bg-[#2a2a2a] border-gray-300 dark:border-gray-600">
                                                        <SelectValue placeholder="Select a color">
                                                            {selectedTheme && (
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`size-3.5 rounded-full ${selectedTheme.preview}`} />
                                                                    {selectedTheme.name}
                                                                </div>
                                                            )}
                                                        </SelectValue>
                                                    </SelectTrigger>

                                                    <SelectContent className="bg-white dark:bg-[#2a2a2a] border-gray-300 dark:border-gray-600 max-h-[300px] overflow-y-auto">
                                                        {Object.entries(EVENT_THEMES).map(([key, theme]) => (
                                                            <SelectItem key={key} value={key}>
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`size-3.5 rounded-full ${theme.preview}`} />
                                                                    {theme.name}
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                );
                            }}
                            />
                        </div>

                        {/* Day of Week (for recurring and biweekly) */}
                        {(eventType === 'recurring' || eventType === 'biweekly') && (
                            <FormField
                                control={form.control}
                                name="dayOfWeek"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Day of Week</FormLabel>
                                        <FormControl>
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger className="bg-white dark:bg-[#2a2a2a] border-gray-300 dark:border-gray-600">
                                                    <SelectValue placeholder="Select a day" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-white dark:bg-[#2a2a2a] border-gray-300 dark:border-gray-600">
                                                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                                                        <SelectItem key={day} value={day}>{day}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        )}

                        {/* Reference Date (for biweekly) */}
                        {eventType === 'biweekly' && (
                            <FormField
                                control={form.control}
                                name="specificDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Starting Date</FormLabel>
                                        <FormControl>
                                            <SingleDayPicker
                                                value={field.value}
                                                onSelect={(date) => field.onChange(date as Date)}
                                                placeholder="Select a date"
                                            />
                                        </FormControl>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Repeats every 2 weeks
                                        </p>
                                    </FormItem>
                                )}
                            />
                        )}

                        {/* Time Inputs */}
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="startTime"
                                render={({ field, fieldState }) => (
                                    <FormItem className="flex-1">
                                        <FormLabel>Start Time</FormLabel>
                                        <FormControl>
                                            <TimeInput 
                                                value={field.value as TimeValue} 
                                                onChange={field.onChange} 
                                                hourCycle={12}
                                                data-invalid={fieldState.invalid}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="endTime"
                                render={({ field, fieldState }) => (
                                    <FormItem className="flex-1">
                                        <FormLabel>End Time</FormLabel>
                                        <FormControl>
                                            <TimeInput 
                                                value={field.value as TimeValue} 
                                                onChange={field.onChange} 
                                                hourCycle={12}
                                                data-invalid={fieldState.invalid}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Description */}
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea 
                                            placeholder="Add event description"
                                            rows={2}
                                            className="bg-white dark:bg-[#2a2a2a] border-gray-300 dark:border-gray-600 text-sm"
                                            {...field}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                    </form>
                </Form>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline" className="bg-white dark:bg-[#2a2a2a] border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-[#333333]">
                            Cancel
                        </Button>
                    </DialogClose>

                    <Button form="event-form" type="submit" className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all duration-200">
                        {isCreating ? 'Create Event' : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default EditEventModal;
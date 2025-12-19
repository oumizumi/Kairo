"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface SingleDayPickerProps {
  value?: Date;
  onSelect?: (date: Date | undefined) => void;
  placeholder?: string;
}

export function SingleDayPicker({ value, onSelect, placeholder = "Pick a date" }: SingleDayPickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(value);

  React.useEffect(() => {
    setSelectedDate(value);
  }, [value]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value;
    if (dateValue) {
      const newDate = new Date(dateValue);
      setSelectedDate(newDate);
      onSelect?.(newDate);
      setIsOpen(false);
    }
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return placeholder;
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start text-left font-normal bg-white dark:bg-[#2a2a2a] border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-[#333333]"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? formatDate(selectedDate) : <span className="text-muted-foreground">{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4 bg-white dark:bg-[#2a2a2a] border-gray-300 dark:border-gray-600" align="start">
        <div className="space-y-2">
          <input
            type="date"
            value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''}
            onChange={handleDateChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-[#2a2a2a] text-gray-900 dark:text-gray-100"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}


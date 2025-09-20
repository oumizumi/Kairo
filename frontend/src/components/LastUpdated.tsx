'use client';

import { useState, useEffect } from 'react';

interface LastUpdatedData {
  timestamp: string;
  date: string;
  files_updated: number;
  deployment_time: string;
}

interface LastUpdatedProps {
  className?: string;
  showIcon?: boolean;
  compact?: boolean;
  term?: string; // Add term-specific support
}

export default function LastUpdated({ 
  className = '', 
  showIcon = true, 
  compact = false,
  term
}: LastUpdatedProps) {
  const [lastUpdated, setLastUpdated] = useState<LastUpdatedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchLastUpdated = async () => {
      try {
        // Try term-specific file first, then fall back to general file
        const filename = term ? `last_updated_${term.toLowerCase().replace(/\s+/g, '_')}.json` : 'last_updated.json';
        let response = await fetch(`/${filename}`);
        
        // If term-specific file doesn't exist, try general file
        if (!response.ok && term) {
          response = await fetch('/last_updated.json');
        }
        
        if (response.ok) {
          const data = await response.json();
          setLastUpdated(data);
        } else {
          setError(true);
        }
      } catch (err) {
        console.warn('Could not fetch last updated info:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchLastUpdated();
  }, [term]);

  if (loading) {
    return (
      <div className={`flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 ${className}`}>
        {showIcon && (
          <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600 animate-pulse"></div>
        )}
        <span>Loading...</span>
      </div>
    );
  }

  if (error || !lastUpdated) {
    return null; // Don't show anything if we can't load the data
  }

  const timeAgo = getTimeAgo(new Date(lastUpdated.timestamp));

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 ${className}`}>
        {showIcon && (
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
        )}
        <span>Last updated {timeAgo}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 ${className}`}>
      {showIcon && (
        <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" title="Data is fresh"></div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
        <span>Course data updated</span>
        <span className="font-medium text-gray-700 dark:text-gray-300" title={lastUpdated.date}>
          {timeAgo}
        </span>
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 1) {
    return 'just now';
  } else if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
  } else if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }
}

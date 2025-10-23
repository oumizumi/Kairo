'use client';

import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react';
import api from '@/lib/api';

interface QuickFeedbackProps {
  feedbackType: 'email' | 'chat' | 'schedule' | 'other';
  userInput: string;
  aiResponse: string;
  sessionId?: string;
  onDetailedFeedback?: () => void;
  className?: string;
}

const QuickFeedback: React.FC<QuickFeedbackProps> = ({
  feedbackType,
  userInput,
  aiResponse,
  sessionId,
  onDetailedFeedback,
  className = ''
}) => {
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleQuickFeedback = async (thumbsUp: boolean) => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await api.post('/api/feedback/quick/', {
        type: feedbackType,
        user_input: userInput,
        ai_response: aiResponse,
        thumbs_up: thumbsUp,
        session_id: sessionId,
        model: 'gpt-4o-mini'
      });
      
      setFeedback(thumbsUp ? 'up' : 'down');
      
      // Reset after 3 seconds
      setTimeout(() => {
        setFeedback(null);
      }, 3000);
    } catch (error) {
      console.error('Failed to submit quick feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (feedback) {
    return (
      <div className={`flex items-center gap-2 text-sm ${className}`}>
        <span className="text-green-600 dark:text-green-400">
          Thanks for your feedback!
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        onClick={() => handleQuickFeedback(true)}
        disabled={isSubmitting}
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group disabled:opacity-50"
        title="This response was helpful"
      >
        <ThumbsUp className="h-4 w-4 text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors" />
      </button>
      
      <button
        onClick={() => handleQuickFeedback(false)}
        disabled={isSubmitting}
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group disabled:opacity-50"
        title="This response was not helpful"
      >
        <ThumbsDown className="h-4 w-4 text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" />
      </button>
      
      {onDetailedFeedback && (
        <button
          onClick={onDetailedFeedback}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
          title="Provide detailed feedback"
        >
          <MessageSquare className="h-4 w-4 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
        </button>
      )}
    </div>
  );
};

export default QuickFeedback;
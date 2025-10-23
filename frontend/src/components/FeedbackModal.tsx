'use client';

import React, { useState } from 'react';
import { X, ThumbsUp, ThumbsDown, Star, Send } from 'lucide-react';
import api from '@/lib/api';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  feedbackType: 'email' | 'chat' | 'schedule' | 'other';
  userInput: string;
  aiResponse: string;
  sessionId?: string;
  emailDetails?: {
    generatedSubject: string;
    generatedBody: string;
    professorName?: string;
    professorEmail?: string;
    userModifiedSubject?: boolean;
    userModifiedBody?: boolean;
    finalSubjectSent?: string;
    finalBodySent?: string;
  };
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  feedbackType,
  userInput,
  aiResponse,
  sessionId,
  emailDetails
}) => {
  const [rating, setRating] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [isHelpful, setIsHelpful] = useState<boolean | null>(null);
  const [isAccurate, setIsAccurate] = useState(true);
  const [isProfessional, setIsProfessional] = useState(true);
  const [isRelevant, setIsRelevant] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Email-specific feedback
  const [subjectQuality, setSubjectQuality] = useState<number>(0);
  const [bodyQuality, setBodyQuality] = useState<number>(0);
  const [emailIssues, setEmailIssues] = useState({
    tooFormal: false,
    tooCasual: false,
    wrongTone: false,
    missingContext: false,
    grammaticalErrors: false,
  });

  const handleSubmit = async () => {
    if (rating === 0) {
      alert('Please provide a rating');
      return;
    }

    setIsSubmitting(true);
    try {
      const feedbackData = {
        feedback_type: feedbackType,
        user_input: userInput,
        ai_response: aiResponse,
        rating,
        feedback_text: feedbackText,
        is_helpful: isHelpful !== null ? isHelpful : rating >= 3,
        is_accurate: isAccurate,
        is_professional: isProfessional,
        is_relevant: isRelevant,
        session_id: sessionId,
        model_used: 'gpt-4o-mini',
        prompt_version: 'v2.0',
      };

      // Add email-specific details if this is email feedback
      if (feedbackType === 'email' && emailDetails) {
        feedbackData.email_details = {
          generated_subject: emailDetails.generatedSubject,
          generated_body: emailDetails.generatedBody,
          professor_name: emailDetails.professorName,
          professor_email: emailDetails.professorEmail,
          subject_quality: subjectQuality || rating,
          body_quality: bodyQuality || rating,
          too_formal: emailIssues.tooFormal,
          too_casual: emailIssues.tooCasual,
          wrong_tone: emailIssues.wrongTone,
          missing_context: emailIssues.missingContext,
          grammatical_errors: emailIssues.grammaticalErrors,
          user_modified_subject: emailDetails.userModifiedSubject || false,
          user_modified_body: emailDetails.userModifiedBody || false,
          final_subject_sent: emailDetails.finalSubjectSent,
          final_body_sent: emailDetails.finalBodySent,
        };
      }

      await api.post('/api/feedback/submit/', feedbackData);
      setSubmitted(true);
      
      // Auto-close after 2 seconds
      setTimeout(() => {
        onClose();
        // Reset form
        setRating(0);
        setFeedbackText('');
        setIsHelpful(null);
        setIsAccurate(true);
        setIsProfessional(true);
        setIsRelevant(true);
        setSubjectQuality(0);
        setBodyQuality(0);
        setEmailIssues({
          tooFormal: false,
          tooCasual: false,
          wrongTone: false,
          missingContext: false,
          grammaticalErrors: false,
        });
        setSubmitted(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const StarRating = ({ value, onChange, label }: { value: number; onChange: (rating: number) => void; label: string }) => (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`p-1 rounded transition-colors ${
              star <= value
                ? 'text-yellow-500 hover:text-yellow-600'
                : 'text-gray-300 hover:text-gray-400'
            }`}
          >
            <Star className={`h-5 w-5 ${star <= value ? 'fill-current' : ''}`} />
          </button>
        ))}
      </div>
    </div>
  );

  if (!isOpen) return null;

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div className="relative bg-white dark:bg-gray-900 rounded-xl p-6 max-w-md w-full shadow-2xl border border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
              <ThumbsUp className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Thank you for your feedback!
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your feedback helps us improve our AI responses.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Rate this {feedbackType === 'email' ? 'Email Generation' : 'AI Response'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Overall Rating */}
          <StarRating
            value={rating}
            onChange={setRating}
            label="Overall Rating *"
          />

          {/* Quick Helpful/Not Helpful */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Was this response helpful?
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsHelpful(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                  isHelpful === true
                    ? 'bg-green-50 border-green-300 text-green-700 dark:bg-green-900/20 dark:border-green-600 dark:text-green-400'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                <ThumbsUp className="h-4 w-4" />
                Helpful
              </button>
              <button
                type="button"
                onClick={() => setIsHelpful(false)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                  isHelpful === false
                    ? 'bg-red-50 border-red-300 text-red-700 dark:bg-red-900/20 dark:border-red-600 dark:text-red-400'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                <ThumbsDown className="h-4 w-4" />
                Not Helpful
              </button>
            </div>
          </div>

          {/* Email-specific ratings */}
          {feedbackType === 'email' && (
            <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h3 className="font-medium text-blue-900 dark:text-blue-100">Email Quality</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StarRating
                  value={subjectQuality}
                  onChange={setSubjectQuality}
                  label="Subject Line Quality"
                />
                <StarRating
                  value={bodyQuality}
                  onChange={setBodyQuality}
                  label="Email Body Quality"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Issues with the generated email (check all that apply):
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries({
                    tooFormal: 'Too formal',
                    tooCasual: 'Too casual',
                    wrongTone: 'Wrong tone',
                    missingContext: 'Missing context',
                    grammaticalErrors: 'Grammar errors',
                  }).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={emailIssues[key as keyof typeof emailIssues]}
                        onChange={(e) =>
                          setEmailIssues(prev => ({ ...prev, [key]: e.target.checked }))
                        }
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Quality Checkboxes */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Response Quality
            </label>
            <div className="space-y-2">
              {[
                { key: 'isAccurate', label: 'Accurate information', value: isAccurate, setter: setIsAccurate },
                { key: 'isProfessional', label: 'Professional tone', value: isProfessional, setter: setIsProfessional },
                { key: 'isRelevant', label: 'Relevant to my request', value: isRelevant, setter: setIsRelevant },
              ].map(({ key, label, value, setter }) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => setter(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Detailed Feedback */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Additional Comments (Optional)
            </label>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Tell us what was good or what could be improved..."
              rows={4}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={rating === 0 || isSubmitting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors"
            >
              <Send className="h-4 w-4" />
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;
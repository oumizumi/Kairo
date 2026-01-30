'use client';

import React, { useState } from 'react';
import FeedbackModal from '@/components/FeedbackModal';
import QuickFeedback from '@/components/QuickFeedback';
import FeedbackDashboard from '@/components/FeedbackDashboard';

export default function FeedbackTestPage() {
  const [showModal, setShowModal] = useState(false);

  const sampleEmailDetails = {
    generatedSubject: "Request for Office Hours Meeting",
    generatedBody: "Dear Professor Smith,\n\nI hope this message finds you well. I would like to schedule a meeting during your office hours to discuss my progress in the course and clarify some concepts from the recent lectures.\n\nBest regards,\nJohn Doe",
    professorName: "Professor Smith",
    professorEmail: "smith@uottawa.ca",
    userModifiedSubject: false,
    userModifiedBody: true,
    finalSubjectSent: "Request for Office Hours Meeting",
    finalBodySent: "Dear Professor Smith,\n\nI hope this message finds you well. I would like to schedule a meeting during your office hours to discuss my progress in CSI2110 and clarify some concepts from the recent lectures on data structures.\n\nBest regards,\nJohn Doe"
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            AI Feedback System Test
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Test the feedback collection system for AI-generated responses.
          </p>
        </div>

        {/* Test Components */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Quick Feedback Test */}
          <div className="bg-cream dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Quick Feedback Component
            </h2>
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Sample AI Response: &quot;I can help you with that course registration question...&quot;
              </p>
              <QuickFeedback
                feedbackType="chat"
                userInput="How do I register for CSI2110?"
                aiResponse="I can help you with that course registration question. You can register for CSI2110 through uOzone during the registration period."
                onDetailedFeedback={() => setShowModal(true)}
              />
            </div>
          </div>

          {/* Detailed Feedback Test */}
          <div className="bg-cream dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Detailed Feedback Modal
            </h2>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Test Email Feedback Modal
            </button>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Opens a detailed feedback form for email generation.
            </p>
          </div>
        </div>

        {/* Analytics Dashboard */}
        <div className="bg-cream dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <FeedbackDashboard />
        </div>

        {/* Feedback Modal */}
        <FeedbackModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          feedbackType="email"
          userInput="I need to ask my professor about extending the assignment deadline"
          aiResponse={`Subject: ${sampleEmailDetails.generatedSubject}\n\nBody: ${sampleEmailDetails.generatedBody}`}
          emailDetails={sampleEmailDetails}
        />
      </div>
    </div>
  );
}
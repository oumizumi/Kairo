'use client';

import React, { useState } from 'react';
import { Mail } from 'lucide-react';

interface ChatEmailButtonProps {
  currentMessage: string;
}

const ChatEmailButton: React.FC<ChatEmailButtonProps> = ({ currentMessage }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleEmailChat = async () => {
    if (!currentMessage.trim()) {
      return;
    }

    setIsLoading(true);
    
    try {
      // Create mailto link with the chat content
      const subject = encodeURIComponent('Chat from Kairo');
      const body = encodeURIComponent(`Here's my chat message:\n\n${currentMessage}`);
      const mailtoLink = `mailto:?subject=${subject}&body=${body}`;
      
      // Open the default email client
      window.location.href = mailtoLink;
    } catch (error) {
      console.error('Error opening email client:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleEmailChat}
      disabled={!currentMessage.trim() || isLoading}
      className="p-2 rounded-full bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/15 transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
      title="Email this message"
    >
      <Mail className="h-4 w-4 text-gray-600 dark:text-gray-300" />
    </button>
  );
};

export default ChatEmailButton;


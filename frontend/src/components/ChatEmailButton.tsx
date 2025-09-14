'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Mail, Plus, X } from 'lucide-react';

interface ChatEmailButtonProps {
  currentMessage: string;
}

function isValidEmail(value: string): boolean {
  const email = value.trim();
  if (!email) return false;
  // Simple validation; good enough for UI gating
  return /.+@.+\..+/.test(email);
}

const STORAGE_KEY = 'chat_email_recipients';

const ChatEmailButton: React.FC<ChatEmailButtonProps> = ({ currentMessage }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setRecipients(parsed.filter((e) => typeof e === 'string'));
      }
    } catch {}
  }, []);

  const hasMessage = currentMessage.trim().length > 0;
  const hasRecipients = recipients.length > 0;
  const canSend = hasMessage && hasRecipients && !isLoading;

  const toParam = useMemo(() => recipients.join(','), [recipients]);

  const saveRecipients = (next: string[]) => {
    setRecipients(next);
    try {
      if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const addFromInput = () => {
    const parts = input
      .split(/[,\s]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    const valid = parts.filter(isValidEmail);
    if (valid.length) {
      const merged = Array.from(new Set([...recipients, ...valid]));
      saveRecipients(merged);
      setInput('');
    }
  };

  const removeRecipient = (email: string) => {
    saveRecipients(recipients.filter((e) => e !== email));
  };

  const handleEmailChat = async () => {
    if (!canSend) return;
    setIsLoading(true);
    try {
      const subject = encodeURIComponent('Chat from Kairo');
      const body = encodeURIComponent(`Here's my chat message:\n\n${currentMessage}`);
      const mailtoLink = `mailto:${encodeURIComponent(toParam)}?subject=${subject}&body=${body}`;
      window.location.href = mailtoLink;
    } catch (error) {
      console.error('Error opening email client:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative inline-flex">
      <button
        onClick={() => setShowPanel((v) => !v)}
        className="p-2 rounded-full bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/15 transition-colors duration-300"
        title={hasRecipients ? 'Send email' : 'Add recipients'}
        type="button"
      >
        <Mail className="h-4 w-4 text-gray-600 dark:text-gray-300" />
      </button>

      {showPanel && (
        <div className="absolute right-0 top-9 z-50 w-64 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1e1e1e] shadow-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">Email recipients</div>
            <button
              type="button"
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10"
              onClick={() => setShowPanel(false)}
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5 text-gray-500" />
            </button>
          </div>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="email1@x.com, email2@x.com"
              className="flex-1 rounded border border-gray-300 dark:border-white/10 bg-white dark:bg-[#121212] text-gray-900 dark:text-gray-100 px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500/40 focus:border-transparent"
            />
            <button
              type="button"
              onClick={addFromInput}
              className="px-2 py-1 rounded bg-gray-900 dark:bg-white text-white dark:text-black text-xs font-semibold hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {recipients.length > 0 && (
            <div className="mt-2 max-h-24 overflow-auto space-y-1">
              {recipients.map((email) => (
                <div key={email} className="flex items-center justify-between text-xs">
                  <span className="text-gray-700 dark:text-gray-200 truncate pr-2">{email}</span>
                  <button
                    type="button"
                    onClick={() => removeRecipient(email)}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={handleEmailChat}
            disabled={!canSend}
            className="mt-3 w-full rounded bg-blue-600 disabled:bg-blue-600/50 text-white text-xs font-semibold py-1.5 hover:bg-blue-700"
          >
            {isLoading ? 'Opening…' : 'Send email'}
          </button>
          {!hasRecipients && (
            <div className="mt-1 text-[10px] text-gray-500">Add at least one email to enable sending.</div>
          )}
          {!hasMessage && (
            <div className="mt-1 text-[10px] text-gray-500">Write a message to enable sending.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatEmailButton;


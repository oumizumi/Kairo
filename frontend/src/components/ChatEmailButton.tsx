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
const UOTTAWA_DOMAIN = '@uottawa.ca';

const ChatEmailButton: React.FC<ChatEmailButtonProps> = ({ currentMessage }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState<'recipients' | 'professors'>('recipients');
  const [profQuery, setProfQuery] = useState('');
  const [professors, setProfessors] = useState<Array<{ name: string; email: string }>>([]);
  const [profLoading, setProfLoading] = useState(false);

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

  const normalizeToUOttawa = (value: string): string | null => {
    const raw = value.trim();
    if (!raw) return null;
    const candidate = raw.includes('@') ? raw : `${raw}${UOTTAWA_DOMAIN}`;
    const lower = candidate.toLowerCase();
    if (!isValidEmail(candidate)) return null;
    if (!lower.endsWith(UOTTAWA_DOMAIN)) return null;
    return candidate;
  };

  const addFromInput = () => {
    const parts = input
      .split(/[\,\s]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    const valid = parts
      .map((e) => normalizeToUOttawa(e))
      .filter((e): e is string => Boolean(e));
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
      const outlookUrl = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(toParam)}&subject=${subject}&body=${body}`;
      window.open(outlookUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('Error opening email client:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendToSingle = (email: string) => {
    const to = normalizeToUOttawa(email);
    if (!to || !hasMessage) return;
    const subject = encodeURIComponent('Chat from Kairo');
    const body = encodeURIComponent(`Here's my chat message:\n\n${currentMessage}`);
    const outlookUrl = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(to)}&subject=${subject}&body=${body}`;
    window.open(outlookUrl, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    if (activeTab !== 'professors' || professors.length > 0 || profLoading) return;
    const load = async () => {
      setProfLoading(true);
      try {
        const resp = await fetch('/professors_enhanced.json', { cache: 'force-cache' });
        if (resp.ok) {
          const data = await resp.json();
          const list: Array<{ name: string; email: string }> = [];
          if (Array.isArray(data)) {
            for (const item of data) {
              const possibleName = (item as any)?.name || (item as any)?.fullName || [
                (item as any)?.firstName,
                (item as any)?.lastName,
              ].filter(Boolean).join(' ').trim();
              let email: string | undefined = (item as any)?.email || (item as any)?.work_email || (item as any)?.contactEmail;
              if (!email) {
                for (const v of Object.values(item)) {
                  if (typeof v === 'string' && /@/.test(v)) { email = v; break; }
                }
              }
              if (email) {
                const e = email.trim();
                if (isValidEmail(e) && e.toLowerCase().endsWith(UOTTAWA_DOMAIN)) {
                  list.push({ name: possibleName || e, email: e });
                }
              }
            }
          }
          setProfessors(list);
        }
      } catch {}
      setProfLoading(false);
    };
    load();
  }, [activeTab, professors.length, profLoading]);

  const filteredProfs = useMemo(() => {
    const q = profQuery.trim().toLowerCase();
    if (!q) return professors.slice(0, 20);
    return professors.filter((p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)).slice(0, 20);
  }, [profQuery, professors]);

  const addProfessor = (p: { name: string; email: string }) => {
    if (!p?.email) return;
    if (!p.email.toLowerCase().endsWith(UOTTAWA_DOMAIN)) return;
    if (recipients.includes(p.email)) return;
    saveRecipients([...recipients, p.email]);
  };

  return (
    <div className="relative inline-flex">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="p-2 rounded-full bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/15 transition-colors duration-300"
        title={hasRecipients ? 'Send email' : 'Add recipients'}
        type="button"
      >
        <Mail className="h-4 w-4 text-gray-600 dark:text-gray-300" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden bg-white dark:bg-[#1e1e1e] border-gray-200 dark:border-white/10">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/10">
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">Send with Outlook (uOttawa only)</div>
              <button
                type="button"
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/10"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            <div className="p-4">
              <div className="flex gap-2 mb-3 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('recipients')}
                  className={`px-2 py-1 rounded ${activeTab === 'recipients' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200'}`}
                >
                  Recipients
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('professors')}
                  className={`px-2 py-1 rounded ${activeTab === 'professors' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200'}`}
                >
                  Professors
                </button>
              </div>

              {activeTab === 'recipients' && (
                <>
                  <div className="flex gap-2">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={`netid${UOTTAWA_DOMAIN}, prof${UOTTAWA_DOMAIN}`}
                      className="flex-1 rounded border border-gray-300 dark:border-white/10 bg-white dark:bg-[#121212] text-gray-900 dark:text-gray-100 px-2 py-2 text-xs focus:ring-2 focus:ring-blue-500/40 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={addFromInput}
                      className="px-2 py-2 rounded bg-gray-900 dark:bg-white text-white dark:text-black text-xs font-semibold hover:opacity-90"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {recipients.length > 0 && (
                    <div className="mt-3 max-h-36 overflow-auto space-y-1">
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
                </>
              )}

              {activeTab === 'professors' && (
                <>
                  <input
                    value={profQuery}
                    onChange={(e) => setProfQuery(e.target.value)}
                    placeholder="Search professors…"
                    className="w-full rounded border border-gray-300 dark:border-white/10 bg-white dark:bg-[#121212] text-gray-900 dark:text-gray-100 px-2 py-2 text-xs focus:ring-2 focus:ring-blue-500/40 focus:border-transparent"
                  />
                  <div className="mt-3 max-h-56 overflow-auto divide-y divide-gray-100 dark:divide-white/10">
                    {profLoading && <div className="py-2 text-xs text-gray-500">Loading…</div>}
                    {!profLoading && filteredProfs.length === 0 && (
                      <div className="py-2 text-xs text-gray-500">No matches</div>
                    )}
                    {filteredProfs.map((p) => (
                      <div key={p.email} className="flex items-center justify-between py-2">
                        <div className="min-w-0 pr-2">
                          <div className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate">{p.name}</div>
                          <div className="text-[10px] text-gray-500 truncate">{p.email}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => addProfessor(p)}
                            className="px-2 py-1 rounded bg-gray-200 dark:bg-white/10 text-gray-800 dark:text-gray-100 text-[10px] font-semibold hover:opacity-90"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendToSingle(p.email)}
                            className="px-2 py-1 rounded bg-blue-600 text-white text-[10px] font-semibold hover:bg-blue-700"
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={handleEmailChat}
                disabled={!canSend}
                className="mt-4 w-full rounded bg-blue-600 disabled:bg-blue-600/50 text-white text-xs font-semibold py-2 hover:bg-blue-700"
              >
                {isLoading ? 'Opening Outlook…' : 'Open in Outlook'}
              </button>
              <div className="mt-2 text-[10px] text-gray-500">Only emails ending with <span className="font-semibold">{UOTTAWA_DOMAIN}</span> are allowed.</div>
              {!hasRecipients && (
                <div className="mt-1 text-[10px] text-gray-500">Add at least one recipient to enable sending.</div>
              )}
              {!hasMessage && (
                <div className="mt-1 text-[10px] text-gray-500">Write a message to enable sending.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatEmailButton;


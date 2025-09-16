'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mail, X, Info } from 'lucide-react';
import api from '@/lib/api';


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
const PROFESSORS_KEY = 'chat_email_professors';
const UOTTAWA_DOMAIN = '@uottawa.ca';

const ChatEmailButton: React.FC<ChatEmailButtonProps> = ({ currentMessage }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [userFullName, setUserFullName] = useState('');
  const [newProfName, setNewProfName] = useState('');
  const [newProfEmail, setNewProfEmail] = useState('');
  const [professors, setProfessors] = useState<Array<{ name: string; email: string }>>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [justGenerated, setJustGenerated] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [selectedEditingEmail, setSelectedEditingEmail] = useState<string | null>(null);
  const [selectedEditName, setSelectedEditName] = useState('');
  const [selectedEditEmail, setSelectedEditEmail] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        if (typeof window !== 'undefined') {
          const { getUserStorageItem } = await import('@/lib/userStorage');
          
          const saved = getUserStorageItem(STORAGE_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) setRecipients(parsed.filter((e) => typeof e === 'string'));
          }
          
          const savedProfs = getUserStorageItem(PROFESSORS_KEY);
          if (savedProfs) {
            const parsedProfs = JSON.parse(savedProfs);
            if (Array.isArray(parsedProfs)) {
              setProfessors(
                parsedProfs
                  .filter((p: any) => p && typeof p.email === 'string')
                  .map((p: any) => ({ name: String(p.name || ''), email: String(p.email) }))
              );
            }
          }
        }
      } catch {}
    };
    
    loadData();
  }, []);

  const hasMessage = (subject.trim().length > 0 || currentMessage.trim().length > 0) && body.trim().length > 0;
  const hasRecipients = recipients.length > 0;
  const hasName = userFullName.trim().length > 0;
  const canSend = hasMessage && hasRecipients && hasName && !isLoading;

  const toParam = useMemo(() => recipients.join(','), [recipients]);

  const saveRecipients = async (next: string[]) => {
    setRecipients(next);
    try {
      if (typeof window !== 'undefined') {
        const { setUserStorageItem } = await import('@/lib/userStorage');
        setUserStorageItem(STORAGE_KEY, JSON.stringify(next));
      }
    } catch {}
  };

  const saveProfessors = async (next: Array<{ name: string; email: string }>) => {
    setProfessors(next);
    try {
      if (typeof window !== 'undefined') {
        const { setUserStorageItem } = await import('@/lib/userStorage');
        setUserStorageItem(PROFESSORS_KEY, JSON.stringify(next));
      }
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

  const generateSubject = (message: string, name: string): string => {
    const trimmed = message.trim();
    if (trimmed.length === 0) return name ? `Regarding ${name}` : 'Inquiry';
    // Use first sentence or up to ~80 chars, no dashes
    const firstStop = trimmed.split(/(?<=\.)\s|\n/)[0] || trimmed;
    const raw = firstStop.replace(/\s*-\s*/g, ' ').trim();
    return raw.length > 80 ? `${raw.slice(0, 77)}...` : raw;
  };

  const buildEmailBody = (message: string, professorName: string, studentName: string): string => {
    const greeting = professorName ? `Dear Professor ${professorName},` : 'Dear Professor,';
    const openers = [
      'I hope this message finds you well.',
      'I hope you are doing well.',
      'I hope everything is going well.',
    ];
    const courtesyClosers = [
      'I appreciate your time and help.',
      'I appreciate your assistance.',
      'I’d be grateful for your clarification.',
    ];
    const thanksVariants = ['Thank you!', 'Thanks!'];
    const intro = openers[Math.floor(Math.random() * openers.length)];
    const ask = (message || '').trim();
    const maybeCourtesy = Math.random() < 0.5 ? `\n\n${courtesyClosers[Math.floor(Math.random() * courtesyClosers.length)]}` : '';
    const maybeThanks = Math.random() < 0.8 ? `\n\n${thanksVariants[Math.floor(Math.random() * thanksVariants.length)]}` : '';
    const closing = 'Best regards,\n' + studentName;
    const core = ask ? `${intro}\n\n${ask}${maybeCourtesy}${maybeThanks}` : `${intro}${maybeCourtesy}${maybeThanks}`;
    return `${greeting}\n\n${core}\n\n${closing}`.replace(/\n{3,}/g, '\n\n').trim();
  };

  const getGreetingProfessorName = (): string => {
    // If a selected recipient matches a known professor, use that name
    for (const email of recipients) {
      const prof = professors.find((p) => p.email === email);
      if (prof && prof.name) return prof.name;
    }
    // Otherwise, use the pending input name or first professor in list
    if (newProfName.trim()) return newProfName.trim();
    if (professors.length > 0 && professors[0].name) return professors[0].name;
    return '';
  };

  useEffect(() => {
    if (!isOpen) return;
    const profNameForGreeting = getGreetingProfessorName();
    setSubject(generateSubject(currentMessage, ''));
    setBody(buildEmailBody(currentMessage, profNameForGreeting, userFullName));
  }, [isOpen]);

  // Recipients are added from the professors list only

  const removeRecipient = (email: string) => {
    if (typeof window !== 'undefined') {
      const ok = window.confirm('Remove this selected professor from recipients?');
      if (!ok) return;
    }
    saveRecipients(recipients.filter((e) => e !== email));
  };

  const handleEmailChat = async (overrides?: { subject?: string; body?: string; to?: string }) => {
    if (!canSend) return;
    setIsLoading(true);
    try {
      const profNameForGreeting = getGreetingProfessorName();
      const chosenSubject = (overrides?.subject?.trim()) || subject.trim() || generateSubject(currentMessage, '');
      const chosenBody = (overrides?.body?.trim()) || body || buildEmailBody(currentMessage, profNameForGreeting, userFullName);
      const chosenTo = overrides?.to || toParam;
      const subjectEnc = encodeURIComponent(chosenSubject);
      const bodyEnc = encodeURIComponent(chosenBody);
      const outlookUrl = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(chosenTo)}&subject=${subjectEnc}&body=${bodyEnc}`;
      const win = window.open(outlookUrl, '_blank', 'noopener,noreferrer');
      if (!win) {
        window.location.href = outlookUrl;
      }
    } catch (error) {
      console.error('Error opening email client:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendToSingle = (email: string) => {
    const to = normalizeToUOttawa(email);
    if (!to || !hasMessage) return;
    handleEmailChat({
      to,
      subject: subject.trim() || generateSubject(currentMessage, ''),
      body: body || buildEmailBody(currentMessage, getGreetingProfessorName(), userFullName),
    });
  };

  const handleComposeBlank = (to: string) => {
    const normalized = normalizeToUOttawa(to);
    const toField = normalized ? encodeURIComponent(normalized) : encodeURIComponent(toParam);
    const outlookUrl = `https://outlook.office.com/mail/deeplink/compose?to=${toField}`;
    const win = window.open(outlookUrl, '_blank', 'noopener,noreferrer');
    if (!win) {
      window.location.href = outlookUrl;
    }
  };

  const draftWithAIThenCompose = async () => {
    if (!hasRecipients || !userFullName.trim()) return;
    setIsDrafting(true);
    const manualPrompt = body.trim();
    const chatPrompt = currentMessage.trim();
    const userPrompt = manualPrompt || chatPrompt;
    try {
      const professorName = getGreetingProfessorName();
      const instruction = `You draft professional emails for University of Ottawa students.
Return STRICT JSON: {"subject": string, "body": string}. No code fences.
Constraints:
- Subject: short (<= 60 chars), clearly tied to the user’s ask; no extra details.
- Body: 3–6 sentences. Be polite and well-explained: include a brief context sentence (why you’re writing) and a clear, specific ask. Do NOT add unnecessary information, offers, assumptions, or steps the user didn’t mention.
- Use natural, varied phrasing and connectors (not robotic or formulaic). Avoid redundancy.
- Greeting must be exactly: "Dear ${professorName ? `Professor ${professorName}` : 'Professor'},"
- Closing must be exactly: "Best regards,\\n${userFullName.trim()}"
- If the prompt is minimal/empty, infer a simple subject and a brief, appropriate body following these rules.
User prompt: ${userPrompt || '[no additional details provided]'}
`;

      const response = await api.post('/api/ai/chat/', { message: instruction });
      let content: string = (response.data && (response.data.content || response.data.message)) || '';

      // Try to extract JSON from content
      let jsonText = content;
      const codeBlockMatch = content.match(/\{[\s\S]*\}/);
      if (codeBlockMatch) jsonText = codeBlockMatch[0];

      let parsed: any = null;
      try { parsed = JSON.parse(jsonText); } catch {}

      const draftedSubject: string = (parsed && typeof parsed.subject === 'string' && parsed.subject.trim())
        ? parsed.subject.trim()
        : generateSubject(userPrompt, professorName);
      const draftedBody: string = (parsed && typeof parsed.body === 'string' && parsed.body.trim())
        ? parsed.body.trim()
        : buildEmailBody(userPrompt, professorName, userFullName);

      setSubject(draftedSubject);
      setBody(draftedBody);
      setJustGenerated(true);

      // Compose immediately using overrides to avoid stale state
      await handleEmailChat({ subject: draftedSubject, body: draftedBody });
    } catch (e) {
      // Fallback to local template
      const professorName = getGreetingProfessorName();
      const fallbackPrompt = userPrompt;
      const fbSubject = generateSubject(fallbackPrompt, professorName);
      const fbBody = buildEmailBody(fallbackPrompt, professorName, userFullName);
      setSubject(fbSubject);
      setBody(fbBody);
      await handleEmailChat({ subject: fbSubject, body: fbBody });
    } finally {
      setIsDrafting(false);
    }
  };

  // Start with empty list; users add professors manually here

  const filteredProfs = useMemo(() => professors, [professors]);

  const subjectText = useMemo(() => subject.trim() || generateSubject(currentMessage, ''), [subject, currentMessage]);
  const bodyText = useMemo(() => {
    return buildEmailBody(currentMessage, getGreetingProfessorName(), userFullName);
  }, [currentMessage, professors, recipients, newProfName, userFullName]);
  const composeUrl = useMemo(() => `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(toParam)}&subject=${encodeURIComponent(subjectText)}&body=${encodeURIComponent(bodyText)}`, [toParam, subjectText, bodyText]);

  const addProfessor = (p: { name: string; email: string }) => {
    if (!p?.email) return;
    if (!p.email.toLowerCase().endsWith(UOTTAWA_DOMAIN)) return;
    if (recipients.includes(p.email)) return;
    saveRecipients([...recipients, p.email]);
  };

  const toggleProfessor = (p: { name: string; email: string }) => {
    if (!p?.email) return;
    if (!p.email.toLowerCase().endsWith(UOTTAWA_DOMAIN)) return;
    if (recipients.includes(p.email)) {
      // unselect
      saveRecipients(recipients.filter((e) => e !== p.email));
    } else {
      // select
      saveRecipients([...recipients, p.email]);
    }
  };

  return (
    <div className="relative inline-flex">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="p-3 rounded-full bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/15 transition-all duration-300 transform hover:scale-105 active:scale-95 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
        title="Compose professional email to professor (Smart Mail)"
        type="button"
        aria-label="Open email composer for professional emails to professors"
      >
        <Mail className="h-5 w-5 text-gray-600 dark:text-gray-300" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden bg-white dark:bg-[#1e1e1e] border-gray-200 dark:border-white/10">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/10">
              <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">Email Professor (Outlook • uOttawa only)</div>
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
              <div className="grid grid-cols-1 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">Your full name <span className="text-red-500">*</span></label>
                  <input
                    value={userFullName}
                    onChange={(e) => setUserFullName(e.target.value)}
                    placeholder="e.g., Jane Doe"
                    className="w-full rounded border border-gray-300 dark:border-white/10 bg-white dark:bg-[#121212] text-gray-900 dark:text-gray-100 px-2 py-2 text-xs focus:ring-2 focus:ring-blue-500/40 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">Subject</label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g., Request to discuss assignment extension"
                    className="w-full rounded border border-gray-300 dark:border-white/10 bg-white dark:bg-[#121212] text-gray-900 dark:text-gray-100 px-2 py-2 text-xs focus:ring-2 focus:ring-blue-500/40 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">Body</label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={`Dear Professor [Name],\n\n[Write your request clearly here]\n\nBest regards,\n[Your Full Name]`}
                    rows={6}
                    ref={bodyRef}
                    className="w-full rounded border border-gray-300 dark:border-white/10 bg-white dark:bg-[#121212] text-gray-900 dark:text-gray-100 px-2 py-2 text-xs focus:ring-2 focus:ring-blue-500/40 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => {
                    setSubject('');
                    setBody('');
                    setTimeout(() => bodyRef.current?.focus(), 0);
                  }}
                  className="px-3 py-2 rounded border border-gray-300 dark:border-white/10 text-gray-700 dark:text-gray-200 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  Write it myself
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div className="grid grid-cols-5 gap-2">
                  <div className="col-span-2">
                    <input
                      value={newProfName}
                      onChange={(e) => setNewProfName(e.target.value)}
                      placeholder="Professor name"
                      className="w-full rounded border border-gray-300 dark:border-white/10 bg-white dark:bg-[#121212] text-gray-900 dark:text-gray-100 px-2 py-2 text-xs focus:ring-2 focus:ring-blue-500/40 focus:border-transparent"
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      value={newProfEmail}
                      onChange={(e) => setNewProfEmail(e.target.value)}
                      placeholder={`prof${UOTTAWA_DOMAIN}`}
                      className="w-full rounded border border-gray-300 dark:border-white/10 bg-white dark:bg-[#121212] text-gray-900 dark:text-gray-100 px-2 py-2 text-xs focus:ring-2 focus:ring-blue-500/40 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      const normalized = normalizeToUOttawa(newProfEmail || '');
                      if (!normalized) return;
                      if (professors.find((p) => p.email === normalized)) return;
                      setProfessors([...professors, { name: newProfName.trim() || normalized, email: normalized }]);
                      setNewProfName('');
                      setNewProfEmail('');
                    }}
                    className="w-full rounded bg-gray-900 dark:bg-white text-white dark:text-black text-xs font-semibold py-2 hover:opacity-90"
                  >
                    Add Professor
                  </button>
                </div>
              </div>

              {professors.length > 0 && (
                <div className="mt-3 border-t border-gray-200 dark:border-white/10 pt-3">
                  <div className="text-[11px] font-medium mb-1 text-gray-700 dark:text-gray-300">Professors</div>
                  <div className="max-h-40 overflow-auto divide-y divide-gray-100 dark:divide-white/10">
                    {professors.map((p, idx) => (
                      <div key={p.email} className="py-2 px-2 rounded flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5">
                        {editingIndex === idx ? (
                          <div className="flex-1 grid grid-cols-5 gap-2 items-center">
                            <input
                              defaultValue={p.name}
                              onBlur={(e) => {
                                const next = [...professors];
                                next[idx] = { ...next[idx], name: e.target.value };
                                setProfessors(next);
                              }}
                              className="col-span-2 rounded border border-gray-300 dark:border-white/10 bg-white dark:bg-[#121212] text-gray-900 dark:text-gray-100 px-2 py-1 text-xs"
                            />
                            <input
                              defaultValue={p.email}
                              onBlur={(e) => {
                                const normalized = normalizeToUOttawa(e.target.value || '');
                                if (!normalized) return;
                                const next = [...professors];
                                next[idx] = { ...next[idx], email: normalized };
                                setProfessors(next);
                              }}
                              className="col-span-3 rounded border border-gray-300 dark:border-white/10 bg-white dark:bg-[#121212] text-gray-900 dark:text-gray-100 px-2 py-1 text-xs"
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleProfessor(p)}
                            className="flex-1 text-left"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate">{p.name}</div>
                              <div className="text-[10px] text-gray-500 truncate">{p.email}</div>
                            </div>
                          </button>
                        )}
                        <div className="flex items-center gap-2 ml-2">
                          {editingIndex === idx ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setEditingIndex(null)}
                                className="px-2 py-1 rounded border border-gray-300 dark:border-white/10 text-[10px]"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingIndex(null)}
                                className="px-2 py-1 rounded border border-gray-300 dark:border-white/10 text-[10px]"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => setEditingIndex(idx)}
                                className="px-2 py-1 rounded border border-gray-300 dark:border-white/10 text-[10px]"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (typeof window !== 'undefined') {
                                    const ok = window.confirm('Delete this professor entry?');
                                    if (!ok) return;
                                  }
                                  saveProfessors(professors.filter((_, i) => i !== idx));
                                }}
                                className="px-2 py-1 rounded border border-gray-300 dark:border-white/10 text-[10px]"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {recipients.length > 0 && (
                <div className="mt-3">
                  <div className="text-[11px] font-medium mb-1 text-gray-700 dark:text-gray-300">Selected professors</div>
                  <div className="max-h-24 overflow-auto space-y-1">
                    {recipients.map((email) => {
                      const p = professors.find((x) => x.email === email);
                      return (
                        <div key={email} className="flex items-center justify-between text-xs gap-2">
                          {selectedEditingEmail === email ? (
                            <div className="flex-1 grid grid-cols-5 gap-2 items-center">
                              <input
                                value={selectedEditName}
                                onChange={(e) => setSelectedEditName(e.target.value)}
                                className="col-span-2 rounded border border-gray-300 dark:border-white/10 bg-white dark:bg-[#121212] text-gray-900 dark:text-gray-100 px-2 py-1 text-xs"
                              />
                              <input
                                value={selectedEditEmail}
                                onChange={(e) => setSelectedEditEmail(e.target.value)}
                                className="col-span-3 rounded border border-gray-300 dark:border-white/10 bg-white dark:bg-[#121212] text-gray-900 dark:text-gray-100 px-2 py-1 text-xs"
                              />
                            </div>
                          ) : (
                            <div className="min-w-0 pr-2 flex-1 flex items-start gap-2">
                              <input
                                type="checkbox"
                                checked={true}
                                onChange={() => saveRecipients(recipients.filter((r) => r !== email))}
                                className="mt-0.5 h-3.5 w-3.5 accent-blue-600"
                                aria-label={`Unselect ${p?.name || 'Professor'}`}
                              />
                              <div>
                                <div className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate">{p?.name || 'Professor'}</div>
                                <div className="text-[10px] text-gray-500 truncate">{email}</div>
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            {selectedEditingEmail === email ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const normalized = normalizeToUOttawa(selectedEditEmail || '');
                                    if (!normalized) return;
                                    // Update professors list
                                    const nextProfs = professors.map((prof) =>
                                      prof.email === email ? { name: selectedEditName.trim(), email: normalized } : prof
                                    );
                                    saveProfessors(nextProfs);
                                    // Update recipients if email changed
                                    if (normalized !== email) {
                                      const nextRecipients = recipients.map((r) => (r === email ? normalized : r));
                                      saveRecipients(Array.from(new Set(nextRecipients)));
                                    }
                                    setSelectedEditingEmail(null);
                                  }}
                                  className="px-2 py-1 rounded border border-gray-300 dark:border-white/10 text-[10px]"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (typeof window !== 'undefined') {
                                      const ok = window.confirm('Delete this professor entry?');
                                      if (!ok) return;
                                    }
                                    saveProfessors(professors.filter((prof) => prof.email !== email));
                                    saveRecipients(recipients.filter((r) => r !== email));
                                    setSelectedEditingEmail(null);
                                  }}
                                  className="px-2 py-1 rounded border border-gray-300 dark:border-white/10 text-[10px]"
                                >
                                  Delete
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedEditingEmail(email);
                                    setSelectedEditName(p?.name || '');
                                    setSelectedEditEmail(email);
                                  }}
                                  className="px-2 py-1 rounded border border-gray-300 dark:border-white/10 text-[10px]"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (typeof window !== 'undefined') {
                                      const ok = window.confirm('Delete this professor entry?');
                                      if (!ok) return;
                                    }
                                    saveProfessors(professors.filter((prof) => prof.email !== email));
                                    saveRecipients(recipients.filter((r) => r !== email));
                                  }}
                                  className="px-2 py-1 rounded border border-gray-300 dark:border-white/10 text-[10px]"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={draftWithAIThenCompose}
                disabled={!hasRecipients || !hasName || isDrafting}
                className="mt-4 w-full rounded bg-blue-600 disabled:bg-blue-600/50 text-white text-xs font-semibold py-2 hover:bg-blue-700"
              >
                {isDrafting ? 'Drafting with AI…' : 'Draft with AI (polish)'}
              </button>
              <div className="mt-2 text-[10px] text-red-600 dark:text-red-400 flex items-center gap-1">
                <Info className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Please review the draft before sending. AI may make mistakes.</span>
              </div>
              <a
                href="https://outlook.office.com/mail/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex w-full items-center justify-center rounded border border-gray-300 dark:border-white/10 text-gray-700 dark:text-gray-200 text-xs font-semibold py-2 hover:bg-gray-50 dark:hover:bg-white/5"
              >
                Open Outlook (Login)
              </a>
              <div className="mt-2 text-[10px] text-gray-500">Only emails ending with <span className="font-semibold">{UOTTAWA_DOMAIN}</span> are allowed.</div>
              {!hasRecipients && (
                <div className="mt-1 text-[10px] text-gray-500">Add at least one recipient to enable sending.</div>
              )}
              {!hasName && (
                <div className="mt-1 text-[10px] text-red-500">Enter your full name to include in the closing.</div>
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


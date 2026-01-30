'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mail, X, Info, ArrowRight } from 'lucide-react';
import api from '@/lib/api';
import FeedbackModal from './FeedbackModal';
import QuickFeedback from './QuickFeedback';

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
  
  // Feedback states
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [lastGeneratedEmail, setLastGeneratedEmail] = useState<{
    subject: string;
    body: string;
    userInput: string;
    professorName?: string;
    professorEmail?: string;
    userModifiedSubject?: boolean;
    userModifiedBody?: boolean;
  } | null>(null);

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
      } catch { }
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
    } catch { }
  };

  const saveProfessors = async (next: Array<{ name: string; email: string }>) => {
    setProfessors(next);
    try {
      if (typeof window !== 'undefined') {
        const { setUserStorageItem } = await import('@/lib/userStorage');
        setUserStorageItem(PROFESSORS_KEY, JSON.stringify(next));
      }
    } catch { }
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

  // Fallback functions (defined first)
  const generateFallbackSubject = (message: string, professorName: string): string => {
    const trimmed = message.trim();
    if (trimmed.length === 0) return professorName ? `Regarding ${professorName}` : 'Inquiry';
    const firstStop = trimmed.split(/(?<=\.)\s|\n/)[0] || trimmed;
    const raw = firstStop.replace(/\s*-\s*/g, ' ').trim();
    return raw.length > 80 ? `${raw.slice(0, 77)}...` : raw;
  };

  const generateFallbackEmailBody = (message: string, professorName: string, studentName: string): string => {
    const greeting = professorName ? `Dear Professor ${professorName},` : 'Dear Professor,';
    const ask = (message || '').trim();
    const body = ask || 'I hope this message finds you well. I wanted to reach out regarding our course.';
    const closing = `Best regards,\n${studentName}`;
    return `${greeting}\n\n${body}\n\n${closing}`;
  };

  // AI-powered email generation functions
  const generateAISubject = async (message: string, professorName: string): Promise<string> => {
    try {
      const instruction = `Generate a professional email subject line (under 60 characters) for a University of Ottawa student writing to ${professorName ? `Professor ${professorName}` : 'a professor'}.

User's message/request: "${message}"

Return ONLY the subject line, no quotes, no extra text. Make it specific, professional, and concise.

Examples:
- "Question about Assignment 2 deadline"
- "Request for office hours meeting"
- "Clarification on course prerequisites"
- "Extension request for final project"`;

      const response = await api.post('/api/ai/chat/', { message: instruction });
      const content = (response.data && (response.data.content || response.data.message)) || '';
      
      // Clean up the response
      const subject = content.trim().replace(/^["']|["']$/g, '').trim();
      return subject.length > 0 && subject.length <= 80 ? subject : generateFallbackSubject(message, professorName);
    } catch (error) {
      console.error('Error generating AI subject:', error);
      return generateFallbackSubject(message, professorName);
    }
  };

  const generateAIEmailBody = async (message: string, professorName: string, studentName: string): Promise<string> => {
    try {
      const instruction = `You are an expert email writing assistant for University of Ottawa students. Generate a professional, natural email body.

Context:
- Student: ${studentName}
- Professor: ${professorName ? `Professor ${professorName}` : 'Professor'}
- Student's request: "${message}"

Requirements:
1. Professional but natural tone
2. 3-5 sentences maximum
3. Vary your structure - don't always use the same pattern
4. Be specific to the student's request
5. Use appropriate greeting and closing
6. Don't add assumptions or extra steps

Return ONLY the complete email body with greeting and closing. No quotes, no extra formatting.

Structure:
- Greeting: "Dear ${professorName ? `Professor ${professorName}` : 'Professor'},"
- Body: Address their specific request naturally
- Closing: "Best regards,\\n${studentName}"`;

      const response = await api.post('/api/ai/chat/', { message: instruction });
      const content = (response.data && (response.data.content || response.data.message)) || '';
      
      const emailBody = content.trim();
      return emailBody.length > 0 ? emailBody : generateFallbackEmailBody(message, professorName, studentName);
    } catch (error) {
      console.error('Error generating AI email body:', error);
      return generateFallbackEmailBody(message, professorName, studentName);
    }
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
    const generateInitialContent = async () => {
      const profNameForGreeting = getGreetingProfessorName();
      if (currentMessage.trim() && userFullName.trim()) {
        try {
          const [aiSubject, aiBody] = await Promise.all([
            generateAISubject(currentMessage, profNameForGreeting),
            generateAIEmailBody(currentMessage, profNameForGreeting, userFullName)
          ]);
          setSubject(aiSubject);
          setBody(aiBody);
        } catch (error) {
          console.error('Error generating AI content:', error);
          // Fallback to simple generation
          setSubject(generateSubject(currentMessage, ''));
          setBody(buildEmailBody(currentMessage, profNameForGreeting, userFullName));
        }
      } else {
        setSubject(generateSubject(currentMessage, ''));
        setBody(buildEmailBody(currentMessage, profNameForGreeting, userFullName));
      }
    };
    generateInitialContent();
  }, [isOpen, currentMessage, userFullName]);

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
      
      // Use AI-generated content if available, otherwise fallback
      let chosenSubject = overrides?.subject?.trim() || subject.trim();
      let chosenBody = overrides?.body?.trim() || body;
      
      // If no subject/body and we have a message, try to generate with AI
      if (!chosenSubject && currentMessage.trim()) {
        try {
          chosenSubject = await generateAISubject(currentMessage, profNameForGreeting);
        } catch (error) {
          chosenSubject = generateSubject(currentMessage, '');
        }
      }
      
      if (!chosenBody && currentMessage.trim()) {
        try {
          chosenBody = await generateAIEmailBody(currentMessage, profNameForGreeting, userFullName);
        } catch (error) {
          chosenBody = buildEmailBody(currentMessage, profNameForGreeting, userFullName);
        }
      }
      
      // Final fallbacks
      if (!chosenSubject) chosenSubject = generateSubject(currentMessage, '');
      if (!chosenBody) chosenBody = buildEmailBody(currentMessage, profNameForGreeting, userFullName);
      
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

  const handleSendToSingle = async (email: string) => {
    const to = normalizeToUOttawa(email);
    if (!to || !hasMessage) return;
    
    const profNameForGreeting = getGreetingProfessorName();
    let emailSubject = subject.trim();
    let emailBody = body;
    
    // Generate AI content if not already present
    if (!emailSubject && currentMessage.trim()) {
      try {
        emailSubject = await generateAISubject(currentMessage, profNameForGreeting);
      } catch (error) {
        emailSubject = generateSubject(currentMessage, '');
      }
    }
    
    if (!emailBody && currentMessage.trim()) {
      try {
        emailBody = await generateAIEmailBody(currentMessage, profNameForGreeting, userFullName);
      } catch (error) {
        emailBody = buildEmailBody(currentMessage, profNameForGreeting, userFullName);
      }
    }
    
    handleEmailChat({
      to,
      subject: emailSubject || generateSubject(currentMessage, ''),
      body: emailBody || buildEmailBody(currentMessage, profNameForGreeting, userFullName),
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

    const userSubject = subject.trim();
    const userBody = body.trim();
    const chatMessage = currentMessage.trim();

    try {
      const professorName = getGreetingProfessorName();

      // Create intelligent AI instruction based on user input
      let instruction = '';
      let needsSubject = !userSubject;
      let needsBody = !userBody;

      if (!needsSubject && !needsBody) {
        // User provided both - AI should polish/improve them
        instruction = `You are Kairo, an intelligent email writing assistant for University of Ottawa students. Analyze and enhance the user's email while preserving their intent and voice.

Context: Student writing to ${professorName ? `Professor ${professorName}` : 'a professor'} at uOttawa.

User's Subject: "${userSubject}"
User's Message: "${userBody}"
${chatMessage ? `Additional Context: "${chatMessage}"` : ''}

Task: Polish and improve this email while maintaining the student's authentic voice and intent.

Return ONLY valid JSON: {"subject": string, "body": string}

Requirements:
- Subject: Professional, concise (under 60 chars), captures main point
- Body: Well-structured, respectful tone, clear purpose, proper academic etiquette
- Greeting: "Dear ${professorName ? `Professor ${professorName}` : 'Professor'},"
- Closing: "Best regards,\\n${userFullName.trim()}"
- Preserve student's specific requests and concerns
- Use natural, conversational academic language
- Be specific and actionable when possible`;
      } else if (!needsSubject && needsBody) {
        // User provided subject only - generate body based on subject
        instruction = `You are an expert email writing assistant for University of Ottawa students. The user provided a subject line. Generate a professional email body that matches this subject.

Return STRICT JSON: {"subject": string, "body": string}. NO markdown, NO code fences, just raw JSON.

User's Subject: "${userSubject}"
${chatMessage ? `Additional Context: "${chatMessage}"` : ''}

Requirements:
1. Subject Line:
   - Return the same subject (or slightly polished version): "${userSubject}"

2. Email Body (3-5 sentences):
   - Write content that directly relates to the subject
   - Be professional, concise, and specific
   - Greeting: "Dear ${professorName ? `Professor ${professorName}` : 'Professor'},"
   - Closing: "Best regards,\\n${userFullName.trim()}"
   - Match the tone to the subject (urgent, formal, casual question, etc.)
   - Vary your structure - don't always follow the same pattern

Generate a professional email body for this subject.`;
      } else if (needsSubject && !needsBody) {
        // User provided body only - generate subject based on body
        instruction = `You are an expert email writing assistant for University of Ottawa students. The user wrote an email message. Generate a professional subject line and polish the body.

Return STRICT JSON: {"subject": string, "body": string}. NO markdown, NO code fences, just raw JSON.

User's Message: "${userBody}"

Requirements:
1. Subject Line:
   - Create a concise subject (under 60 characters) that captures the main point
   - Make it specific and professional

2. Email Body:
   - Use the user's message as the core content
   - Format it professionally with greeting and closing
   - Keep the user's intent and main points
   - Polish grammar and clarity
   - Keep it concise (3-5 sentences)
   - Greeting: "Dear ${professorName ? `Professor ${professorName}` : 'Professor'},"
   - Closing: "Best regards,\\n${userFullName.trim()}"

Generate subject and polish the email body.`;
      } else {
        // User provided neither - use chat message or generate generic
        const userRequest = chatMessage || '[Generate a simple, professional inquiry]';
        instruction = `You are an expert email writing assistant for University of Ottawa students. Generate a professional email based on the user's request.

Return STRICT JSON: {"subject": string, "body": string}. NO markdown, NO code fences, just raw JSON.

User's Request: "${userRequest}"

Requirements:
1. Subject Line:
   - Keep it under 60 characters
   - Make it specific to the request
   - Be direct and professional

2. Email Body (3-5 sentences):
   - Be professional and concise
   - Vary your structure - don't follow the same pattern every time
   - Be SPECIFIC to the user's request
   - Match the tone appropriately
   - Greeting: "Dear ${professorName ? `Professor ${professorName}` : 'Professor'},"
   - Closing: "Best regards,\\n${userFullName.trim()}"

Generate a professional email that addresses this request.`;
      }

      const response = await api.post('/api/ai/chat/', { message: instruction });
      let content: string = (response.data && (response.data.content || response.data.message)) || '';

      // Try to extract JSON from content
      let jsonText = content;
      const codeBlockMatch = content.match(/\{[\s\S]*\}/);
      if (codeBlockMatch) jsonText = codeBlockMatch[0];

      let parsed: any = null;
      try { parsed = JSON.parse(jsonText); } catch { }

      // Use AI-generated content or fallback to AI individual functions, then templates
      let draftedSubject: string;
      let draftedBody: string;
      
      if (parsed && typeof parsed.subject === 'string' && parsed.subject.trim()) {
        draftedSubject = parsed.subject.trim();
      } else if (userSubject) {
        draftedSubject = userSubject;
      } else {
        // Try individual AI generation as fallback
        try {
          draftedSubject = await generateAISubject(chatMessage || userBody || 'Email request', professorName);
        } catch (error) {
          draftedSubject = generateSubject(chatMessage || userBody, professorName);
        }
      }
      
      if (parsed && typeof parsed.body === 'string' && parsed.body.trim()) {
        draftedBody = parsed.body.trim();
      } else if (userBody) {
        draftedBody = userBody;
      } else {
        // Try individual AI generation as fallback
        try {
          draftedBody = await generateAIEmailBody(chatMessage || userSubject || 'Email request', professorName, userFullName);
        } catch (error) {
          draftedBody = buildEmailBody(chatMessage || userSubject, professorName, userFullName);
        }
      }

      setSubject(draftedSubject);
      setBody(draftedBody);
      setJustGenerated(true);

      // Store for feedback tracking
      setLastGeneratedEmail({
        subject: draftedSubject,
        body: draftedBody,
        userInput: chatMessage || userBody || userSubject || 'Email generation request',
        professorName: professorName,
        professorEmail: recipients[0], // First recipient
        userModifiedSubject: userSubject !== draftedSubject,
        userModifiedBody: userBody !== draftedBody,
      });

      // Compose immediately using overrides to avoid stale state
      await handleEmailChat({ subject: draftedSubject, body: draftedBody });
    } catch (e) {
      console.error('AI drafting error:', e);
      // Fallback to individual AI functions, then simple generation
      const professorName = getGreetingProfessorName();
      const fallbackPrompt = userBody || chatMessage || userSubject || 'Email request';
      
      let fbSubject = userSubject;
      let fbBody = userBody;
      
      if (!fbSubject) {
        try {
          fbSubject = await generateAISubject(fallbackPrompt, professorName);
        } catch (error) {
          fbSubject = generateSubject(fallbackPrompt, professorName);
        }
      }
      
      if (!fbBody) {
        try {
          fbBody = await generateAIEmailBody(fallbackPrompt, professorName, userFullName);
        } catch (error) {
          fbBody = buildEmailBody(fallbackPrompt, professorName, userFullName);
        }
      }
      
      setSubject(fbSubject);
      setBody(fbBody);
      await handleEmailChat({ subject: fbSubject, body: fbBody });
    } finally {
      setIsDrafting(false);
    }
  };

  // Start with empty list; users add professors manually here

  const filteredProfs = useMemo(() => professors, [professors]);

  const subjectText = useMemo(() => {
    if (subject.trim()) return subject.trim();
    return generateSubject(currentMessage, ''); // Fallback for preview
  }, [subject, currentMessage]);
  
  const bodyText = useMemo(() => {
    if (body.trim()) return body.trim();
    return buildEmailBody(currentMessage, getGreetingProfessorName(), userFullName); // Fallback for preview
  }, [body, currentMessage, professors, recipients, newProfName, userFullName]);
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
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800 group"
        type="button"
        aria-label="Open email composer for professional emails to professors"
      >
        <Mail className="h-4 w-4 text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
      </button>

      {/* Hover Tooltip */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
        Smart Mail
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setIsOpen(false)} />
          <div className="relative w-full max-w-sm sm:max-w-md rounded-xl shadow-2xl border overflow-hidden bg-cream dark:bg-gray-900 border-gray-200 dark:border-gray-700 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-2.5 sm:p-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">Smart Mail</div>
                <div className="hidden sm:block text-xs text-gray-500 dark:text-gray-400">• uOttawa only</div>
              </div>
              <button
                type="button"
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              </button>
            </div>

            <div className="p-2.5 sm:p-4">
              <div className="grid grid-cols-1 gap-2.5 sm:gap-3 mb-2.5 sm:mb-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5 sm:mb-2 text-gray-700 dark:text-gray-300">Your full name <span className="text-red-500">*</span></label>
                  <input
                    value={userFullName}
                    onChange={(e) => setUserFullName(e.target.value)}
                    placeholder="e.g., Jane Doe"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-cream dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 sm:py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:gap-3 mb-2.5 sm:mb-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Subject</label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g., Request to discuss assignment extension"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-cream dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 sm:py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-gray-700 dark:text-gray-300">Body</label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={`Dear Professor [Name],\n\n[Write your request clearly here]\n\nBest regards,\n[Your Full Name]`}
                    rows={3}
                    ref={bodyRef}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-cream dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 sm:py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 mb-2.5 sm:mb-3">
                <button
                  type="button"
                  onClick={async () => {
                    if (!currentMessage.trim() && !subject.trim() && !body.trim()) {
                      alert('Please enter a message or some content first');
                      return;
                    }
                    
                    const profName = getGreetingProfessorName();
                    const inputText = currentMessage.trim() || subject.trim() || body.trim();
                    
                    try {
                      setIsDrafting(true);
                      const [aiSubject, aiBody] = await Promise.all([
                        generateAISubject(inputText, profName),
                        generateAIEmailBody(inputText, profName, userFullName)
                      ]);
                      setSubject(aiSubject);
                      setBody(aiBody);
                      setJustGenerated(true);
                    } catch (error) {
                      console.error('Error generating AI content:', error);
                      alert('Failed to generate AI content. Please try again.');
                    } finally {
                      setIsDrafting(false);
                    }
                  }}
                  disabled={isDrafting || !userFullName.trim()}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 disabled:bg-blue-400 text-white text-xs sm:text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  {isDrafting ? 'Generating...' : 'Generate with AI'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSubject('');
                    setBody('');
                    setTimeout(() => bodyRef.current?.focus(), 0);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-xs sm:text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Clear & Write Myself
                </button>
              </div>

              <div className="border-t border-gray-100 dark:border-gray-700 pt-2.5 sm:pt-3">
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Add Professor</label>
                <div className="grid grid-cols-1 gap-2">
                  <div className="grid grid-cols-5 gap-2 sm:gap-3">
                    <div className="col-span-2">
                      <input
                        value={newProfName}
                        onChange={(e) => setNewProfName(e.target.value)}
                        placeholder="Professor name"
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-cream dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2.5 py-1.5 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        value={newProfEmail}
                        onChange={(e) => setNewProfEmail(e.target.value)}
                        placeholder={`prof${UOTTAWA_DOMAIN}`}
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-cream dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2.5 py-1.5 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
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
                      className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-xs sm:text-sm font-medium py-1.5 sm:py-2 transition-all shadow-sm"
                    >
                      Add Professor
                    </button>
                  </div>
                </div>
              </div>

              {professors.length > 0 && (
                <div className="mt-3 border-t border-gray-200 dark:border-white/10 pt-3">
                  <div className="text-[11px] font-medium mb-1 text-gray-700 dark:text-gray-300">Professors</div>
                  <div className="max-h-40 overflow-auto divide-y divide-gray-100 dark:divide-white/10">
                    {professors.map((p, idx) => (
                      <div key={p.email} className="py-2 px-2 rounded flex items-center justify-between hover:bg-gray-50 dark:hover:bg-cream/5">
                        {editingIndex === idx ? (
                          <div className="flex-1 grid grid-cols-5 gap-2 items-center">
                            <input
                              defaultValue={p.name}
                              onBlur={(e) => {
                                const next = [...professors];
                                next[idx] = { ...next[idx], name: e.target.value };
                                setProfessors(next);
                              }}
                              className="col-span-2 rounded border border-gray-300 dark:border-white/10 bg-cream dark:bg-[#121212] text-gray-900 dark:text-gray-100 px-2 py-1 text-xs"
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
                              className="col-span-3 rounded border border-gray-300 dark:border-white/10 bg-cream dark:bg-[#121212] text-gray-900 dark:text-gray-100 px-2 py-1 text-xs"
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
                                className="col-span-2 rounded border border-gray-300 dark:border-white/10 bg-cream dark:bg-[#121212] text-gray-900 dark:text-gray-100 px-2 py-1 text-xs"
                              />
                              <input
                                value={selectedEditEmail}
                                onChange={(e) => setSelectedEditEmail(e.target.value)}
                                className="col-span-3 rounded border border-gray-300 dark:border-white/10 bg-cream dark:bg-[#121212] text-gray-900 dark:text-gray-100 px-2 py-1 text-xs"
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
                className="mt-3 w-full rounded bg-blue-600 disabled:bg-blue-600/50 text-white text-xs font-semibold py-1.5 sm:py-2 hover:bg-blue-700"
              >
                {isDrafting ? 'Drafting with AI…' : 'Draft with AI (polish)'}
              </button>
              <div className="mt-1.5 text-[9px] sm:text-[10px] text-red-600 dark:text-red-400 flex items-center gap-1">
                <Info className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
                <span>Please review the draft before sending. AI may make mistakes.</span>
              </div>
              <a
                href="https://outlook.office.com/mail/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex w-full items-center justify-center rounded border border-gray-300 dark:border-white/10 text-gray-700 dark:text-gray-200 text-xs font-semibold py-1.5 sm:py-2 hover:bg-gray-50 dark:hover:bg-cream/5"
              >
                Open Outlook (Login)
              </a>
              <div className="mt-2 text-[10px] text-gray-500">Only emails ending with <span className="font-semibold">{UOTTAWA_DOMAIN}</span> are allowed.</div>
              {!hasRecipients && (
                <div className="mt-1 text-[10px] text-gray-500">Add at least one recipient to enable sending.</div>
              )}
              {!hasName && (
                <div className="mt-1 text-[10px] text-red-500"></div>
              )}
              {!hasMessage && (
                <div className="mt-1 text-[10px] text-gray-500">Write a message to enable sending.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && lastGeneratedEmail && (
        <FeedbackModal
          isOpen={showFeedbackModal}
          onClose={() => setShowFeedbackModal(false)}
          feedbackType="email"
          userInput={lastGeneratedEmail.userInput}
          aiResponse={`Subject: ${lastGeneratedEmail.subject}\n\nBody: ${lastGeneratedEmail.body}`}
          emailDetails={{
            generatedSubject: lastGeneratedEmail.subject,
            generatedBody: lastGeneratedEmail.body,
            professorName: lastGeneratedEmail.professorName,
            professorEmail: lastGeneratedEmail.professorEmail,
            userModifiedSubject: lastGeneratedEmail.userModifiedSubject,
            userModifiedBody: lastGeneratedEmail.userModifiedBody,
            finalSubjectSent: subject,
            finalBodySent: body,
          }}
        />
      )}
    </div>
  );
};

export default ChatEmailButton;


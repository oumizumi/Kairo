"use client";

import { useEffect, useState } from 'react';
import { Calendar, BookOpen, MessageSquare, Mail, Play, CheckCircle2, Sparkles, Clock, Shield, Users, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import StatsMarquee from '@/components/StatsMarquee';

type FeatureKey = 'schedule' | 'intelligence' | 'assistant' | 'mail';

const TABS: Array<{
  key: FeatureKey;
  title: string;
  subtitle: string;
  icon: any;
}> = [
  { key: 'schedule', title: 'Smart Schedule Generation', subtitle: 'Conflict‑free, section‑aware planning', icon: Calendar },
  { key: 'intelligence', title: 'Course & Section Intelligence', subtitle: 'Real sections and availability', icon: BookOpen },
  { key: 'assistant', title: 'Ask Anything — GPT', subtitle: 'Programs, sequences, prerequisites', icon: MessageSquare },
  { key: 'mail', title: 'Smart Mail', subtitle: 'AI‑powered professional emails', icon: Mail },
];

const HOW_IT_WORKS: Array<{ icon: any; title: string; description: string }>= [
  { icon: Sparkles, title: 'Tell Kairo your goals', description: 'Pick your program/term or paste courses. Kairo understands prerequisites automatically.' },
  { icon: Clock, title: 'We build a schedule', description: 'Open sections first, balanced days, no conflicts — labs and tutorials included.' },
  { icon: Shield, title: 'Save & sync', description: 'One click to add to your calendar. Update anytime in the chat.' },
];

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: 'Is Kairo free to use?',
    a: 'Yes. You can generate schedules and explore courses for free. Creating an account unlocks saving, syncing, and sharing.'
  },
  {
    q: 'Which universities are supported?',
    a: 'We currently focus on the University of Ottawa (uOttawa). More schools are on our roadmap.'
  },
  {
    q: 'How accurate is the data and how often is it updated?',
    a: 'We sync from the official catalogue and live section listings. During enrollment, scrapers run often—and you can manually refresh in‑app to pull the latest sections and times.'
  },
  {
    q: 'Can I set time preferences or no-class days?',
    a: 'Yes. Set earliest/latest times, no-class days, and minimum break windows. The generator respects these constraints and avoids conflicts.'
  },
  {
    q: 'Can I export to Google/Apple/Outlook Calendar?',
    a: 'Yes. Export or subscribe via ICS so events (days, times, locations) stay in sync.'
  },
];

export default function Features() {
  const [active, setActive] = useState<FeatureKey>('schedule');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [courseCount, setCourseCount] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseStartTime, setPauseStartTime] = useState<number | null>(null);

  useEffect(() => {
    fetch('/all_courses_flattened.json')
      .then((r) => r.json())
      .then((data: unknown) => {
        let count: number = 0;
        if (Array.isArray(data)) {
          count = data.length;
        } else if (data && typeof data === 'object') {
          const values = Object.values(data as Record<string, unknown>);
          count = values.reduce((acc: number, v: unknown) => acc + (Array.isArray(v) ? v.length : 0), 0);
        }
        setCourseCount(count);
      })
      .catch(() => setCourseCount(null));
  }, []);

  // Auto-rotation effect
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isPaused) {
        setActive(prev => {
          const currentIndex = TABS.findIndex(tab => tab.key === prev);
          const nextIndex = (currentIndex + 1) % TABS.length;
          return TABS[nextIndex].key;
        });
      } else if (pauseStartTime) {
        // Check if pause has exceeded 30 seconds
        const pauseDuration = Date.now() - pauseStartTime;
        if (pauseDuration > 30000) { // 30 seconds
          setIsPaused(false);
          setPauseStartTime(null);
        }
      }
    }, 7000); // 7 seconds

    return () => clearInterval(interval);
  }, [isPaused, pauseStartTime]);

  const handleTabInteraction = (key: FeatureKey) => {
    setActive(key);
    setIsPaused(true);
    setPauseStartTime(Date.now());
  };

  const handleMouseEnter = () => {
    if (!isPaused) {
      setIsPaused(true);
      setPauseStartTime(Date.now());
    }
  };

  const handleMouseLeave = () => {
    // Don't immediately resume - let the 30-second timer handle it
  };

  return (
    <section className="py-16 sm:py-24 bg-slate-50 dark:bg-[rgb(var(--background-rgb))] dark:refined-dark-grid square-grid-bg-light relative overflow-hidden border-t border-gray-200 dark:border-[rgb(var(--border-color))]">
      {/* Ambient lighting */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50/30 via-transparent to-gray-100/30 dark:from-transparent dark:via-transparent dark:to-transparent" />
      <div className="absolute inset-0 hidden dark:block">
        <div className="absolute top-1/4 left-1/4 w-[520px] h-[260px] bg-gradient-radial from-[rgb(var(--accent-color))]/6 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[440px] h-[220px] bg-gradient-radial from-[rgb(var(--accent-color))]/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[180px] bg-gradient-radial from-[rgb(var(--accent-color))]/6 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-14 flex flex-col items-center gap-2 sm:gap-3">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent"
          >
            What Kairo Can Do
          </motion.h2>
          <p className="text-base sm:text-lg text-gray-600 dark:text-[rgb(var(--text-secondary))] max-w-3xl mx-auto">Essential tools for modern university life</p>
          <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-purple-500 dark:from-blue-400 dark:to-purple-400 mx-auto mt-4 rounded-full" />
        </div>

        {/* Showcase container */}
        <div 
          className="rounded-3xl overflow-hidden border-2 border-gray-200 dark:border-[rgb(var(--border-color))] bg-white dark:bg-[rgb(var(--secondary-bg))] shadow-xl"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="grid grid-cols-1 lg:grid-cols-5">
            {/* Tabs */}
            <div className="col-span-2 p-4 sm:p-6 lg:p-8 bg-slate-50/70 dark:bg-white/[0.02] border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-[rgb(var(--border-color))]">
              <div className="space-y-3">
                {TABS.map(({ key, title, subtitle, icon: Icon }) => {
                  const selected = active === key;
                  return (
                    <button
                      key={key}
                      onMouseEnter={() => handleTabInteraction(key)}
                      onClick={() => handleTabInteraction(key)}
                      className={`w-full text-left rounded-2xl p-4 transition-all border ${
                        selected
                          ? 'bg-white dark:bg-white/5 border-gray-300 dark:border-[rgb(var(--border-color))] shadow-sm'
                          : 'bg-white/60 dark:bg-white/[0.02] hover:bg-white dark:hover:bg-white/[0.04] border-gray-200 dark:border-[rgb(var(--border-color))]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${selected ? 'bg-black dark:bg-white' : 'bg-gray-900/90 dark:bg-white/10'} ${selected ? 'border-black/10 dark:border-[rgb(var(--border-color))]' : 'border-gray-200 dark:border-[rgb(var(--border-color))]'}`}>
                          <Icon className={`w-5 h-5 ${selected ? 'text-white dark:text-black' : 'text-white dark:text-white/80'}`} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-[rgb(var(--text-primary))]">{title}</div>
                          <div className="text-xs text-gray-600 dark:text-[rgb(var(--text-secondary))]">{subtitle}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Quick hits */}
              <div className="mt-6 grid grid-cols-2 gap-2 text-xs">
                {[['Zero conflicts','Schedule'],['Real ratings','Courses'],['Instant answers','Assistant'],['Pro formatting','Mail']].map(([label, tag]) => (
                  <div key={label} className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-[rgb(var(--border-color))] bg-white/70 dark:bg-white/[0.03] px-2 py-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-gray-800 dark:text-[rgb(var(--text-primary))]">{label}</span>
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-[rgb(var(--text-secondary))]">{tag}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview Panel */}
            <div className="col-span-3 relative min-h-[360px] sm:min-h-[420px] p-4 sm:p-6 lg:p-8">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-emerald-500/5 dark:from-white/[0.04] dark:via-white/[0.03] dark:to-white/[0.02]" />
              <AnimatePresence mode="wait">
                {active === 'schedule' && (
                  <motion.div
                    key="schedule"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.4 }}
                    className="relative z-10 h-full"
                  >
                    <div className="h-full rounded-2xl border border-gray-200 dark:border-[rgb(var(--border-color))] bg-gray-50/50 dark:bg-[rgb(var(--card-bg))] p-4 sm:p-6 flex flex-col">
                      <div className="mb-4">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-[rgb(var(--text-primary))]">Smart Schedule Generation</h4>
                        <p className="text-sm text-gray-600 dark:text-[rgb(var(--text-secondary))]">Conflict-free, optimized timetables</p>
                      </div>

                      <div className="flex-1 space-y-4">
                        <div className="rounded-lg border border-gray-200 dark:border-[rgb(var(--border-color))] bg-gray-50 dark:bg-white/[0.02] p-3">
                          <div className="text-xs text-gray-500 dark:text-[rgb(var(--text-secondary))] mb-2">Your courses:</div>
                          <div className="space-y-1 text-sm text-gray-700 dark:text-[rgb(var(--text-primary))]">
                            <div>• CSI 2110 - Data Structures and Algorithms</div>
                            <div>• CSI 3105 - Design and Analysis of Algorithms I</div>
                            <div>• CSI 4106 - Introduction to Artificial Intelligence</div>
                          </div>
                        </div>

                        <div className="flex justify-center">
                          <div className="text-gray-400 dark:text-gray-500 text-xl">
                            ↓
                          </div>
                        </div>

                        <div className="rounded-lg border border-gray-200 dark:border-[rgb(var(--border-color))] bg-gray-50 dark:bg-[rgb(var(--card-bg))] p-3">
                          <div className="text-xs text-gray-500 dark:text-[rgb(var(--text-secondary))] mb-2">Generated schedule:</div>
                          <div className="grid grid-cols-3 gap-1 text-xs">
                            <div className="text-center font-medium text-gray-700 dark:text-[rgb(var(--text-primary))]">Mon</div>
                            <div className="text-center font-medium text-gray-700 dark:text-[rgb(var(--text-primary))]">Wed</div>
                            <div className="text-center font-medium text-gray-700 dark:text-[rgb(var(--text-primary))]">Fri</div>
                            <div className="bg-blue-100 dark:bg-blue-600/15 p-1 rounded text-center">CSI2110<br/>10:00</div>
                            <div className="bg-green-100 dark:bg-green-600/15 p-1 rounded text-center">CSI3105<br/>11:30</div>
                            <div className="bg-purple-100 dark:bg-purple-600/15 p-1 rounded text-center">CSI4106<br/>14:30</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-[rgb(var(--text-secondary))]">
                          <span>✓ No conflicts</span>
                          <span>✓ Balanced days</span>
                          <span>✓ Open sections</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {active === 'intelligence' && (
                  <motion.div
                    key="intelligence"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.4 }}
                    className="relative z-10 h-full"
                  >
                    <div className="h-full rounded-2xl border border-gray-200 dark:border-[rgb(var(--border-color))] bg-gray-50/50 dark:bg-[rgb(var(--card-bg))] p-4 sm:p-6 flex flex-col">
                      <div className="mb-4">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-[rgb(var(--text-primary))]">Course & Section Intelligence</h4>
                        <p className="text-sm text-gray-600 dark:text-[rgb(var(--text-secondary))]">Real sections, availability, and details</p>
                      </div>

                      <div className="flex-1 space-y-4">
                        <div className="rounded-lg border border-gray-200 dark:border-[rgb(var(--border-color))] bg-gray-50 dark:bg-white/[0.02] p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium text-gray-900 dark:text-[rgb(var(--text-primary))]">CSI 2110 - Data Structures and Algorithms</div>
                            <div className="text-xs bg-green-100 dark:bg-green-600/15 text-green-700 dark:text-green-300 px-2 py-1 rounded">Open</div>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-[rgb(var(--text-secondary))]">Abdelkrim El Basraoui • RMP: 4.0/5</div>
                        </div>

                        <div className="rounded-lg border border-gray-200 dark:border-[rgb(var(--border-color))] bg-gray-50 dark:bg-white/[0.02] p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium text-gray-900 dark:text-[rgb(var(--text-primary))]">CSI 3105 - Design and Analysis of Algorithms I</div>
                            <div className="text-xs bg-red-100 dark:bg-red-600/15 text-red-700 dark:text-red-300 px-2 py-1 rounded">Closed</div>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-[rgb(var(--text-secondary))]">Aaron Tikuisis • RMP: 2.3/5</div>
                        </div>

                        <div className="rounded-lg border border-gray-200 dark:border-[rgb(var(--border-color))] bg-gray-50 dark:bg-[rgb(var(--card-bg))] p-3">
                          <div className="text-xs text-gray-500 dark:text-[rgb(var(--text-secondary))] mb-2">More sections:</div>
                          <div className="space-y-2 text-sm text-gray-700 dark:text-[rgb(var(--text-primary))]">
                            <div className="flex items-center justify-between">
                              <span>CSI 4106 - Introduction to Artificial Intelligence</span>
                              <div className="text-xs bg-green-100 dark:bg-green-600/15 text-green-700 dark:text-green-300 px-2 py-1 rounded">Open</div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>CSI 2372 - Advanced Programming Concepts With C++</span>
                              <div className="text-xs bg-red-100 dark:bg-red-600/15 text-red-700 dark:text-red-300 px-2 py-1 rounded">Closed</div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-[rgb(var(--text-secondary))]">
                          <span>✓ Live sections</span>
                          <span>✓ RMP ratings</span>
                          <span>✓ Open/Closed status</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {active === 'assistant' && (
                  <motion.div
                    key="assistant"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.4 }}
                    className="relative z-10 h-full"
                  >
                    <div className="h-full rounded-2xl border border-gray-200 dark:border-[rgb(var(--border-color))] bg-gray-50/50 dark:bg-[rgb(var(--card-bg))] p-4 sm:p-6 flex flex-col">
                      <div className="mb-4">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-[rgb(var(--text-primary))]">AI Assistant</h4>
                        <p className="text-sm text-gray-600 dark:text-[rgb(var(--text-secondary))]">Ask anything about courses and programs</p>
                      </div>

                      <div className="flex-1 space-y-4">
                        <div className="rounded-lg border border-gray-200 dark:border-[rgb(var(--border-color))] bg-gray-50 dark:bg-white/[0.02] p-3">
                          <div className="text-xs text-gray-500 dark:text-[rgb(var(--text-secondary))] mb-2">You ask:</div>
                          <div className="text-sm text-gray-700 dark:text-[rgb(var(--text-primary))]">
                            "What are the prerequisites for CSI 3105?"
                          </div>
                        </div>

                        <div className="flex justify-center">
                          <div className="text-gray-400 dark:text-gray-500 text-xl">
                            ↓
                          </div>
                        </div>

                        <div className="rounded-lg border border-gray-200 dark:border-[rgb(var(--border-color))] bg-gray-50 dark:bg-[rgb(var(--card-bg))] p-3">
                          <div className="text-xs text-gray-500 dark:text-[rgb(var(--text-secondary))] mb-2">Kairo responds:</div>
                          <div className="text-sm text-gray-700 dark:text-[rgb(var(--text-primary))] space-y-2">
                            <div><strong>CSI 3105 - Design and Analysis of Algorithms I</strong></div>
                            <div><strong>Prerequisites:</strong></div>
                            <div>• CSI 2110 (Data Structures and Algorithms)</div>
                            <div>• MAT 1341 (Introduction to Discrete Mathematics)</div>
                            <div><strong>Note:</strong> Strong foundation in data structures is essential for this course.</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-[rgb(var(--text-secondary))]">
                          <span>✓ Instant answers</span>
                          <span>✓ Course details</span>
                          <span>✓ Program guidance</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {active === 'mail' && (
                  <motion.div
                    key="mail"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.4 }}
                    className="relative z-10 h-full"
                  >
                    <div className="h-full rounded-2xl border border-gray-200 dark:border-[rgb(var(--border-color))] bg-gray-50/50 dark:bg-[rgb(var(--card-bg))] p-4 sm:p-6 flex flex-col">
                      <div className="mb-4">
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-[rgb(var(--text-primary))]">Professional Email Composition</h4>
                        <p className="text-sm text-gray-600 dark:text-[rgb(var(--text-secondary))]">AI-powered email formatting for professors</p>
                      </div>

                      <div className="flex-1 space-y-4">
                        <div className="rounded-lg border border-gray-200 dark:border-[rgb(var(--border-color))] bg-gray-50 dark:bg-white/[0.02] p-3">
                          <div className="text-xs text-gray-500 dark:text-[rgb(var(--text-secondary))] mb-2">Your input:</div>
                          <div className="text-sm text-gray-700 dark:text-[rgb(var(--text-primary))]">
                            "Can I get an extension on the assignment?"
                          </div>
                        </div>

                        <div className="flex justify-center">
                          <div className="text-gray-400 dark:text-gray-500 text-xl">
                            ↓
                          </div>
                        </div>

                        <div className="rounded-lg border border-gray-200 dark:border-[rgb(var(--border-color))] bg-gray-50 dark:bg-[rgb(var(--card-bg))] p-3">
                          <div className="text-xs text-gray-500 dark:text-[rgb(var(--text-secondary))] mb-2">AI-enhanced result:</div>
                          <div className="text-sm text-gray-700 dark:text-[rgb(var(--text-primary))] space-y-2">
                            <div><strong>Dear Professor El Basraoui,</strong></div>
                            <div>I hope this message finds you well.</div>
                            <div>I am writing to request a brief extension on the upcoming assignment due to unexpected circumstances. I would be grateful for your consideration.</div>
                            <div>Thank you for your time and understanding.</div>
                            <div><strong>Best regards,<br />Student Name</strong></div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-[rgb(var(--text-secondary))]">
                          <span>✓ Professional tone</span>
                          <span>✓ Proper greeting</span>
                          <span>✓ Courteous closing</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Secondary badges */}
        <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {['Fast setup','No conflicts','Real data','Privacy-first'].map((label) => (
            <div key={label} className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.03] py-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-gray-800 dark:text-gray-200">{label}</span>
            </div>
          ))}
        </div>

        {/* How it works */}
        <div className="mt-12 sm:mt-16">
          <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white text-center">How it works</h3>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {HOW_IT_WORKS.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-900 dark:bg-white flex items-center justify-center border border-black/10 dark:border-white/10">
                    <Icon className="w-5 h-5 text-white dark:text-black" />
                  </div>
                  <div className="text-base font-semibold text-gray-900 dark:text-white">{title}</div>
                </div>
                <p className="mt-3 text-sm text-gray-700 dark:text-gray-400">{description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stats: continuous loop for the core 4 only */}
        <div className="mt-10">
          {/** Display 10,000+ for marketing instead of exact count when >= 10k */}
          {(() => {
            const coursesDisplay = courseCount !== null
              ? (courseCount >= 10000 ? '10,000+' : courseCount.toLocaleString())
              : '10,000+';
            return (
          <StatsMarquee
            speed={20}
            respectReducedMotion={true}
            items={[
              { value: '2–3 min', label: 'to first schedule' },
              { value: '0', label: 'time conflicts' },
              { value: coursesDisplay, label: 'courses indexed' },
              { value: '1-click', label: 'calendar sync' },
              { value: '100%', label: 'professional emails' },
            ]}
            wrapperClassName="py-2 px-4 sm:px-6"
            rowClassName="space-x-6 md:space-x-8"
            chipClassName="flex shrink-0 items-center justify-center rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] px-6 py-5 text-center w-[200px] sm:w-[220px] md:w-[240px] lg:w-[260px] xl:w-[280px] h-[88px]"
            valueClassName="text-2xl font-bold leading-tight tracking-tight text-gray-900 dark:text-white whitespace-nowrap"
            labelClassName="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap"
          />
            );
          })()}
        </div>

        {/* Testimonials removed for pre-release */}

        {/* Affiliations badges removed for pre-release */}

        {/* FAQ */}
        <div className="mt-14 sm:mt-16">
          <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white text-center">Frequently asked</h3>
          <div className="mt-6 max-w-3xl mx-auto divide-y divide-gray-200 dark:divide-white/10 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02]">
            {FAQS.map(({ q, a }, idx) => {
              const open = openFaq === idx;
              return (
                <button
                  aria-expanded={open}
                  aria-controls={`faq-panel-${idx}`}
                  key={q}
                  className="w-full text-left p-4 sm:p-5 focus:outline-none"
                  onClick={() => setOpenFaq(open ? null : idx)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">{q}</div>
                      {open && (
                        <div id={`faq-panel-${idx}`} className="mt-2 text-sm text-gray-700 dark:text-gray-400">{a}</div>
                      )}
                    </div>
                    <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* End of section */}
      </div>
    </section>
  );
} 
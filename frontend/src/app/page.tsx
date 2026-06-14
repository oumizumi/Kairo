'use client'

import ThemeToggle from '@/components/ThemeToggle'
import LanguageToggle from '@/components/LanguageToggle'
import { useLanguage } from '@/contexts/LanguageContext'

export default function Home() {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#111] fall:bg-[#FDF4E3] transition-colors duration-200">

      {/* minimal top bar */}
      <div className="max-w-6xl mx-auto w-full px-6 pt-6 flex items-center justify-between">
        <span className="text-[#111] dark:text-white fall:text-[#1C0F05] font-bold text-lg tracking-tight">uomap</span>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>

      {/* cards */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

          <a href="/schedule" className="group bg-[#f5f5f5] dark:bg-[#1a1a1a] fall:bg-[#F5E6CC] rounded-xl p-8 flex flex-col gap-4 border border-black/5 dark:border-white/5 fall:border-black/[0.06] hover:border-accent/40 dark:hover:border-accent/40 transition-colors">
            <div className="w-10 h-10 rounded-lg border-2 border-accent flex items-center justify-center">
              <svg className="w-5 h-5 text-accent" viewBox="0 0 22 20" fill="currentColor">
                <rect x="0" y="0"  width="6" height="9"  rx="1.5"/>
                <rect x="0" y="11" width="6" height="9"  rx="1.5" fillOpacity="0.3"/>
                <rect x="8" y="0"  width="6" height="4"  rx="1.5" fillOpacity="0.3"/>
                <rect x="8" y="6"  width="6" height="14" rx="1.5"/>
                <rect x="16" y="0"  width="6" height="12" rx="1.5" fillOpacity="0.6"/>
                <rect x="16" y="14" width="6" height="6"  rx="1.5" fillOpacity="0.35"/>
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-[#111] dark:text-white fall:text-[#1C0F05] mb-1.5">{t('home.schedule.title')}</h2>
              <p className="text-[#666] dark:text-[#888] fall:text-[#7A5030] text-sm leading-relaxed">
                {t('home.schedule.desc')}
              </p>
            </div>
            <span className="text-sm font-semibold text-accent group-hover:underline underline-offset-4 mt-auto">
              {t('home.schedule.cta')}
            </span>
          </a>

          <a href="/guess" className="group bg-[#f5f5f5] dark:bg-[#1a1a1a] fall:bg-[#F5E6CC] rounded-xl p-8 flex flex-col gap-4 border border-black/5 dark:border-white/5 fall:border-black/[0.06] hover:border-accent/40 dark:hover:border-accent/40 transition-colors">
            <div className="w-10 h-10 rounded-lg border-2 border-accent flex items-center justify-center">
              <svg className="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8z"
                  stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round"/>
                <circle cx="12" cy="10" r="3" fill="currentColor"/>
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-[#111] dark:text-white fall:text-[#1C0F05] mb-1.5">{t('home.guess.title')}</h2>
              <p className="text-[#666] dark:text-[#888] fall:text-[#7A5030] text-sm leading-relaxed">
                {t('home.guess.desc')}
              </p>
            </div>
            <span className="text-sm font-semibold text-accent group-hover:underline underline-offset-4 mt-auto">
              {t('home.guess.cta')}
            </span>
          </a>

          <a href="/opportunities" className="group bg-[#f5f5f5] dark:bg-[#1a1a1a] fall:bg-[#F5E6CC] rounded-xl p-8 flex flex-col gap-4 border border-black/5 dark:border-white/5 fall:border-black/[0.06] hover:border-accent/40 dark:hover:border-accent/40 transition-colors">
            <div className="w-10 h-10 rounded-lg border-2 border-accent flex items-center justify-center">
              <svg className="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none">
                <path d="M3 21 C7 21 8 15 12 13 C16 11 17 6 21 5"
                  stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeOpacity="0.5"/>
                <circle cx="3"  cy="21" r="2"    fill="currentColor" fillOpacity="0.4"/>
                <circle cx="12" cy="13" r="2"    fill="currentColor" fillOpacity="0.7"/>
                <circle cx="21" cy="5"  r="2.75" fill="currentColor"/>
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-[#111] dark:text-white fall:text-[#1C0F05] mb-1.5">{t('home.opps.title')}</h2>
              <p className="text-[#666] dark:text-[#888] fall:text-[#7A5030] text-sm leading-relaxed">
                {t('home.opps.desc')}
              </p>
            </div>
            <span className="text-sm font-semibold text-accent group-hover:underline underline-offset-4 mt-auto">
              {t('home.opps.cta')}
            </span>
          </a>

        </div>
      </main>

      <footer className="border-t border-black/[0.06] dark:border-white/[0.06] fall:border-black/[0.06] mt-auto">
        <div className="max-w-6xl mx-auto px-6 pt-6 pb-16 flex flex-col items-center gap-3 text-center">
          <span className="text-[#aaa] dark:text-[#555] fall:text-[#A07840] text-sm tracking-wide">{t('nav.independent')}</span>
          <div className="flex items-center gap-2 text-sm text-[#aaa] dark:text-[#555] fall:text-[#A07840]">
            <a href="https://github.com/uomap-uo/uomap" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-semibold text-[#111] dark:text-white fall:text-[#1C0F05] hover:text-accent dark:hover:text-[#ff465f] fall:hover:text-accent transition-colors">
              GitHub
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
            <span>{t('nav.maintainedBy')}</span>
            <a href="https://www.linkedin.com/in/oumzumi/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-semibold text-[#111] dark:text-white fall:text-[#1C0F05] hover:text-[#0a66c2] transition-colors">
              Oumer Gharad
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          </div>
        </div>
      </footer>

    </div>
  )
}

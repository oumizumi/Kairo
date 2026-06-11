'use client'

import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'

interface LanguageToggleProps {
  variant?: 'light' | 'dark'
}

export default function LanguageToggle({ variant = 'light' }: LanguageToggleProps) {
  const { lang, setLang } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const isLight = variant === 'light'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
          isLight
            ? 'bg-white dark:bg-[#1a1a1a] border border-black/15 dark:border-white/[0.06] text-[#111] dark:text-white hover:border-black/30 dark:hover:border-white/15'
            : 'bg-black/60 backdrop-blur border border-white/15 text-white hover:bg-black/80 hover:border-white/30'
        }`}
      >
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <circle cx="12" cy="12" r="10"/>
          <ellipse cx="12" cy="12" rx="4" ry="10"/>
          <path d="M2 12h20" strokeLinecap="round"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        <span>{lang.toUpperCase()}</span>
        <svg
          className={`w-3 h-3 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {open && (
        <div className={`absolute right-0 top-full mt-1.5 min-w-[130px] rounded-lg border shadow-lg overflow-hidden z-50 ${
          isLight
            ? 'bg-white dark:bg-[#1a1a1a] border-black/10 dark:border-white/[0.08]'
            : 'bg-[#111]/95 backdrop-blur-xl border-white/15'
        }`}>
          {(['en', 'fr'] as const).map(l => (
            <button
              key={l}
              onClick={() => { setLang(l); setOpen(false) }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-left transition-colors ${
                lang === l
                  ? 'text-[#8f001a]'
                  : isLight
                    ? 'text-[#111] dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
                    : 'text-white/80 hover:bg-white/[0.07]'
              }`}
            >
              <span className="font-bold">{l.toUpperCase()}</span>
              <span className={lang === l ? 'text-[#8f001a]' : isLight ? 'text-[#666] dark:text-[#888]' : 'text-white/50'}>
                {l === 'en' ? 'English' : 'Français'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

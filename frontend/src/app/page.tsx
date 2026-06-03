import ThemeToggle from '@/components/ThemeToggle'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#111] transition-colors duration-200">

      {/* minimal top bar — just logo + toggle */}
      <div className="max-w-6xl mx-auto w-full px-6 pt-6 flex items-center justify-between">
        <span className="text-[#111] dark:text-white font-bold text-lg tracking-tight">uomap</span>
        <ThemeToggle />
      </div>

      {/* cards */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-4">

          <a href="/schedule" className="group bg-[#f5f5f5] dark:bg-[#1a1a1a] rounded-xl p-8 flex flex-col gap-4 border border-black/5 dark:border-white/5 hover:border-[#8f001a]/40 dark:hover:border-[#8f001a]/40 transition-colors">
            <div className="w-10 h-10 rounded-lg border-2 border-[#8f001a] flex items-center justify-center">
              <svg className="w-5 h-5 text-[#8f001a]" viewBox="0 0 22 20" fill="currentColor">
                <rect x="0" y="0"  width="6" height="9"  rx="1.5"/>
                <rect x="0" y="11" width="6" height="9"  rx="1.5" fillOpacity="0.3"/>
                <rect x="8" y="0"  width="6" height="4"  rx="1.5" fillOpacity="0.3"/>
                <rect x="8" y="6"  width="6" height="14" rx="1.5"/>
                <rect x="16" y="0"  width="6" height="12" rx="1.5" fillOpacity="0.6"/>
                <rect x="16" y="14" width="6" height="6"  rx="1.5" fillOpacity="0.35"/>
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-[#111] dark:text-white mb-1.5">Build Your Own Schedule</h2>
              <p className="text-[#666] dark:text-[#888] text-sm leading-relaxed">
                Browse every uOttawa section, filter by time and professor, detect conflicts, and export your timetable.
              </p>
            </div>
            <span className="text-sm font-semibold text-[#8f001a] group-hover:underline underline-offset-4 mt-auto">
              Get started →
            </span>
          </a>

          <a href="/opportunities" className="group bg-[#f5f5f5] dark:bg-[#1a1a1a] rounded-xl p-8 flex flex-col gap-4 border border-black/5 dark:border-white/5 hover:border-[#8f001a]/40 dark:hover:border-[#8f001a]/40 transition-colors">
            <div className="w-10 h-10 rounded-lg border-2 border-[#8f001a] flex items-center justify-center">
              <svg className="w-5 h-5 text-[#8f001a]" viewBox="0 0 24 24" fill="none">
                <path d="M3 21 C7 21 8 15 12 13 C16 11 17 6 21 5"
                  stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeOpacity="0.5"/>
                <circle cx="3"  cy="21" r="2"    fill="currentColor" fillOpacity="0.4"/>
                <circle cx="12" cy="13" r="2"    fill="currentColor" fillOpacity="0.7"/>
                <circle cx="21" cy="5"  r="2.75" fill="currentColor"/>
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-[#111] dark:text-white mb-1.5">Find Student Opportunities</h2>
              <p className="text-[#666] dark:text-[#888] text-sm leading-relaxed">
                Live-updated TA postings, scholarships, and academic opportunities scraped for uOttawa students.
              </p>
            </div>
            <span className="text-sm font-semibold text-[#8f001a] group-hover:underline underline-offset-4 mt-auto">
              Explore now →
            </span>
          </a>

        </div>
      </main>

      <footer className="border-t border-black/[0.06] dark:border-white/[0.06] mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <span className="text-[#aaa] dark:text-[#555] text-xs tracking-wide">Independent · Not affiliated with uOttawa</span>
          <a href="https://github.com" aria-label="GitHub" className="text-[#666] dark:text-[#888] hover:text-[#111] dark:hover:text-white transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/>
            </svg>
          </a>
        </div>
      </footer>

    </div>
  )
}

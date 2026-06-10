'use client'

// re-mounts on every navigation within /guess, giving each page a fade-in
export default function GuessTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-enter">{children}</div>
}

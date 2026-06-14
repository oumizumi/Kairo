'use client'

export interface RmpEntry {
  avg_rating: number | null
  avg_difficulty: number | null
  total_reviews: number
  rmp_id?: string
}

// must stay in sync with frontend/src/app/api/rmp/route.ts
export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-']/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function rmpUrl(entry: RmpEntry): string | null {
  return entry.rmp_id ? `https://www.ratemyprofessors.com/professor/${entry.rmp_id}` : null
}

function StarRow({ size }: { size: number }) {
  return (
    <span className="flex gap-[1px]">
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
          <path d="M12 2l2.9 6.26 6.85.82-5.06 4.69 1.34 6.77L12 17.18l-6.03 3.36 1.34-6.77L2.25 9.08l6.85-.82L12 2z" />
        </svg>
      ))}
    </span>
  )
}

// green = good, amber = mid, red = rough
function ratingColor(rating: number): string {
  if (rating >= 3.8) return '#16a34a'
  if (rating >= 2.8) return '#f59e0b'
  return '#8f001a'
}

export default function RmpStars({ entry, size = 12, showCount = false }: {
  entry: RmpEntry
  size?: number
  showCount?: boolean
}) {
  if (entry.avg_rating == null) return null
  const pct = Math.max(0, Math.min(100, (entry.avg_rating / 5) * 100))
  const color = ratingColor(entry.avg_rating)

  const stars = (
    <span
      className="inline-flex items-center gap-1.5 px-1.5 py-[3px] rounded-md"
      style={{ backgroundColor: color + '14' }}
    >
      <span className="relative inline-block leading-none text-[#d4d4d4] dark:text-[#3f3f3f] fall:text-[#D4A96A]">
        <StarRow size={size} />
        <span className="absolute inset-0 overflow-hidden" style={{ width: `${pct}%`, color }}>
          <StarRow size={size} />
        </span>
      </span>
      <span className="text-[11px] font-bold tabular-nums leading-none" style={{ color }}>
        {entry.avg_rating.toFixed(1)}
      </span>
      {showCount && entry.total_reviews > 0 && (
        <span className="text-[10px] font-medium text-[#999] dark:text-[#777] fall:text-[#9A7050] tabular-nums leading-none">
          ({entry.total_reviews})
        </span>
      )}
    </span>
  )

  const url = rmpUrl(entry)
  if (!url) return stars
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className="pointer-events-auto hover:opacity-70 transition-opacity"
      title="View on Rate My Professors"
    >
      {stars}
    </a>
  )
}

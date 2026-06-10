import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, statSync } from 'fs'
import { join } from 'path'

export interface RmpEntry {
  avg_rating: number | null
  avg_difficulty: number | null
  total_reviews: number
  rmp_id?: string
}

const RMP_FILE = join(process.cwd(), 'data', 'professors_rmp_data.json')

let cache: Record<string, RmpEntry> | null = null
let cacheMtime = 0

// Strip accents, normalize separators, lowercase — must stay in sync with page.tsx normalizeName
function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-']/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function loadCache(): Record<string, RmpEntry> {
  try {
    const mtime = statSync(RMP_FILE).mtimeMs
    if (cache && mtime === cacheMtime) return cache

    const data = JSON.parse(readFileSync(RMP_FILE, 'utf-8')) as Record<string, any>
    const fresh: Record<string, RmpEntry> = {}
    for (const [name, prof] of Object.entries(data)) {
      if (prof.has_rmp_data && prof.avg_rating != null) {
        fresh[normalizeName(name)] = {
          avg_rating: prof.avg_rating,
          avg_difficulty: prof.avg_difficulty ?? null,
          total_reviews: prof.total_reviews ?? 0,
          rmp_id: prof.rmp_id ?? undefined,
        }
      }
    }
    cache = fresh
    cacheMtime = mtime
    return cache
  } catch {
    return cache ?? {}
  }
}

export async function GET(_req: NextRequest) {
  return NextResponse.json(loadCache())
}

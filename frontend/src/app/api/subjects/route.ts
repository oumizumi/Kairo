import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { Course } from '@/types/course'

const DATA_DIR = join(process.cwd(), '..', 'services', 'course_scraper', 'data')

const TERM_FILES: Record<string, string> = {
  summer2026: 'all_courses_spring_summer_2026.json',
  fall2026: 'all_courses_fall_2026.json',
  winter2027: 'all_courses_winter_2027.json',
}

const cache: Record<string, string[]> = {}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const term = searchParams.get('term') ?? 'fall2026'

  if (cache[term]) return NextResponse.json({ subjects: cache[term] })

  const file = TERM_FILES[term]
  if (!file) return NextResponse.json({ subjects: [] })

  try {
    const raw = readFileSync(join(DATA_DIR, file), 'utf-8')
    const parsed = JSON.parse(raw)
    const courses: Course[] = parsed.courses ?? []
    const subjects = [...new Set(courses.map(c => c.subjectCode).filter(Boolean))].sort() as string[]
    cache[term] = subjects
    return NextResponse.json({ subjects })
  } catch {
    return NextResponse.json({ subjects: [] })
  }
}

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

let cache: Record<string, Course[]> = {}

function loadCourses(term: string): Course[] {
  if (cache[term]) return cache[term]
  const file = TERM_FILES[term]
  if (!file) return []
  try {
    const raw = readFileSync(join(DATA_DIR, file), 'utf-8')
    const parsed = JSON.parse(raw)
    cache[term] = parsed.courses ?? []
    return cache[term]
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const term = searchParams.get('term') ?? 'fall2026'
  const q = (searchParams.get('q') ?? '').toLowerCase().trim()
  const subject = (searchParams.get('subject') ?? '').toUpperCase().trim()
  const year = searchParams.get('year') ?? ''

  let courses = loadCourses(term)

  // subject filter — exact match on subjectCode
  if (subject) {
    courses = courses.filter(c => c.subjectCode === subject)
  }

  // year filter — applied to full dataset before cap
  if (year) {
    courses = courses.filter(c => {
      const num = c.courseCode.match(/\d+/)?.[0]
      if (!num) return false
      return year === '4+' ? parseInt(num[0]) >= 4 : num[0] === year
    })
  }

  // text search with scoring
  if (q) {
    const scored: { course: Course; score: number }[] = []

    for (const c of courses) {
      const code = c.courseCode.toLowerCase()
      const title = c.courseTitle.toLowerCase()
      const subj = c.subjectCode.toLowerCase()

      let score = -1
      if (code.startsWith(q))        score = 0
      else if (subj === q)           score = 1
      else if (code.includes(q))     score = 2
      else if (title.startsWith(q))  score = 3
      else if (title.includes(q))    score = 4
      else {
        for (const group of Object.values(c.sectionGroups)) {
          const insts = [
            group.lecture?.instructor,
            ...group.labs.map(s => s.instructor),
            ...group.tutorials.map(s => s.instructor),
          ]
          if (insts.some(i => i?.toLowerCase().includes(q))) { score = 5; break }
        }
      }

      if (score >= 0) scored.push({ course: c, score })
    }

    scored.sort((a, b) => a.score - b.score)
    courses = scored.map(s => s.course)
  }

  courses = courses.slice(0, 60)

  return NextResponse.json({ courses })
}

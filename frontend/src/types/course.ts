export interface SectionInfo {
  section: string
  days: string[]
  time: string
  instructor: string
  status: 'Open' | 'Closed' | 'Waitlist' | 'Unknown'
  meetingStartDate?: string
  meetingEndDate?: string
}

export interface SectionGroup {
  groupId: string
  lecture?: SectionInfo
  labs: SectionInfo[]
  tutorials: SectionInfo[]
}

export interface Course {
  courseCode: string
  courseTitle: string
  subjectCode: string
  term: string
  sectionGroups: Record<string, SectionGroup>
  units?: string
  description?: string
}

export interface AddedSection {
  id: string
  courseCode: string
  courseTitle: string
  groupId: string
  lecture: SectionInfo
  labs: SectionInfo[]
  tutorials: SectionInfo[]
  color: string
  term: string
  selectedLabIdx: number | null
  selectedTutIdx: number | null
}

export interface TimeBlock {
  day: string
  start: number
  end: number
}

'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  History,
  Layers3,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  User,
  UserCog,
  Users,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, fmtTime } from '@/lib/utils'
import type { CoachMemoryEntry } from '@/lib/coach-student-memory'
import type { LevelCategory, StudentType } from '@/types/database'

interface CoachOption {
  id: string
  name: string
  role: string
  branches: string[]
}

interface AssignmentStudent {
  bookingSessionId: string
  studentId: string
  studentType: StudentType
  name: string
  parentName: string | null
  isChild: boolean
  level: number | null
  levelName: string | null
  levelCategory: LevelCategory | null
  coachMemory: CoachMemoryEntry[]
  suggestedCoachId: string | null
  suggestedCoachName: string | null
}

interface ExistingAssignmentGroup {
  id: string
  name: string
  coachId: string | null
  coachName: string | null
  levelMin: number | null
  levelMax: number | null
  sortOrder: number
  studentSessionIds: string[]
}

interface AssignmentSlot {
  key: string
  scheduleSlotId: string | null
  branchId: string
  branchName: string
  courseTypeId: string
  courseType: string
  date: string
  startTime: string
  endTime: string
  legacyAssignedCoachId: string | null
  legacyAssignedCoachName: string | null
  suggestedCoachId: string | null
  suggestedCoachName: string | null
  suggestedCoachReason: string | null
  students: AssignmentStudent[]
  assignmentGroups: ExistingAssignmentGroup[]
}

interface GroupDraft {
  localId: string
  persistedId?: string
  name: string
  coachId: string | null
  levelMin: number | null
  levelMax: number | null
  sortOrder: number
  studentSessionIds: string[]
}

type SlotDraftState = 'empty' | 'saved' | 'unassigned' | 'changed'
type AssignmentStatusFilter = 'needs_assignment' | 'saved' | 'all'

interface AssignGroupsClientProps {
  coaches: CoachOption[]
  slots: AssignmentSlot[]
  currentUserId?: string
}

const ROLE_LABELS: Record<string, string> = {
  coach: 'โค้ช',
  head_coach: 'หัวหน้าโค้ช',
  admin: 'Admin',
  super_admin: 'Super Admin',
}

const LEVEL_CATEGORY_LABELS: Record<LevelCategory, string> = {
  basic: 'พื้นฐาน',
  athlete_1: 'Athlete 1',
  athlete_2: 'Athlete 2',
  athlete_3: 'Athlete 3',
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatShortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  })
}

function getMemoryText(memory: CoachMemoryEntry) {
  return `${memory.coachName} ${memory.totalSessions} ครั้ง ล่าสุด ${formatShortDate(memory.lastTaughtDate)}`
}

function getLevelLabel(student: AssignmentStudent) {
  const level = student.level ?? 0
  return `${student.levelName || `Level ${level}`} (LV ${level})`
}

function getLevelBand(student: AssignmentStudent) {
  const level = student.level ?? 0

  if (level <= 10) {
    return { key: 'lv-0-10', name: 'พื้นฐาน / เริ่มต้น', levelMin: 0, levelMax: 10 }
  }
  if (level <= 30) {
    return { key: 'lv-11-30', name: 'กำลังพัฒนา', levelMin: 11, levelMax: 30 }
  }
  if (level <= 50) {
    return { key: 'lv-31-50', name: 'กลาง-สูง', levelMin: 31, levelMax: 50 }
  }
  return { key: 'lv-51-up', name: 'ระดับสูง', levelMin: 51, levelMax: 70 }
}

function isPrivateCourse(courseType: string) {
  const value = courseType.toLowerCase()
  return value.includes('private') || value.includes('ส่วนตัว')
}

function rankCoachOptionsForStudents(students: AssignmentStudent[]) {
  const score = new Map<string, { coachId: string; coachName: string; totalSessions: number; studentCount: number; lastTaughtDate: string }>()

  students.forEach((student) => {
    const suggested = student.coachMemory[0]
    if (!suggested) return

    const current = score.get(suggested.coachId) || {
      coachId: suggested.coachId,
      coachName: suggested.coachName,
      totalSessions: 0,
      studentCount: 0,
      lastTaughtDate: '',
    }
    current.totalSessions += suggested.totalSessions
    current.studentCount += 1
    if (suggested.lastTaughtDate > current.lastTaughtDate) current.lastTaughtDate = suggested.lastTaughtDate
    score.set(suggested.coachId, current)
  })

  return Array.from(score.values()).sort((a, b) => {
    if (b.studentCount !== a.studentCount) return b.studentCount - a.studentCount
    if (b.totalSessions !== a.totalSessions) return b.totalSessions - a.totalSessions
    return b.lastTaughtDate.localeCompare(a.lastTaughtDate)
  })
}

function pickBestCoachForStudents(students: AssignmentStudent[]) {
  return rankCoachOptionsForStudents(students)[0] || null
}

function pickAvailableCoachIdForStudents(students: AssignmentStudent[], usedCoachIds = new Set<string>(), fallbackCoachId: string | null = null) {
  const preferred = rankCoachOptionsForStudents(students).find((coach) => !usedCoachIds.has(coach.coachId))
  if (preferred) return preferred.coachId
  if (fallbackCoachId && !usedCoachIds.has(fallbackCoachId)) return fallbackCoachId
  return null
}

function createAutoGroups(slot: AssignmentSlot): GroupDraft[] {
  if (slot.students.length === 0) {
    return [{
      localId: `${slot.key}-empty`,
      name: 'กลุ่ม 1',
      coachId: slot.suggestedCoachId,
      levelMin: null,
      levelMax: null,
      sortOrder: 0,
      studentSessionIds: [],
    }]
  }

  if (isPrivateCourse(slot.courseType)) {
    return slot.students.map((student, index) => ({
      localId: `${slot.key}-private-${student.bookingSessionId}`,
      name: `Private - ${student.name}`,
      coachId: student.suggestedCoachId || slot.suggestedCoachId,
      levelMin: student.level ?? 0,
      levelMax: student.level ?? 0,
      sortOrder: index,
      studentSessionIds: [student.bookingSessionId],
    }))
  }

  const grouped = new Map<string, { name: string; levelMin: number; levelMax: number; students: AssignmentStudent[] }>()
  slot.students.forEach((student) => {
    const band = getLevelBand(student)
    if (!grouped.has(band.key)) {
      grouped.set(band.key, {
        name: band.name,
        levelMin: band.levelMin,
        levelMax: band.levelMax,
        students: [],
      })
    }
    grouped.get(band.key)?.students.push(student)
  })

  const usedCoachIds = new Set<string>()
  return Array.from(grouped.values()).map((group, index) => {
    const coachId = pickAvailableCoachIdForStudents(group.students, usedCoachIds, slot.suggestedCoachId)
    if (coachId) usedCoachIds.add(coachId)
    return {
      localId: `${slot.key}-auto-${index}`,
      name: `${group.name} (${group.students.length} คน)`,
      coachId,
      levelMin: group.levelMin,
      levelMax: group.levelMax,
      sortOrder: index,
      studentSessionIds: group.students.map((student) => student.bookingSessionId),
    }
  })
}

function createInitialDrafts(slot: AssignmentSlot): GroupDraft[] {
  if (slot.assignmentGroups.length > 0) {
    const assignedIds = new Set(slot.assignmentGroups.flatMap((group) => group.studentSessionIds))
    const drafts: GroupDraft[] = slot.assignmentGroups
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((group, index) => ({
        localId: group.id,
        persistedId: group.id,
        name: group.name,
        coachId: group.coachId,
        levelMin: group.levelMin,
        levelMax: group.levelMax,
        sortOrder: index,
        studentSessionIds: group.studentSessionIds,
      }))

    const unassignedStudents = slot.students.filter((student) => !assignedIds.has(student.bookingSessionId))
    if (unassignedStudents.length > 0) {
      drafts.push({
        localId: `${slot.key}-unassigned`,
        name: 'ยังไม่จัดกลุ่ม',
        coachId: slot.suggestedCoachId,
        levelMin: null,
        levelMax: null,
        sortOrder: drafts.length,
        studentSessionIds: unassignedStudents.map((student) => student.bookingSessionId),
      })
    }

    return drafts.length > 0 ? drafts : createAutoGroups(slot)
  }

  return createAutoGroups(slot)
}

function createInitialDraftMap(slots: AssignmentSlot[]) {
  return slots.reduce((map, slot) => {
    map[slot.key] = createInitialDrafts(slot)
    return map
  }, {} as Record<string, GroupDraft[]>)
}

function getGroupStudents(slot: AssignmentSlot, group: GroupDraft) {
  const ids = new Set(group.studentSessionIds)
  return slot.students.filter((student) => ids.has(student.bookingSessionId))
}

function describeLevelRange(group: GroupDraft) {
  if (group.levelMin === null && group.levelMax === null) return 'ไม่กำหนดช่วง Level'
  if (group.levelMin === group.levelMax) return `LV ${group.levelMin ?? 0}`
  return `LV ${group.levelMin ?? 0}-${group.levelMax ?? 0}`
}

function hasWideLevelGap(students: AssignmentStudent[]) {
  const levels = students.map((student) => student.level ?? 0)
  if (levels.length <= 1) return false
  return Math.max(...levels) - Math.min(...levels) > 20
}

function getDuplicateCoachIds(groups: GroupDraft[]) {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  groups.forEach((group) => {
    if (!group.coachId || group.studentSessionIds.length === 0) return
    if (seen.has(group.coachId)) {
      duplicates.add(group.coachId)
      return
    }
    seen.add(group.coachId)
  })

  return duplicates
}

function getUsedCoachMap(groups: GroupDraft[]) {
  return groups.reduce((map, group) => {
    if (!group.coachId || group.studentSessionIds.length === 0) return map
    if (!map[group.coachId]) map[group.coachId] = []
    map[group.coachId].push({
      groupId: group.localId,
      name: group.name || 'กลุ่มไม่มีชื่อ',
    })
    return map
  }, {} as Record<string, { groupId: string; name: string }[]>)
}

function normalizeGroupsForCompare(groups: Array<Pick<GroupDraft, 'name' | 'coachId' | 'levelMin' | 'levelMax' | 'studentSessionIds'>>) {
  return groups
    .filter((group) => group.studentSessionIds.length > 0)
    .map((group) => ({
      name: group.name.trim(),
      coachId: group.coachId || null,
      levelMin: group.levelMin,
      levelMax: group.levelMax,
      studentSessionIds: [...group.studentSessionIds].sort(),
    }))
    .sort((a, b) => {
      const aKey = `${a.name}:${a.coachId || ''}:${a.studentSessionIds.join(',')}`
      const bKey = `${b.name}:${b.coachId || ''}:${b.studentSessionIds.join(',')}`
      return aKey.localeCompare(bKey)
    })
}

function areGroupsSaved(slot: AssignmentSlot, groups: GroupDraft[]) {
  if (slot.assignmentGroups.length === 0) return false
  return JSON.stringify(normalizeGroupsForCompare(groups)) === JSON.stringify(normalizeGroupsForCompare(slot.assignmentGroups))
}

function getSlotDraftState(slot: AssignmentSlot, groups: GroupDraft[]) {
  const nonEmptyGroups = groups.filter((group) => group.studentSessionIds.length > 0)
  if (nonEmptyGroups.length === 0) return 'empty'
  if (areGroupsSaved(slot, groups)) return 'saved'
  return slot.assignmentGroups.length > 0 ? 'changed' : 'unassigned'
}

function getStateLabel(state: SlotDraftState) {
  if (state === 'saved') return 'มอบหมายแล้ว'
  if (state === 'changed') return 'มีการแก้ไขยังไม่บันทึก'
  if (state === 'empty') return 'ยังไม่มีกลุ่ม'
  return 'ยังไม่ได้มอบหมาย'
}

function getStateBadgeClass(state: SlotDraftState) {
  if (state === 'saved') return 'bg-emerald-100 text-emerald-700'
  if (state === 'changed') return 'bg-amber-100 text-amber-800'
  if (state === 'empty') return 'bg-gray-100 text-gray-600'
  return 'bg-red-100 text-red-700'
}

function shouldShowForStatusFilter(state: SlotDraftState, filter: AssignmentStatusFilter) {
  if (filter === 'all') return true
  if (filter === 'saved') return state === 'saved'
  return state !== 'saved'
}

function getMonthKey(date: string) {
  return date.slice(0, 7)
}

function shiftMonth(monthKey: string, direction: -1 | 1) {
  const [year, month] = monthKey.split('-').map(Number)
  const value = new Date(year, month - 1 + direction, 1)
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`
}

function formatMonth(monthKey: string) {
  return new Date(`${monthKey}-01T00:00:00`).toLocaleDateString('th-TH', {
    month: 'long',
    year: 'numeric',
  })
}

export function AssignGroupsClient({ coaches, slots, currentUserId }: AssignGroupsClientProps) {
  const router = useRouter()
  const [draftsBySlot, setDraftsBySlot] = useState<Record<string, GroupDraft[]>>(() => createInitialDraftMap(slots))
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [errorsBySlot, setErrorsBySlot] = useState<Record<string, string>>({})
  const [selectedDate, setSelectedDate] = useState(() => slots[0]?.date || '')
  const [selectedSlotKey, setSelectedSlotKey] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(() => getMonthKey(slots[0]?.date || new Date().toISOString().slice(0, 10)))
  const [statusFilter, setStatusFilter] = useState<AssignmentStatusFilter>('needs_assignment')

  const stats = useMemo(() => {
    const totalStudents = slots.reduce((sum, slot) => sum + slot.students.length, 0)
    const savedSlots = slots.filter((slot) => getSlotDraftState(slot, draftsBySlot[slot.key] || []) === 'saved').length
    const unassignedSlots = slots.filter((slot) => getSlotDraftState(slot, draftsBySlot[slot.key] || []) !== 'saved').length
    const needsReview = slots.filter((slot) => hasWideLevelGap(slot.students)).length

    return { totalStudents, savedSlots, unassignedSlots, needsReview }
  }, [draftsBySlot, slots])

  const groupedByDateAll = useMemo(() => {
    return Object.entries(slots.reduce((map, slot) => {
      if (!map[slot.date]) map[slot.date] = []
      map[slot.date].push(slot)
      return map
    }, {} as Record<string, AssignmentSlot[]>)).sort(([a], [b]) => a.localeCompare(b))
  }, [slots])

  const dateSummaries = useMemo(() => {
    return groupedByDateAll
      .filter(([date]) => getMonthKey(date) === selectedMonth)
      .map(([date, dateSlots]) => {
      const visibleSlots = dateSlots.filter((slot) => shouldShowForStatusFilter(
        getSlotDraftState(slot, draftsBySlot[slot.key] || []),
        statusFilter,
      ))
      const totalStudents = dateSlots.reduce((sum, slot) => sum + slot.students.length, 0)
      const savedSlots = dateSlots.filter((slot) => getSlotDraftState(slot, draftsBySlot[slot.key] || []) === 'saved').length
      const unassignedSlots = dateSlots.filter((slot) => getSlotDraftState(slot, draftsBySlot[slot.key] || []) !== 'saved').length
      const needsReview = dateSlots.filter((slot) => hasWideLevelGap(slot.students)).length
      const draftIssues = dateSlots.filter((slot) => getDuplicateCoachIds(draftsBySlot[slot.key] || []).size > 0).length
      const changedSlots = dateSlots.filter((slot) => getSlotDraftState(slot, draftsBySlot[slot.key] || []) === 'changed').length

      return {
        date,
        slots: dateSlots.length,
        visibleSlots: visibleSlots.length,
        totalStudents,
        savedSlots,
        unassignedSlots,
        needsReview,
        draftIssues,
        changedSlots,
      }
    })
      .filter((summary) => summary.visibleSlots > 0)
  }, [draftsBySlot, groupedByDateAll, selectedMonth, statusFilter])

  const activeDate = dateSummaries.some((date) => date.date === selectedDate)
    ? selectedDate
    : dateSummaries[0]?.date || ''

  const activeDateSlots = useMemo(() => {
    const dateSlots = groupedByDateAll.find(([date]) => date === activeDate)?.[1] || []
    return dateSlots.filter((slot) => shouldShowForStatusFilter(
      getSlotDraftState(slot, draftsBySlot[slot.key] || []),
      statusFilter,
    ))
  }, [activeDate, draftsBySlot, groupedByDateAll, statusFilter])

  const activeSlot = activeDateSlots.find((slot) => slot.key === selectedSlotKey) || activeDateSlots[0] || null
  const activeDateSummary = dateSummaries.find((date) => date.date === activeDate)

  const updateSlotGroups = (slotKey: string, updater: (groups: GroupDraft[]) => GroupDraft[]) => {
    setDraftsBySlot((prev) => ({
      ...prev,
      [slotKey]: updater(prev[slotKey] || []),
    }))
    setErrorsBySlot((prev) => ({ ...prev, [slotKey]: '' }))
  }

  const addGroup = (slot: AssignmentSlot) => {
    updateSlotGroups(slot.key, (groups) => [
      ...groups,
      {
        localId: `${slot.key}-manual-${Date.now()}`,
        name: `กลุ่ม ${groups.length + 1}`,
        coachId: slot.suggestedCoachId,
        levelMin: null,
        levelMax: null,
        sortOrder: groups.length,
        studentSessionIds: [],
      },
    ])
  }

  const removeGroup = (slot: AssignmentSlot, groupId: string) => {
    updateSlotGroups(slot.key, (groups) => {
      if (groups.length <= 1) return groups
      const removed = groups.find((group) => group.localId === groupId)
      const next = groups.filter((group) => group.localId !== groupId)
      if (removed && next[0]) {
        next[0] = {
          ...next[0],
          studentSessionIds: Array.from(new Set([...next[0].studentSessionIds, ...removed.studentSessionIds])),
        }
      }
      return next.map((group, index) => ({ ...group, sortOrder: index }))
    })
  }

  const moveStudent = (slotKey: string, bookingSessionId: string, groupId: string) => {
    updateSlotGroups(slotKey, (groups) => groups.map((group) => {
      const withoutStudent = group.studentSessionIds.filter((id) => id !== bookingSessionId)
      if (group.localId !== groupId) {
        return { ...group, studentSessionIds: withoutStudent }
      }
      return {
        ...group,
        studentSessionIds: Array.from(new Set([...withoutStudent, bookingSessionId])),
      }
    }))
  }

  const updateGroup = (slotKey: string, groupId: string, patch: Partial<GroupDraft>) => {
    updateSlotGroups(slotKey, (groups) => groups.map((group) => (
      group.localId === groupId ? { ...group, ...patch } : group
    )))
  }

  const resetAutoGroups = (slot: AssignmentSlot) => {
    setDraftsBySlot((prev) => ({
      ...prev,
      [slot.key]: createAutoGroups(slot),
    }))
    setErrorsBySlot((prev) => ({ ...prev, [slot.key]: '' }))
  }

  const saveSlot = async (slot: AssignmentSlot) => {
    const groups = draftsBySlot[slot.key] || []
    if (!slot.scheduleSlotId) {
      setErrorsBySlot((prev) => ({ ...prev, [slot.key]: 'รอบนี้ยังไม่มี schedule slot จึงบันทึกกลุ่มไม่ได้' }))
      return
    }

    const assignedStudentIds = new Set(groups.flatMap((group) => group.studentSessionIds))
    const missingStudents = slot.students.filter((student) => !assignedStudentIds.has(student.bookingSessionId))
    if (missingStudents.length > 0) {
      setErrorsBySlot((prev) => ({ ...prev, [slot.key]: `ยังมีผู้เรียนที่ไม่ได้อยู่ในกลุ่ม ${missingStudents.length} คน` }))
      return
    }

    const submittedGroups = groups
      .filter((group) => group.studentSessionIds.length > 0)
      .map((group, index) => ({
        name: group.name.trim() || `กลุ่ม ${index + 1}`,
        coachId: group.coachId,
        levelMin: group.levelMin,
        levelMax: group.levelMax,
        sortOrder: index,
        studentSessionIds: group.studentSessionIds,
      }))

    if (submittedGroups.length === 0) {
      setErrorsBySlot((prev) => ({ ...prev, [slot.key]: 'ต้องมีอย่างน้อย 1 กลุ่มที่มีผู้เรียน' }))
      return
    }

    const coachIds = submittedGroups.map((group) => group.coachId).filter(Boolean)
    if (new Set(coachIds).size !== coachIds.length) {
      setErrorsBySlot((prev) => ({ ...prev, [slot.key]: 'โค้ช 1 คนไม่สามารถรับผิดชอบหลายกลุ่มในรอบเวลาเดียวกันได้ กรุณาเลือกโค้ชคนละคนต่อกลุ่ม' }))
      return
    }

    setSavingKey(slot.key)
    setErrorsBySlot((prev) => ({ ...prev, [slot.key]: '' }))

    try {
      const res = await fetch('/api/coach/assignment-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduleSlotId: slot.scheduleSlotId,
          branchId: slot.branchId,
          groups: submittedGroups,
        }),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setErrorsBySlot((prev) => ({
          ...prev,
          [slot.key]: json?.error || 'บันทึกการแบ่งกลุ่มไม่สำเร็จ',
        }))
        return
      }

      router.refresh()
    } catch {
      setErrorsBySlot((prev) => ({ ...prev, [slot.key]: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' }))
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#2748bf]">
          <Layers3 className="h-4 w-4" />
          Coach Group Assignment
        </p>
        <h1 className="text-2xl font-bold text-[#153c85]">มอบหมายกลุ่มผู้เรียนตาม Level</h1>
        <p className="max-w-4xl text-sm text-gray-500">
          แยกผู้เรียนในรอบเดียวกันเป็นกลุ่มย่อยตามระดับ แล้วเลือกโค้ชประจำกลุ่ม ระบบจะแนะนำจากประวัติว่าเด็กเคยเรียนกับโค้ชคนไหนมาก่อน
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="shadow-sm">
          <CardContent className="p-3">
            <p className="text-xs text-gray-500">โค้ชที่เลือกได้</p>
            <p className="mt-1 text-2xl font-bold text-[#2748bf]">{coaches.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-3">
            <p className="text-xs text-gray-500">ยังไม่ได้มอบหมาย</p>
            <p className="mt-1 text-2xl font-bold text-red-600">{stats.unassignedSlots}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-3">
            <p className="text-xs text-gray-500">ผู้เรียนทั้งหมด</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{stats.totalStudents}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-3">
            <p className="text-xs text-gray-500">มอบหมายแล้ว</p>
            <p className="mt-1 text-2xl font-bold text-[#153c85]">{stats.savedSlots}/{slots.length}</p>
          </CardContent>
        </Card>
      </div>

      {stats.needsReview > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>มี {stats.needsReview} รอบที่ Level ต่างกันมาก ระบบแยกกลุ่มให้เบื้องต้นแล้ว หัวหน้าโค้ชควรตรวจและปรับเองอีกครั้ง</p>
          </div>
        </div>
      )}

      {groupedByDateAll.length > 0 && (
        <Card className="shadow-sm">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#153c85]">เลือกวันสอนก่อนจัดกลุ่ม</p>
                <p className="text-xs text-gray-500">
                  เลือกเดือนและสถานะเพื่อเห็นทันทีว่าวันไหนหรือรอบไหนยังไม่ได้มอบหมาย ไม่ต้องเปิดหาทีละรอบ
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex items-center gap-1 rounded-lg border bg-white p-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      setSelectedMonth((current) => shiftMonth(current, -1))
                      setSelectedDate('')
                      setSelectedSlotKey('')
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-32 text-center text-sm font-semibold text-[#153c85]">{formatMonth(selectedMonth)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      setSelectedMonth((current) => shiftMonth(current, 1))
                      setSelectedDate('')
                      setSelectedSlotKey('')
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-1 rounded-lg border bg-white p-1 text-xs">
                  {[
                    { key: 'needs_assignment' as const, label: 'ต้องมอบหมาย' },
                    { key: 'saved' as const, label: 'มอบหมายแล้ว' },
                    { key: 'all' as const, label: 'ทั้งหมด' },
                  ].map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => {
                        setStatusFilter(filter.key)
                        setSelectedDate('')
                        setSelectedSlotKey('')
                      }}
                      className={cn(
                        'rounded-md px-2 py-1.5 font-medium text-gray-500 transition',
                        statusFilter === filter.key && 'bg-[#2748bf] text-white',
                      )}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
              {activeDateSummary && (
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline" className="bg-white">{activeDateSummary.slots} รอบ</Badge>
                  <Badge variant="outline" className="bg-white">{activeDateSummary.totalStudents} คน</Badge>
                  <Badge className="bg-emerald-100 text-emerald-700">{activeDateSummary.savedSlots} มอบหมายแล้ว</Badge>
                  {activeDateSummary.unassignedSlots > 0 && (
                    <Badge className="bg-red-100 text-red-700">{activeDateSummary.unassignedSlots} ยังไม่ได้มอบหมาย</Badge>
                  )}
                  {activeDateSummary.changedSlots > 0 && (
                    <Badge className="bg-amber-100 text-amber-800">{activeDateSummary.changedSlots} แก้ไขค้าง</Badge>
                  )}
                  {(activeDateSummary.needsReview > 0 || activeDateSummary.draftIssues > 0) && (
                    <Badge className="bg-amber-100 text-amber-800">
                      ต้องตรวจ {activeDateSummary.needsReview + activeDateSummary.draftIssues}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
              {dateSummaries.map((summary) => {
                const isActive = summary.date === activeDate
                const dateObj = new Date(`${summary.date}T00:00:00`)
                const weekday = dateObj.toLocaleDateString('th-TH', { weekday: 'short' })
                const day = dateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })

                return (
                  <button
                    key={summary.date}
                    type="button"
                    onClick={() => {
                      setSelectedDate(summary.date)
                      setSelectedSlotKey('')
                    }}
                    className={cn(
                      'rounded-lg border bg-white p-3 text-left transition hover:border-[#2748bf]/50 hover:bg-blue-50',
                      isActive && 'border-[#2748bf] bg-blue-50 ring-2 ring-[#2748bf]/15',
                      summary.unassignedSlots > 0 && !isActive && 'border-red-200 bg-red-50/40',
                      summary.unassignedSlots === 0 && (summary.needsReview > 0 || summary.draftIssues > 0 || summary.changedSlots > 0) && !isActive && 'border-amber-200 bg-amber-50/40',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={cn('text-xs font-semibold', isActive ? 'text-[#2748bf]' : 'text-gray-500')}>{weekday}</p>
                        <p className="mt-1 font-bold text-[#153c85]">{day}</p>
                      </div>
                      {summary.unassignedSlots > 0 ? (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      ) : summary.savedSlots === summary.slots ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (summary.needsReview > 0 || summary.draftIssues > 0 || summary.changedSlots > 0) && (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      <Badge variant="outline" className="bg-white text-[10px]">{summary.slots} รอบ</Badge>
                      <Badge variant="outline" className="bg-white text-[10px]">{summary.totalStudents} คน</Badge>
                      {summary.unassignedSlots > 0 ? (
                        <Badge className="bg-red-100 text-[10px] text-red-700">{summary.unassignedSlots} ยังไม่ได้มอบหมาย</Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-[10px] text-emerald-700">ครบแล้ว</Badge>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {groupedByDateAll.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <Users className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="font-medium">ยังไม่มีรอบเรียนให้มอบหมายกลุ่ม</p>
          </CardContent>
        </Card>
      ) : dateSummaries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <CalendarDays className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="font-medium">ไม่มีรอบที่ตรงกับตัวกรองในเดือนนี้</p>
            <p className="mt-1 text-sm">ลองเปลี่ยนเดือนหรือเลือกดูสถานะทั้งหมด</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {activeDate && (
            <div key={activeDate} className="space-y-3">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-[#153c85]">
                  <CalendarDays className="h-4 w-4" />
                  <p className="font-semibold">{formatDate(activeDate)}</p>
                </div>
                <Card className="shadow-sm">
                  <CardContent className="space-y-3 p-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[#153c85]">เลือกรอบของวันนี้</p>
                        <p className="text-xs text-gray-500">เลือกทีละรอบเพื่อจัดกลุ่ม ลดความรกเมื่อวันเดียวมีหลายรอบเรียน</p>
                      </div>
                      <Badge variant="outline" className="w-fit bg-white">{activeDateSlots.length} รอบในวันนี้</Badge>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {activeDateSlots.map((slot) => {
                        const slotGroups = draftsBySlot[slot.key] || []
                        const hasDuplicateCoaches = getDuplicateCoachIds(slotGroups).size > 0
                        const slotDraftState = getSlotDraftState(slot, slotGroups)
                        const isActiveSlot = slot.key === activeSlot?.key
                        const isUnassigned = slotDraftState === 'unassigned' || slotDraftState === 'empty'

                        return (
                          <button
                            key={slot.key}
                            type="button"
                            onClick={() => setSelectedSlotKey(slot.key)}
                            className={cn(
                              'rounded-lg border bg-white p-3 text-left transition hover:border-[#2748bf]/50 hover:bg-blue-50',
                              isActiveSlot && 'border-[#2748bf] bg-blue-50 ring-2 ring-[#2748bf]/15',
                              isUnassigned && !isActiveSlot && 'border-red-200 bg-red-50/40',
                              slotDraftState === 'saved' && !isActiveSlot && 'border-emerald-200 bg-emerald-50/30',
                              hasDuplicateCoaches && !isActiveSlot && 'border-red-200 bg-red-50/40',
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-bold text-[#153c85]">{fmtTime(slot.startTime)} - {fmtTime(slot.endTime)}</p>
                                <p className="mt-1 truncate text-xs text-gray-500">{slot.branchName}</p>
                              </div>
                              {isUnassigned || hasDuplicateCoaches ? (
                                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                              ) : slotDraftState === 'saved' ? (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                              )}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <Badge className="bg-blue-100 text-[10px] text-blue-700">{slot.courseType || 'คอร์ส'}</Badge>
                              <Badge variant="outline" className="bg-white text-[10px]">{slot.students.length} คน</Badge>
                              <Badge className={cn('text-[10px]', getStateBadgeClass(slotDraftState))}>{getStateLabel(slotDraftState)}</Badge>
                              {hasDuplicateCoaches && (
                                <Badge className="bg-red-100 text-[10px] text-red-700">โค้ชซ้ำ</Badge>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {(activeSlot ? [activeSlot] : []).map((slot) => {
                const slotGroups = draftsBySlot[slot.key] || []
                const slotError = errorsBySlot[slot.key]
                const duplicateCoachIds = getDuplicateCoachIds(slotGroups)
                const hasDuplicateCoaches = duplicateCoachIds.size > 0
                const slotDraftState = getSlotDraftState(slot, slotGroups)

                return (
                  <Card key={slot.key} className="overflow-hidden shadow-sm">
                    <CardContent className="space-y-4 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-bold text-[#153c85]">{fmtTime(slot.startTime)} - {fmtTime(slot.endTime)}</h2>
                            <Badge className="bg-blue-100 text-blue-700">{slot.courseType || 'คอร์ส'}</Badge>
                            <Badge variant="outline">{slot.students.length} คน</Badge>
                            <Badge className={getStateBadgeClass(slotDraftState)}>{getStateLabel(slotDraftState)}</Badge>
                            {hasDuplicateCoaches && (
                              <Badge className="bg-red-100 text-red-700">โค้ชซ้ำในรอบนี้</Badge>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{slot.branchName}</span>
                            <span className="flex items-center gap-1"><UserCog className="h-3 w-3" />เดิม: {slot.legacyAssignedCoachName || 'ยังไม่มอบหมาย'}</span>
                          </div>
                          {slot.suggestedCoachName && (
                            <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                              <Sparkles className="h-3 w-3" />
                              แนะนำภาพรวม: {slot.suggestedCoachName} ({slot.suggestedCoachReason})
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => resetAutoGroups(slot)}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            จัดตาม Level (ยังไม่บันทึก)
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => addGroup(slot)}>
                            <Plus className="mr-2 h-4 w-4" />
                            เพิ่มกลุ่ม
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => saveSlot(slot)}
                            disabled={savingKey === slot.key || hasDuplicateCoaches || slotDraftState === 'saved'}
                            className="bg-[#2748bf] hover:bg-[#153c85]"
                          >
                            {savingKey === slot.key ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                กำลังบันทึก
                              </>
                            ) : (
                              <>
                                <Save className="mr-2 h-4 w-4" />
                                {slotDraftState === 'saved' ? 'มอบหมายแล้ว' : 'บันทึก/ยืนยันการมอบหมาย'}
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className={cn(
                        'rounded-lg border px-3 py-2 text-sm',
                        slotDraftState === 'saved'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-orange-200 bg-orange-50 text-orange-700',
                      )}>
                        {slotDraftState === 'saved'
                          ? 'รอบนี้มอบหมายแล้ว โค้ชผู้สอนจะเห็นรอบนี้ในตารางสอนของตัวเอง'
                          : slotDraftState === 'changed'
                            ? 'มีการแก้ไขการมอบหมายในหน้าจอนี้ แต่โค้ชผู้สอนจะยังเห็นข้อมูลเดิมจนกว่าจะกดบันทึก/ยืนยันการมอบหมาย'
                            : 'รอบนี้ยังไม่ได้มอบหมายให้โค้ชผู้สอน ระบบแนะนำกลุ่มไว้เบื้องต้นเท่านั้น ต้องกดบันทึก/ยืนยันการมอบหมายก่อนโค้ชจึงจะเห็นงานนี้'}
                      </div>

                      <div className="grid gap-3 xl:grid-cols-2">
                        {slotGroups.map((group) => {
                          const groupStudents = getGroupStudents(slot, group)
                          const bestCoach = pickBestCoachForStudents(groupStudents)
                          const usedCoachMap = getUsedCoachMap(slotGroups)

                          return (
                            <div
                              key={group.localId}
                              className={cn(
                                'rounded-lg border bg-white p-3',
                                hasWideLevelGap(groupStudents) && 'border-amber-300 bg-amber-50/40',
                                duplicateCoachIds.has(group.coachId || '') && 'border-red-300 bg-red-50/40',
                              )}
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1 space-y-2">
                                  <Label className="text-xs text-gray-500">ชื่อกลุ่ม</Label>
                                  <Input
                                    value={group.name}
                                    onChange={(event) => updateGroup(slot.key, group.localId, { name: event.target.value })}
                                    className="font-semibold"
                                  />
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 hover:bg-red-50"
                                  onClick={() => removeGroup(slot, group.localId)}
                                  disabled={slotGroups.length <= 1}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">ลบกลุ่ม</span>
                                </Button>
                              </div>

                              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                                <div className="space-y-2">
                                  <Label className="text-xs text-gray-500">โค้ชประจำกลุ่ม</Label>
                                  <Select
                                    value={group.coachId || 'unassigned'}
                                    onValueChange={(value) => updateGroup(slot.key, group.localId, { coachId: value === 'unassigned' ? null : value })}
                                  >
                                    <SelectTrigger><SelectValue placeholder="เลือกโค้ช" /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="unassigned">ยังไม่มอบหมาย</SelectItem>
                                      {coaches.map((coach) => {
                                        const usedByOtherGroup = Boolean(
                                          usedCoachMap[coach.id]?.some((usedGroup) => usedGroup.groupId !== group.localId),
                                        )
                                        const isCurrentCoach = coach.id === group.coachId

                                        return (
                                          <SelectItem
                                            key={coach.id}
                                            value={coach.id}
                                            disabled={usedByOtherGroup && !isCurrentCoach}
                                            className={cn(
                                              usedByOtherGroup && !isCurrentCoach && 'text-gray-400 opacity-60',
                                            )}
                                          >
                                            {coach.name}{coach.id === currentUserId ? ' (ตนเอง)' : ''} - {ROLE_LABELS[coach.role] || coach.role}
                                            {usedByOtherGroup && !isCurrentCoach ? ` · ถูกใช้ใน ${usedCoachMap[coach.id].map((usedGroup) => usedGroup.name).join(', ')}` : ''}
                                          </SelectItem>
                                        )
                                      })}
                                    </SelectContent>
                                  </Select>
                                  {duplicateCoachIds.has(group.coachId || '') && (
                                    <p className="text-xs text-red-600">โค้ชคนนี้ถูกเลือกซ้ำในรอบเวลาเดียวกัน กรุณาเปลี่ยนโค้ชประจำกลุ่ม</p>
                                  )}
                                </div>
                                {bestCoach && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                    disabled={
                                      Boolean(usedCoachMap[bestCoach.coachId]?.some((usedGroup) => usedGroup.groupId !== group.localId))
                                      && bestCoach.coachId !== group.coachId
                                    }
                                    onClick={() => updateGroup(slot.key, group.localId, { coachId: bestCoach.coachId })}
                                  >
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    ใช้ {bestCoach.coachName}
                                  </Button>
                                )}
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                <Badge variant="outline" className="bg-gray-50">{describeLevelRange(group)}</Badge>
                                <Badge variant="outline" className="bg-gray-50">{groupStudents.length} คน</Badge>
                                {hasWideLevelGap(groupStudents) && (
                                  <Badge className="bg-amber-100 text-amber-800">Level ห่างมาก</Badge>
                                )}
                              </div>

                              <div className="mt-3 space-y-2">
                                {groupStudents.length === 0 ? (
                                  <div className="rounded-md border border-dashed py-6 text-center text-xs text-gray-400">
                                    ยังไม่มีผู้เรียนในกลุ่มนี้
                                  </div>
                                ) : (
                                  groupStudents.map((student) => (
                                    <StudentRow
                                      key={student.bookingSessionId}
                                      student={student}
                                      groups={slotGroups}
                                      selectedGroupId={group.localId}
                                      onMove={(nextGroupId) => moveStudent(slot.key, student.bookingSessionId, nextGroupId)}
                                    />
                                  ))
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {slotError && (
                        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                          {slotError}
                        </div>
                      )}
                      {hasDuplicateCoaches && !slotError && (
                        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                          โค้ช 1 คนไม่ควรถูกจัดหลายกลุ่มในรอบเวลาเดียวกัน ระบบปิดปุ่มบันทึกไว้จนกว่าจะเลือกโค้ชคนละคน
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StudentRow({
  student,
  groups,
  selectedGroupId,
  onMove,
}: {
  student: AssignmentStudent
  groups: GroupDraft[]
  selectedGroupId: string
  onMove: (groupId: string) => void
}) {
  return (
    <div className="rounded-md border bg-gray-50 p-2">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <User className={`h-3.5 w-3.5 shrink-0 ${student.isChild ? 'text-pink-500' : 'text-blue-500'}`} />
            <span className="font-medium text-gray-900">{student.name}</span>
            {student.parentName && <span className="text-xs text-gray-400">ผู้ปกครอง: {student.parentName}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className="bg-blue-100 text-[10px] text-blue-700">{getLevelLabel(student)}</Badge>
            {student.levelCategory && (
              <Badge variant="outline" className="bg-white text-[10px] text-gray-600">
                {LEVEL_CATEGORY_LABELS[student.levelCategory]}
              </Badge>
            )}
          </div>
          {student.coachMemory.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <History className="h-3 w-3 text-gray-400" />
              {student.coachMemory.slice(0, 3).map((memory) => (
                <Badge key={`${student.bookingSessionId}-${memory.coachId}`} variant="outline" className="bg-white text-[10px] text-gray-600">
                  {getMemoryText(memory)}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-gray-400">ยังไม่มีประวัติโค้ชจากรอบเรียนที่ผ่านมา</p>
          )}
        </div>

        <div className="w-full md:w-56">
          <Select value={selectedGroupId} onValueChange={onMove}>
            <SelectTrigger className="h-9 bg-white"><SelectValue placeholder="ย้ายกลุ่ม" /></SelectTrigger>
            <SelectContent>
              {groups.map((group) => (
                <SelectItem key={group.localId} value={group.localId}>
                  {group.name || 'กลุ่มไม่มีชื่อ'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}

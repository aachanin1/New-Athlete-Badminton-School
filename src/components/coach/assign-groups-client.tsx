'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Building2,
  CalendarDays,
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

function pickBestCoachForStudents(students: AssignmentStudent[]) {
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
  })[0] || null
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

  return Array.from(grouped.values()).map((group, index) => {
    const bestCoach = pickBestCoachForStudents(group.students)
    return {
      localId: `${slot.key}-auto-${index}`,
      name: `${group.name} (${group.students.length} คน)`,
      coachId: bestCoach?.coachId || slot.suggestedCoachId,
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

export function AssignGroupsClient({ coaches, slots, currentUserId }: AssignGroupsClientProps) {
  const router = useRouter()
  const [draftsBySlot, setDraftsBySlot] = useState<Record<string, GroupDraft[]>>(() => createInitialDraftMap(slots))
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [errorsBySlot, setErrorsBySlot] = useState<Record<string, string>>({})

  const stats = useMemo(() => {
    const totalStudents = slots.reduce((sum, slot) => sum + slot.students.length, 0)
    const savedSlots = slots.filter((slot) => slot.assignmentGroups.length > 0).length
    const needsReview = slots.filter((slot) => hasWideLevelGap(slot.students)).length

    return { totalStudents, savedSlots, needsReview }
  }, [slots])

  const groupedByDate = useMemo(() => {
    return Object.entries(slots.reduce((map, slot) => {
      if (!map[slot.date]) map[slot.date] = []
      map[slot.date].push(slot)
      return map
    }, {} as Record<string, AssignmentSlot[]>)).sort(([a], [b]) => a.localeCompare(b))
  }, [slots])

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
            <p className="text-xs text-gray-500">รอบที่รอจัดกลุ่ม</p>
            <p className="mt-1 text-2xl font-bold text-[#f57e3b]">{slots.length}</p>
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
            <p className="text-xs text-gray-500">บันทึกแล้ว</p>
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

      {groupedByDate.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <Users className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="font-medium">ยังไม่มีรอบเรียนให้มอบหมายกลุ่ม</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedByDate.map(([date, dateSlots]) => (
            <div key={date} className="space-y-3">
              <div className="flex items-center gap-2 text-[#153c85]">
                <CalendarDays className="h-4 w-4" />
                <p className="font-semibold">{formatDate(date)}</p>
              </div>

              {dateSlots.map((slot) => {
                const slotGroups = draftsBySlot[slot.key] || []
                const slotError = errorsBySlot[slot.key]

                return (
                  <Card key={slot.key} className="overflow-hidden shadow-sm">
                    <CardContent className="space-y-4 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-bold text-[#153c85]">{fmtTime(slot.startTime)} - {fmtTime(slot.endTime)}</h2>
                            <Badge className="bg-blue-100 text-blue-700">{slot.courseType || 'คอร์ส'}</Badge>
                            <Badge variant="outline">{slot.students.length} คน</Badge>
                            {slot.assignmentGroups.length > 0 && (
                              <Badge className="bg-emerald-100 text-emerald-700">บันทึกแล้ว</Badge>
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
                            จัดตาม Level
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => addGroup(slot)}>
                            <Plus className="mr-2 h-4 w-4" />
                            เพิ่มกลุ่ม
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => saveSlot(slot)}
                            disabled={savingKey === slot.key}
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
                                บันทึกกลุ่ม
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-3 xl:grid-cols-2">
                        {slotGroups.map((group) => {
                          const groupStudents = getGroupStudents(slot, group)
                          const bestCoach = pickBestCoachForStudents(groupStudents)

                          return (
                            <div
                              key={group.localId}
                              className={cn(
                                'rounded-lg border bg-white p-3',
                                hasWideLevelGap(groupStudents) && 'border-amber-300 bg-amber-50/40',
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
                                      {coaches.map((coach) => (
                                        <SelectItem key={coach.id} value={coach.id}>
                                          {coach.name}{coach.id === currentUserId ? ' (ตนเอง)' : ''} - {ROLE_LABELS[coach.role] || coach.role}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                {bestCoach && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
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
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ))}
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

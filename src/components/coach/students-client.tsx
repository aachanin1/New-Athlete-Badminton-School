'use client'

import { useMemo, useState } from 'react'
import { Baby, ChevronLeft, ChevronRight, History, Search, User, Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getLevelDisplay } from '@/constants/levels'
import type { CoachMemoryEntry } from '@/lib/coach-student-memory'

export interface CoachStudentListItem {
  id: string
  type: 'adult' | 'child'
  name: string
  parentName: string | null
  branchName: string | null
  source: string
  sessionCount: number
  level: number
  memory: CoachMemoryEntry[]
}

interface StudentsClientProps {
  students: CoachStudentListItem[]
}

const PAGE_SIZE = 12

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

function getSourceText(source: string) {
  if (source === 'assignment_group') return 'กลุ่มที่รับผิดชอบ'
  if (source === 'head_coach_branch') return 'สาขาที่รับผิดชอบ'
  return 'รอบที่ได้รับมอบหมาย'
}

function getLevelBand(level: number) {
  if (level <= 10) return '0-10'
  if (level <= 30) return '11-30'
  if (level <= 50) return '31-50'
  return '51+'
}

export function StudentsClient({ students }: StudentsClientProps) {
  const [query, setQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [levelFilter, setLevelFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('all')
  const [page, setPage] = useState(1)

  const branches = useMemo(() => {
    return Array.from(new Set(students.map((student) => student.branchName).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b, 'th'))
  }, [students])

  const filteredStudents = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return students.filter((student) => {
      const latestMemory = student.memory[0]
      const haystack = [
        student.name,
        student.parentName || '',
        student.branchName || '',
        latestMemory?.coachName || '',
        latestMemory?.lastTaughtDate || '',
        String(student.level),
      ].join(' ').toLowerCase()

      if (needle && !haystack.includes(needle)) return false
      if (sourceFilter !== 'all' && student.source !== sourceFilter) return false
      if (levelFilter !== 'all' && getLevelBand(student.level) !== levelFilter) return false
      if (typeFilter !== 'all' && student.type !== typeFilter) return false
      if (branchFilter !== 'all' && student.branchName !== branchFilter) return false
      return true
    })
  }, [branchFilter, levelFilter, query, sourceFilter, students, typeFilter])

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visibleStudents = filteredStudents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const updateFilter = (callback: () => void) => {
    callback()
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">รายชื่อนักเรียน</h1>
        <p className="mt-1 text-sm text-gray-500">
          ผู้เรียนที่เกี่ยวข้องกับกลุ่มหรือรอบสอนของคุณ พร้อมประวัติโค้ชที่เคยสอน ({students.length} คน)
        </p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="space-y-3 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={query}
              onChange={(event) => updateFilter(() => setQuery(event.target.value))}
              placeholder="ค้นหาชื่อนักเรียน ผู้ปกครอง สาขา Level หรือโค้ชที่เคยสอน..."
              className="pl-9"
            />
          </div>
          <div className="grid gap-2 md:grid-cols-4">
            <Select value={sourceFilter} onValueChange={(value) => updateFilter(() => setSourceFilter(value))}>
              <SelectTrigger><SelectValue placeholder="แหล่งข้อมูล" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสถานะ</SelectItem>
                <SelectItem value="assignment_group">รับผิดชอบตอนนี้</SelectItem>
                <SelectItem value="legacy_assignment">เคยได้รับมอบหมาย</SelectItem>
                <SelectItem value="head_coach_branch">นักเรียนในสาขา</SelectItem>
              </SelectContent>
            </Select>
            <Select value={levelFilter} onValueChange={(value) => updateFilter(() => setLevelFilter(value))}>
              <SelectTrigger><SelectValue placeholder="ช่วง Level" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุก Level</SelectItem>
                <SelectItem value="0-10">LV 0-10</SelectItem>
                <SelectItem value="11-30">LV 11-30</SelectItem>
                <SelectItem value="31-50">LV 31-50</SelectItem>
                <SelectItem value="51+">LV 51+</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(value) => updateFilter(() => setTypeFilter(value))}>
              <SelectTrigger><SelectValue placeholder="ประเภทผู้เรียน" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">เด็กและผู้ใหญ่</SelectItem>
                <SelectItem value="child">เด็ก</SelectItem>
                <SelectItem value="adult">ผู้ใหญ่</SelectItem>
              </SelectContent>
            </Select>
            <Select value={branchFilter} onValueChange={(value) => updateFilter(() => setBranchFilter(value))}>
              <SelectTrigger><SelectValue placeholder="สาขา" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสาขา</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <Badge variant="outline" className="bg-white">แสดง {visibleStudents.length} จาก {filteredStudents.length} คน</Badge>
            <Badge variant="outline" className="bg-white">ทั้งหมด {students.length} คน</Badge>
          </div>
        </CardContent>
      </Card>

      {students.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <Users className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="font-medium">ยังไม่มีนักเรียนที่ถูกมอบหมายให้คุณ</p>
          </CardContent>
        </Card>
      ) : visibleStudents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <Search className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="font-medium">ไม่พบนักเรียนตามตัวกรอง</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {visibleStudents.map((student) => {
            const levelInfo = getLevelDisplay(student.level)

            return (
              <Card key={`${student.id}-${student.type}`}>
                <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-start">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${levelInfo.color}`}>
                    <span className="text-sm font-bold">{levelInfo.level}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {student.type === 'child' ? <Baby className="h-3.5 w-3.5 text-pink-500" /> : <User className="h-3.5 w-3.5 text-blue-500" />}
                      <span className="truncate text-sm font-medium">{student.name}</span>
                      <Badge className={`${levelInfo.color} text-[10px]`}>{levelInfo.label}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                      {student.parentName && <span>ผู้ปกครอง: {student.parentName}</span>}
                      {student.branchName && <span>- {student.branchName}</span>}
                      <span>- {getSourceText(student.source)}</span>
                      <span>- พบในระบบ {student.sessionCount.toLocaleString('th-TH')} รอบ</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <History className="h-3 w-3 text-gray-400" />
                      {student.memory.length > 0 ? (
                        student.memory.slice(0, 4).map((memory) => (
                          <Badge key={`${student.id}-${memory.coachId}`} variant="outline" className="bg-white text-[10px] text-gray-600">
                            {getMemoryText(memory)}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-[11px] text-gray-400">ยังไม่มีประวัติโค้ชจากรอบที่ผ่านมา</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {filteredStudents.length > PAGE_SIZE && (
        <div className="flex items-center justify-between rounded-xl border bg-white p-2">
          <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            ก่อนหน้า
          </Button>
          <span className="text-sm text-gray-500">หน้า {currentPage} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
            ถัดไป
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

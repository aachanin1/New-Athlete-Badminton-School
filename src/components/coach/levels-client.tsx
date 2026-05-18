'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Award, Baby, BarChart3, CheckCircle2, Loader2, Search, TrendingUp, User } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ListPagination } from '@/components/admin/list-pagination'
import {
  StudentAchievementManager,
  StudentAchievementPills,
  type AchievementStudentRef,
  type ManagedStudentAchievement,
} from '@/components/shared/student-achievement-manager'
import { LEVEL_RANGES, MIN_LEVEL, formatLevelRange, getLevelDisplay, getLevelRange } from '@/constants/levels'
import type { LevelCategory } from '@/types/database'

interface LevelOption {
  id: number
  name: string
  description: string | null
  category: LevelCategory
  program_name: string | null
  requirements: string | null
  is_active: boolean
}

interface StudentData {
  id: string
  name: string
  type: 'adult' | 'child'
  parentName: string | null
  currentLevel: number | null
  lastUpdated: string | null
  achievements: ManagedStudentAchievement[]
}

interface LevelsClientProps {
  students: StudentData[]
  levels: LevelOption[]
}

const DEFAULT_PAGE_SIZE = 12

function formatDate(date: string | null) {
  if (!date) return null
  return new Date(date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
}

function getLevelName(levels: LevelOption[], level: number | null | undefined) {
  if (!level || level <= 0) return null
  return levels.find((item) => item.id === level)?.name || null
}

export function LevelsClient({ students, levels }: LevelsClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [editOpen, setEditOpen] = useState(false)
  const [editStudent, setEditStudent] = useState<StudentData | null>(null)
  const [achievementStudent, setAchievementStudent] = useState<AchievementStudentRef | null>(null)
  const [newLevel, setNewLevel] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return students
    const q = search.trim().toLowerCase()
    return students.filter((student) => (
      student.name.toLowerCase().includes(q) ||
      student.parentName?.toLowerCase().includes(q)
    ))
  }, [students, search])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visibleStudents = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const selectedLevel = useMemo(() => {
    const levelId = Number(newLevel)
    return levels.find((level) => level.id === levelId) || null
  }, [levels, newLevel])

  const openEdit = (student: StudentData) => {
    const currentLevel = student.currentLevel || 0
    const activeCurrentLevel = levels.some((level) => level.id === currentLevel)
    setEditStudent(student)
    setNewLevel(activeCurrentLevel ? String(currentLevel) : '')
    setNotes('')
    setError(null)
    setSuccess(null)
    setEditOpen(true)
  }

  const openAchievements = (student: StudentData) => {
    setAchievementStudent({
      id: student.id,
      name: student.name,
      studentType: student.type,
      achievements: student.achievements,
    })
  }

  const handleSubmit = async () => {
    if (!editStudent || !newLevel) {
      setError('กรุณาเลือก Level')
      return
    }

    const level = Number(newLevel)
    if (!Number.isInteger(level) || level <= MIN_LEVEL || !levels.some((item) => item.id === level)) {
      setError('กรุณาเลือก Level ที่เปิดใช้งานอยู่ในระบบ')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/coach/levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: editStudent.id,
          studentType: editStudent.type,
          level,
          notes: notes || null,
        }),
      })

      const result = await response.json().catch(() => null)
      if (!response.ok) {
        setError(result?.error || 'บันทึก Level ไม่สำเร็จ')
        return
      }

      setSuccess(`อัปเดต ${editStudent.name} เป็น LV ${level} สำเร็จ`)
      setTimeout(() => {
        setEditOpen(false)
        router.refresh()
      }, 900)
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-[#2748bf]">
            <BarChart3 className="h-4 w-4" />
            Coach Evaluation
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#153c85]">ประเมิน Level นักเรียน</h1>
          <p className="mt-1 text-sm text-gray-500">
            เลือก Level จากค่าที่ Super Admin เปิดใช้งาน นักเรียนทุกคนเริ่มที่ Level 0 จนกว่า Coach จะประเมิน
          </p>
        </div>
        <Badge variant="outline" className="w-fit border-blue-200 bg-blue-50 px-3 py-2 text-[#2748bf]">
          ใช้ข้อมูลจาก DB: {levels.length} Level
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {LEVEL_RANGES.map((range) => (
          <Badge key={range.category} className={`${range.color} text-xs`}>
            {range.label} (LV {formatLevelRange(range)})
          </Badge>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="ค้นหาชื่อนักเรียนหรือผู้ปกครอง..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setPage(1)
          }}
          className="pl-10"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <BarChart3 className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="font-medium">{search ? 'ไม่พบนักเรียน' : 'ยังไม่มีนักเรียนในสาขาของคุณ'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {visibleStudents.map((student) => {
            const levelInfo = getLevelDisplay(student.currentLevel)
            const updatedText = formatDate(student.lastUpdated)
            const levelName = getLevelName(levels, student.currentLevel)

            return (
              <Card key={`${student.id}-${student.type}`} className="transition-shadow hover:shadow-sm">
                <CardContent className="grid gap-3 p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${levelInfo.color}`}>
                    <span className="text-sm font-bold">{levelInfo.level}</span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {student.type === 'child' ? <Baby className="h-3.5 w-3.5 text-pink-500" /> : <User className="h-3.5 w-3.5 text-blue-500" />}
                      <span className="truncate text-sm font-semibold text-[#153c85]">{student.name}</span>
                      <StudentAchievementPills achievements={student.achievements} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                      {student.parentName && <span>ผู้ปกครอง: {student.parentName}</span>}
                      <Badge className={`${levelInfo.color} text-[10px]`}>{levelName || levelInfo.label}</Badge>
                      {updatedText && <span>อัปเดต: {updatedText}</span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                    <Button size="sm" variant="outline" className="h-8 text-[#f57e3b]" onClick={() => openAchievements(student)}>
                      <Award className="mr-1 h-3.5 w-3.5" />
                      รางวัล
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-[#2748bf]" onClick={() => openEdit(student)}>
                      <TrendingUp className="mr-1 h-3.5 w-3.5" />
                      กรอก LV
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {filtered.length > pageSize && (
        <ListPagination
          page={currentPage}
          pageSize={pageSize}
          total={filtered.length}
          pageSizeOptions={[12, 24, 48]}
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPageSize(value)
            setPage(1)
          }}
        />
      )}

      <Dialog open={editOpen} onOpenChange={(open) => { if (!loading) setEditOpen(open) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">อัปเดต Level</DialogTitle>
            <DialogDescription>
              เลือก Level ใหม่จากค่าที่เปิดใช้งานในระบบ พร้อมบันทึกหมายเหตุการประเมินของผู้เรียน
            </DialogDescription>
          </DialogHeader>
          {editStudent && (
            <div className="space-y-4">
              {error && <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
              {success && <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-600"><CheckCircle2 className="h-4 w-4 shrink-0" />{success}</div>}

              <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3">
                {editStudent.type === 'child' ? <Baby className="h-4 w-4 text-pink-500" /> : <User className="h-4 w-4 text-blue-500" />}
                <div>
                  <p className="text-sm font-medium">{editStudent.name}</p>
                  <p className="text-xs text-gray-400">Level ปัจจุบัน: {editStudent.currentLevel ?? MIN_LEVEL}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Level ใหม่</Label>
                <Select value={newLevel} onValueChange={setNewLevel} disabled={levels.length === 0}>
                  <SelectTrigger>
                    <SelectValue placeholder={levels.length === 0 ? 'ยังไม่มี Level ที่เปิดใช้งาน' : 'เลือก Level'} />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map((level) => {
                      const range = getLevelRange(level.id)
                      return (
                        <SelectItem key={level.id} value={String(level.id)}>
                          LV {level.id} - {level.name || range.label}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                {selectedLevel && (
                  <div className="rounded-lg border bg-blue-50/60 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={getLevelDisplay(selectedLevel.id).color}>LV {selectedLevel.id}</Badge>
                      <span className="font-semibold text-[#153c85]">{selectedLevel.name}</span>
                      <span className="text-xs text-gray-500">{selectedLevel.program_name || getLevelRange(selectedLevel.id).label}</span>
                    </div>
                    {(selectedLevel.requirements || selectedLevel.description) && (
                      <p className="mt-2 text-gray-600">{selectedLevel.requirements || selectedLevel.description}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>หมายเหตุ (ไม่บังคับ)</Label>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="เช่น พัฒนาดี, ต้องฝึก backhand เพิ่ม"
                  rows={3}
                />
              </div>

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row">
                <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)} disabled={loading}>ยกเลิก</Button>
                <Button className="flex-1 bg-[#2748bf] hover:bg-[#153c85]" onClick={handleSubmit} disabled={loading || !newLevel}>
                  {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                  บันทึก Level
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <StudentAchievementManager
        student={achievementStudent}
        open={Boolean(achievementStudent)}
        onOpenChange={(open) => {
          if (!open) setAchievementStudent(null)
        }}
      />
    </div>
  )
}

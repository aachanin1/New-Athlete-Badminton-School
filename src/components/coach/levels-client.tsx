'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Baby, BarChart3, CheckCircle2, Loader2, Search, TrendingUp, User } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LEVEL_RANGES, MAX_LEVEL, MIN_LEVEL, getLevelDisplay } from '@/constants/levels'

interface StudentData {
  id: string
  name: string
  type: 'adult' | 'child'
  parentName: string | null
  currentLevel: number | null
  lastUpdated: string | null
}

interface LevelsClientProps {
  students: StudentData[]
}

function formatDate(date: string | null) {
  if (!date) return null
  return new Date(date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

export function LevelsClient({ students }: LevelsClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editStudent, setEditStudent] = useState<StudentData | null>(null)
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

  const openEdit = (student: StudentData) => {
    setEditStudent(student)
    setNewLevel((student.currentLevel ?? MIN_LEVEL).toString())
    setNotes('')
    setError(null)
    setSuccess(null)
    setEditOpen(true)
  }

  const handleSubmit = async () => {
    if (!editStudent || !newLevel) {
      setError('กรุณาระบุ Level')
      return
    }

    const level = Number(newLevel)
    if (!Number.isInteger(level) || level < MIN_LEVEL || level > MAX_LEVEL) {
      setError(`Level ต้องอยู่ระหว่าง ${MIN_LEVEL}-${MAX_LEVEL}`)
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
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">กรอก LV นักเรียน</h1>
        <p className="mt-1 text-sm text-gray-500">อัปเดต Level พัฒนาการนักเรียน (LV {MIN_LEVEL}-{MAX_LEVEL})</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {LEVEL_RANGES.map((range) => (
          <Badge key={range.category} className={`${range.color} text-xs`}>
            {range.label} (LV {range.minLevel}-{range.maxLevel})
          </Badge>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="ค้นหาชื่อนักเรียน..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
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
          {filtered.map((student) => {
            const levelInfo = getLevelDisplay(student.currentLevel)
            const updatedText = formatDate(student.lastUpdated)

            return (
              <Card key={`${student.id}-${student.type}`} className="transition-shadow hover:shadow-sm">
                <CardContent className="flex items-center gap-3 p-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${levelInfo.color}`}>
                    <span className="text-sm font-bold">{levelInfo.level}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {student.type === 'child' ? <Baby className="h-3.5 w-3.5 text-pink-500" /> : <User className="h-3.5 w-3.5 text-blue-500" />}
                      <span className="truncate text-sm font-medium">{student.name}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                      {student.parentName && <span>ผู้ปกครอง: {student.parentName}</span>}
                      <Badge className={`${levelInfo.color} text-[10px]`}>{levelInfo.label}</Badge>
                      {updatedText && <span>อัปเดต: {updatedText}</span>}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="h-8 text-[#2748bf]" onClick={() => openEdit(student)}>
                    <TrendingUp className="mr-1 h-3.5 w-3.5" />
                    กรอก LV
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={(open) => { if (!loading) setEditOpen(open) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">อัปเดต Level</DialogTitle>
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
                <Label>Level ใหม่ ({MIN_LEVEL}-{MAX_LEVEL})</Label>
                <Input type="number" min={MIN_LEVEL} max={MAX_LEVEL} value={newLevel} onChange={(event) => setNewLevel(event.target.value)} placeholder={`${MIN_LEVEL}-${MAX_LEVEL}`} />
                {newLevel !== '' && Number(newLevel) >= MIN_LEVEL && Number(newLevel) <= MAX_LEVEL && (
                  <Badge className={`${getLevelDisplay(Number(newLevel)).color} text-xs`}>
                    {getLevelDisplay(Number(newLevel)).label}
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                <Label>หมายเหตุ (ไม่บังคับ)</Label>
                <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="เช่น พัฒนาดี, ต้องฝึก backhand เพิ่ม" />
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)} disabled={loading}>ยกเลิก</Button>
                <Button className="flex-1 bg-[#2748bf] hover:bg-[#153c85]" onClick={handleSubmit} disabled={loading}>
                  {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                  บันทึก Level
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

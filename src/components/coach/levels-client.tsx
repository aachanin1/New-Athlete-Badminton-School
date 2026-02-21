'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Search, BarChart3, Baby, User, TrendingUp, CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react'

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

const LEVEL_CATEGORIES = [
  { label: 'Basic', min: 1, max: 15, color: 'bg-gray-100 text-gray-700' },
  { label: 'Athlete 1', min: 16, max: 30, color: 'bg-blue-100 text-blue-700' },
  { label: 'Athlete 2', min: 31, max: 45, color: 'bg-purple-100 text-purple-700' },
  { label: 'Athlete 3', min: 46, max: 60, color: 'bg-amber-100 text-amber-700' },
]

function getLevelCategory(level: number) {
  return LEVEL_CATEGORIES.find((c) => level >= c.min && level <= c.max) || LEVEL_CATEGORIES[0]
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
    if (!search) return students
    const q = search.toLowerCase()
    return students.filter((s) => s.name.toLowerCase().includes(q) || s.parentName?.toLowerCase().includes(q))
  }, [students, search])

  const openEdit = (student: StudentData) => {
    setEditStudent(student)
    setNewLevel(student.currentLevel?.toString() || '')
    setNotes('')
    setError(null)
    setSuccess(null)
    setEditOpen(true)
  }

  const handleSubmit = async () => {
    if (!editStudent || !newLevel) { setError('กรุณาระบุ Level'); return }
    const lvl = parseInt(newLevel)
    if (isNaN(lvl) || lvl < 1 || lvl > 60) { setError('Level ต้องอยู่ระหว่าง 1-60'); return }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/coach/levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: editStudent.id,
          studentType: editStudent.type,
          level: lvl,
          notes: notes || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error); setLoading(false); return }

      setSuccess(`อัปเดต Level ${editStudent.name} เป็น LV ${lvl} สำเร็จ!`)
      setLoading(false)
      setTimeout(() => { setEditOpen(false); router.refresh() }, 1200)
    } catch {
      setError('เกิดข้อผิดพลาด')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">กรอก LV นักเรียน</h1>
        <p className="text-gray-500 text-sm mt-1">อัปเดต Level พัฒนาการนักเรียน (LV 1-60)</p>
      </div>

      {/* Level category legend */}
      <div className="flex flex-wrap gap-2">
        {LEVEL_CATEGORIES.map((cat) => (
          <Badge key={cat.label} className={`${cat.color} text-xs`}>{cat.label} (LV {cat.min}-{cat.max})</Badge>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input placeholder="ค้นหาชื่อนักเรียน..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">
          <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">{search ? 'ไม่พบนักเรียน' : 'ยังไม่มีนักเรียนในสาขาของคุณ'}</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((student) => {
            const cat = student.currentLevel ? getLevelCategory(student.currentLevel) : null
            return (
              <Card key={student.id + student.type} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${cat?.color || 'bg-gray-100'}`}>
                    {student.currentLevel ? (
                      <span className="font-bold text-sm">{student.currentLevel}</span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {student.type === 'child' ? <Baby className="h-3.5 w-3.5 text-pink-500" /> : <User className="h-3.5 w-3.5 text-blue-500" />}
                      <span className="font-medium text-sm truncate">{student.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-400">
                      {student.parentName && <span>ผู้ปกครอง: {student.parentName}</span>}
                      {cat && <Badge className={`${cat.color} text-[10px]`}>{cat.label}</Badge>}
                      {student.lastUpdated && <span>อัปเดต: {new Date(student.lastUpdated).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="h-8 text-[#2748bf]" onClick={() => openEdit(student)}>
                    <TrendingUp className="h-3.5 w-3.5 mr-1" />กรอก LV
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { if (!loading) setEditOpen(v) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">อัปเดต Level</DialogTitle>
          </DialogHeader>
          {editStudent && (
            <div className="space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
              {success && <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0" />{success}</div>}

              <div className="p-3 bg-gray-50 rounded-lg flex items-center gap-2">
                {editStudent.type === 'child' ? <Baby className="h-4 w-4 text-pink-500" /> : <User className="h-4 w-4 text-blue-500" />}
                <div>
                  <p className="font-medium text-sm">{editStudent.name}</p>
                  <p className="text-xs text-gray-400">Level ปัจจุบัน: {editStudent.currentLevel || 'ยังไม่ได้กรอก'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Level ใหม่ (1-60)</Label>
                <Input type="number" min={1} max={60} value={newLevel} onChange={(e) => setNewLevel(e.target.value)} placeholder="1-60" />
                {newLevel && parseInt(newLevel) >= 1 && parseInt(newLevel) <= 60 && (
                  <Badge className={`${getLevelCategory(parseInt(newLevel)).color} text-xs`}>
                    {getLevelCategory(parseInt(newLevel)).label}
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                <Label>หมายเหตุ (ไม่บังคับ)</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="เช่น พัฒนาดี, ต้องฝึก backhand เพิ่ม" />
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)} disabled={loading}>ยกเลิก</Button>
                <Button className="flex-1 bg-[#2748bf] hover:bg-[#153c85]" onClick={handleSubmit} disabled={loading}>
                  {loading ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />บันทึก...</> : 'บันทึก Level'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

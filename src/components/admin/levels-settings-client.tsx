'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, BarChart3, CheckCircle2, Edit3, EyeOff, Loader2, Plus, Search, ShieldCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  DEFAULT_EXTENDED_LEVEL_CATEGORY,
  LEVEL_RANGES,
  formatLevelRange,
  getLevelRange,
  getLevelRangeByCategory,
} from '@/constants/levels'
import type { LevelCategory } from '@/types/database'

interface LevelData {
  id: number
  name: string
  description: string | null
  category: LevelCategory
  program_name: string | null
  requirements: string | null
  is_active: boolean
  updated_at: string | null
}

interface LevelsSettingsClientProps {
  levels: LevelData[]
}

const CATEGORY_LABELS: Record<LevelCategory, string> = {
  basic: 'ชุดพื้นฐาน',
  athlete_1: 'ชุดเตรียมนักกีฬา C',
  athlete_2: 'ชุดนักกีฬา B',
  athlete_3: 'ชุดนักกีฬา A',
}

type DialogMode = 'create' | 'edit'

function formatDate(date: string | null) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getNextLevelId(levels: LevelData[]) {
  return levels.reduce((max, level) => Math.max(max, level.id), 0) + 1
}

export function LevelsSettingsClient({ levels }: LevelsSettingsClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<'all' | LevelCategory>('all')
  const [dialogMode, setDialogMode] = useState<DialogMode>('edit')
  const [editLevel, setEditLevel] = useState<LevelData | null>(null)
  const [form, setForm] = useState({
    id: '',
    name: '',
    description: '',
    programName: '',
    requirements: '',
    category: DEFAULT_EXTENDED_LEVEL_CATEGORY,
    isActive: true,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const stats = useMemo(() => {
    const active = levels.filter((level) => level.is_active).length
    return {
      total: levels.length,
      active,
      hidden: levels.length - active,
      programs: new Set(levels.map((level) => level.program_name || getLevelRangeByCategory(level.category).label)).size,
    }
  }, [levels])

  const filteredLevels = useMemo(() => {
    const q = search.trim().toLowerCase()
    return levels.filter((level) => {
      const matchesSearch = !q || [
        String(level.id),
        level.name,
        level.program_name || '',
        level.requirements || '',
        CATEGORY_LABELS[level.category],
      ].some((value) => value.toLowerCase().includes(q))
      const matchesCategory = selectedCategory === 'all' || level.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [levels, search, selectedCategory])

  const groupedLevels = useMemo(() => {
    return LEVEL_RANGES.map((range) => ({
      ...range,
      levels: filteredLevels
        .filter((level) => level.category === range.category)
        .sort((a, b) => a.id - b.id),
    })).filter((group) => group.levels.length > 0)
  }, [filteredLevels])

  const levelIdError = useMemo(() => {
    if (dialogMode !== 'create') return null

    const levelId = Number(form.id)
    if (!form.id.trim() || !Number.isInteger(levelId) || levelId < 1) {
      return 'เลข Level ต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป'
    }

    if (levels.some((level) => level.id === levelId)) {
      return `มี Level ${levelId} อยู่แล้ว กรุณาใช้เลขอื่น`
    }

    return null
  }, [dialogMode, form.id, levels])

  const openCreate = () => {
    const nextId = getNextLevelId(levels)
    const range = getLevelRange(nextId)
    setDialogMode('create')
    setEditLevel(null)
    setError(null)
    setSuccess(null)
    setForm({
      id: String(nextId),
      name: '',
      description: '',
      programName: range.label,
      requirements: '',
      category: range.category,
      isActive: true,
    })
  }

  const openEdit = (level: LevelData) => {
    const range = getLevelRangeByCategory(level.category)
    setDialogMode('edit')
    setError(null)
    setSuccess(null)
    setEditLevel(level)
    setForm({
      id: String(level.id),
      name: level.name,
      description: level.description || '',
      programName: level.program_name || range.label,
      requirements: level.requirements || '',
      category: level.category,
      isActive: level.is_active,
    })
  }

  const closeDialog = () => {
    if (loading) return
    setDialogMode('edit')
    setEditLevel(null)
    setSuccess(null)
    setError(null)
  }

  const saveLevel = async () => {
    if (!form.name.trim()) return
    if (levelIdError) {
      setError(levelIdError)
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/admin/levels', {
        method: dialogMode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: form.id,
          name: form.name,
          description: form.description,
          programName: form.programName,
          requirements: form.requirements,
          category: form.category,
          isActive: form.isActive,
        }),
      })

      const result = await response.json().catch(() => null)
      if (!response.ok) {
        setError(result?.error || 'บันทึก Level ไม่สำเร็จ')
        return
      }

      setSuccess(dialogMode === 'create' ? 'เพิ่ม Level ใหม่สำเร็จ' : 'บันทึก Level สำเร็จ')
      router.refresh()
      setTimeout(() => {
        setDialogMode('edit')
        setEditLevel(null)
        setSuccess(null)
      }, 800)
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  const dialogOpen = dialogMode === 'create' || Boolean(editLevel)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-[#2748bf]">
            <BarChart3 className="h-4 w-4" />
            Level System
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#153c85]">ตั้งค่า Level นักเรียน</h1>
          <p className="mt-1 text-sm text-gray-500">
            แก้ชื่อ รายละเอียด เงื่อนไขการทดสอบ และเพิ่ม Level ใหม่ได้โดยไม่จำกัดที่ LV 70
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
            <ShieldCheck className="mr-1 h-3.5 w-3.5" />
            Super Admin เท่านั้น
          </Badge>
          <Button className="bg-[#2748bf] hover:bg-[#153c85]" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            เพิ่ม Level
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">ทั้งหมด</p><p className="mt-1 text-2xl font-bold text-[#153c85]">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">เปิดใช้งาน</p><p className="mt-1 text-2xl font-bold text-emerald-600">{stats.active}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">ปิดซ่อน</p><p className="mt-1 text-2xl font-bold text-gray-600">{stats.hidden}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">ชุดหลัก</p><p className="mt-1 text-2xl font-bold text-orange-600">{stats.programs}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(240px,1fr)_220px] lg:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหา LV, ชื่อทักษะ, ชุด หรือเงื่อนไขทดสอบ..."
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as 'all' | LevelCategory)}>
            <SelectTrigger><SelectValue placeholder="ทุกชุด" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกชุด</SelectItem>
              {LEVEL_RANGES.map((range) => (
                <SelectItem key={range.category} value={range.category}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {groupedLevels.map((group) => (
          <Card key={group.category} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex flex-col gap-2 border-b bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-[#153c85]">{group.label}</p>
                  <p className="text-xs text-gray-500">LV {formatLevelRange(group)} - {group.description}</p>
                </div>
                <Badge className={`${group.color} w-fit`}>{group.levels.length} รายการ</Badge>
              </div>
              <div className="divide-y">
                {group.levels.map((level) => {
                  const levelRange = getLevelRangeByCategory(level.category)

                  return (
                    <div key={level.id} className="grid gap-3 px-4 py-4 2xl:grid-cols-[90px_minmax(220px,1fr)_minmax(260px,1.2fr)_150px_90px] 2xl:items-center">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold ${levelRange.color}`}>LV {level.id}</div>
                        {!level.is_active && <EyeOff className="h-4 w-4 text-gray-400" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-[#153c85]">{level.name}</p>
                        <p className="mt-1 text-xs text-gray-500">{level.program_name || levelRange.label}</p>
                      </div>
                      <p className="line-clamp-2 text-sm text-gray-500">{level.requirements || level.description || 'ยังไม่ได้ระบุเงื่อนไขการผ่าน Level นี้'}</p>
                      <div className="text-xs text-gray-400">อัปเดต {formatDate(level.updated_at)}</div>
                      <Button variant="outline" size="sm" onClick={() => openEdit(level)}>
                        <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                        แก้ไข
                      </Button>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog() }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">
              {dialogMode === 'create' ? 'เพิ่ม Level ใหม่' : `แก้ไข Level ${editLevel?.id}`}
            </DialogTitle>
            <DialogDescription>
              Level ที่เปิดใช้งานจะไปแสดงให้ Coach เลือกประเมินผู้เรียนได้ทันที
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-600"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
            {success && <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4 shrink-0" />{success}</div>}

            <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
              <div className="space-y-2">
                <Label>เลข Level</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.id}
                  onChange={(event) => {
                    setError(null)
                    setForm((current) => ({ ...current, id: event.target.value }))
                  }}
                  disabled={dialogMode === 'edit'}
                  aria-invalid={Boolean(levelIdError)}
                />
                {levelIdError && <p className="text-xs text-rose-600">{levelIdError}</p>}
              </div>
              <div className="space-y-2">
                <Label>ชื่อ Level</Label>
                <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>ชุดหลัก</Label>
                <Input value={form.programName} onChange={(event) => setForm((current) => ({ ...current, programName: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>หมวดระบบ</Label>
                <Select value={form.category} onValueChange={(value) => setForm((current) => ({ ...current, category: value as LevelCategory }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEVEL_RANGES.map((range) => (
                      <SelectItem key={range.category} value={range.category}>
                        {CATEGORY_LABELS[range.category]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>คำอธิบาย</Label>
              <Textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} />
            </div>

            <div className="space-y-2">
              <Label>เงื่อนไข/วิธีทดสอบ</Label>
              <Textarea value={form.requirements} onChange={(event) => setForm((current) => ({ ...current, requirements: event.target.value }))} rows={5} />
            </div>

            <label className="flex items-center gap-3 rounded-lg border p-3 text-sm">
              <Checkbox checked={form.isActive} onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked === true }))} />
              เปิดใช้งาน Level นี้ให้ Coach เลือกประเมิน
            </label>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={closeDialog} disabled={loading}>ยกเลิก</Button>
              <Button className="bg-[#2748bf] hover:bg-[#153c85]" onClick={saveLevel} disabled={loading || !form.name.trim() || Boolean(levelIdError)}>
                {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                {dialogMode === 'create' ? 'เพิ่ม Level' : 'บันทึก Level'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

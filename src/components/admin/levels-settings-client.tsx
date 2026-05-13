'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, BarChart3, CheckCircle2, Edit3, EyeOff, Loader2, Search, ShieldCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { LEVEL_RANGES, getLevelRange } from '@/constants/levels'
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

export function LevelsSettingsClient({ levels }: LevelsSettingsClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<'all' | LevelCategory>('all')
  const [editLevel, setEditLevel] = useState<LevelData | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    programName: '',
    requirements: '',
    category: 'basic' as LevelCategory,
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
      programs: new Set(levels.map((level) => level.program_name || getLevelRange(level.id).label)).size,
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
      ].some((value) => value.toLowerCase().includes(q))
      const matchesCategory = selectedCategory === 'all' || level.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [levels, search, selectedCategory])

  const groupedLevels = useMemo(() => {
    return LEVEL_RANGES.map((range) => ({
      ...range,
      levels: filteredLevels.filter((level) => level.id >= range.minLevel && level.id <= range.maxLevel),
    })).filter((group) => group.levels.length > 0)
  }, [filteredLevels])

  const openEdit = (level: LevelData) => {
    setError(null)
    setSuccess(null)
    setEditLevel(level)
    setForm({
      name: level.name,
      description: level.description || '',
      programName: level.program_name || getLevelRange(level.id).label,
      requirements: level.requirements || '',
      category: level.category,
      isActive: level.is_active,
    })
  }

  const saveLevel = async () => {
    if (!editLevel || !form.name.trim()) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/admin/levels', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editLevel.id,
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

      setSuccess('บันทึก Level สำเร็จ')
      router.refresh()
      setTimeout(() => setEditLevel(null), 800)
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
            Level System
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#153c85]">ตั้งค่า Level นักเรียน</h1>
          <p className="mt-1 text-sm text-gray-500">แก้ชื่อ Level, รายละเอียดการทดสอบ และเปิด/ปิด Level ที่ใช้ในระบบ</p>
        </div>
        <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
          <ShieldCheck className="mr-1 h-3.5 w-3.5" />
          Super Admin เท่านั้น
        </Badge>
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
                  <p className="text-xs text-gray-500">LV {group.minLevel}-{group.maxLevel} • {group.description}</p>
                </div>
                <Badge className={`${group.color} w-fit`}>{group.levels.length} รายการ</Badge>
              </div>
              <div className="divide-y">
                {group.levels.map((level) => {
                  const levelRange = getLevelRange(level.id)

                  return (
                    <div key={level.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[90px_minmax(260px,1fr)_minmax(260px,1.1fr)_150px_90px] lg:items-center">
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

      <Dialog open={Boolean(editLevel)} onOpenChange={(open) => { if (!open && !loading) setEditLevel(null) }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">แก้ไข Level {editLevel?.id}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-600"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
            {success && <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4 shrink-0" />{success}</div>}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>ชื่อ Level</Label>
                <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>ชุดหลัก</Label>
                <Input value={form.programName} onChange={(event) => setForm((current) => ({ ...current, programName: event.target.value }))} />
              </div>
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
              เปิดใช้งาน Level นี้
            </label>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setEditLevel(null)} disabled={loading}>ยกเลิก</Button>
              <Button className="bg-[#2748bf] hover:bg-[#153c85]" onClick={saveLevel} disabled={loading || !form.name.trim()}>
                {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                บันทึก Level
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

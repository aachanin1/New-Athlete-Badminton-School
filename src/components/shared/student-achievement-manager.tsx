'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Award, Loader2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export interface ManagedStudentAchievement {
  id: string
  emoji: string
  title: string
  description: string | null
  awardedAt: string | null
}

export interface AchievementStudentRef {
  id: string
  name: string
  studentType: 'adult' | 'child'
  achievements: ManagedStudentAchievement[]
}

export const ACHIEVEMENT_EMOJI_PRESETS = [
  { emoji: '🏆', label: 'ถ้วย' },
  { emoji: '🥇', label: 'ทอง' },
  { emoji: '🥈', label: 'เงิน' },
  { emoji: '🥉', label: 'ทองแดง' },
  { emoji: '🏅', label: 'เหรียญ' },
  { emoji: '🎖️', label: 'เกียรติยศ' },
  { emoji: '⭐', label: 'ดาวเด่น' },
  { emoji: '👑', label: 'แชมป์' },
  { emoji: '🔥', label: 'ฟอร์มแรง' },
  { emoji: '💪', label: 'พัฒนาเด่น' },
]

export function StudentAchievementPills({ achievements }: { achievements: ManagedStudentAchievement[] }) {
  if (achievements.length === 0) return null

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {achievements.slice(0, 4).map((achievement) => (
        <span
          key={achievement.id}
          className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-50 px-1 text-sm ring-1 ring-amber-200"
          title={achievement.description ? `${achievement.title}: ${achievement.description}` : achievement.title}
          aria-label={achievement.title}
        >
          {achievement.emoji}
        </span>
      ))}
      {achievements.length > 4 && (
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
          +{achievements.length - 4}
        </span>
      )}
    </span>
  )
}

export function StudentAchievementManager({
  student,
  open,
  onOpenChange,
}: {
  student: AchievementStudentRef | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const hasLocalChanges = useRef(false)
  const [emoji, setEmoji] = useState('🏆')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [awardedAt, setAwardedAt] = useState('')
  const [displayAchievements, setDisplayAchievements] = useState<ManagedStudentAchievement[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDisplayAchievements(student?.achievements || [])
    hasLocalChanges.current = false
  }, [student])

  const resetForm = () => {
    setEmoji('🏆')
    setTitle('')
    setDescription('')
    setAwardedAt('')
    setError(null)
  }

  const closeDialog = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (nextOpen) return

    resetForm()
    if (hasLocalChanges.current) {
      hasLocalChanges.current = false
      router.refresh()
    }
  }

  const saveAchievement = async () => {
    if (!student) return
    if (!emoji.trim() || !title.trim()) {
      setError('กรุณาเลือก emoji และกรอกชื่อรางวัล')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/student-achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          studentType: student.studentType,
          emoji: emoji.trim(),
          title: title.trim(),
          description: description.trim() || null,
          awardedAt: awardedAt || null,
        }),
      })

      const result = await response.json().catch(() => null)
      if (!response.ok) {
        setError(result?.error || 'บันทึกรางวัลไม่สำเร็จ')
        return
      }

      if (result?.data) {
        setDisplayAchievements((current) => [result.data, ...current])
      }
      hasLocalChanges.current = true
      resetForm()
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  const deactivateAchievement = async (achievementId: string) => {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/student-achievements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: achievementId, isActive: false }),
      })

      const result = await response.json().catch(() => null)
      if (!response.ok) {
        setError(result?.error || 'ปิดรางวัลไม่สำเร็จ')
        return
      }

      setDisplayAchievements((current) => current.filter((achievement) => achievement.id !== achievementId))
      hasLocalChanges.current = true
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#153c85]">
            <Award className="h-5 w-5 text-[#f57e3b]" />
            จัดการรางวัลหลังชื่อนักเรียน
          </DialogTitle>
          <DialogDescription>
            เพิ่มหรือปิดรางวัลของนักเรียน รายการที่เปิดใช้งานจะแสดงบนหน้า Ranking หลังปิดหน้าต่างนี้
          </DialogDescription>
        </DialogHeader>

        {student && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-gray-50 p-3">
              <p className="font-semibold text-[#153c85]">{student.name}</p>
              <p className="mt-1 text-sm text-gray-500">รางวัลที่เปิดใช้งานจะแสดงบนหน้า Ranking ทั้งฝั่ง Public, Admin และ Coach</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-700">รางวัลที่ใช้งานอยู่</p>
              {displayAchievements.length === 0 ? (
                <p className="rounded-lg border border-dashed py-4 text-center text-sm text-gray-400">ยังไม่มีรางวัล</p>
              ) : (
                displayAchievements.map((achievement) => (
                  <div key={achievement.id} className="flex items-start gap-3 rounded-lg border p-3">
                    <span className="flex h-9 min-w-9 items-center justify-center rounded-full bg-amber-50 text-lg ring-1 ring-amber-200">
                      {achievement.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#153c85]">{achievement.title}</p>
                      {achievement.description && <p className="mt-1 text-sm text-gray-500">{achievement.description}</p>}
                      {achievement.awardedAt && (
                        <p className="mt-1 text-xs text-gray-400">
                          วันที่ได้รับ {new Date(achievement.awardedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving}
                      onClick={() => deactivateAchievement(achievement.id)}
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      ปิด
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="rounded-lg border p-3">
              <div className="mb-3">
                <Label>เลือก emoji รางวัล</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ACHIEVEMENT_EMOJI_PRESETS.map((preset) => (
                    <button
                      key={`${preset.emoji}-${preset.label}`}
                      type="button"
                      className={`rounded-lg border px-3 py-2 text-sm transition ${emoji === preset.emoji ? 'border-[#2748bf] bg-blue-50 text-[#153c85]' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                      onClick={() => setEmoji(preset.emoji)}
                      title={preset.label}
                    >
                      <span className="mr-1.5 text-base">{preset.emoji}</span>
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[96px_minmax(0,1fr)]">
                <div>
                  <Label htmlFor="achievement-emoji">Emoji</Label>
                  <Input id="achievement-emoji" value={emoji} onChange={(event) => setEmoji(event.target.value)} placeholder="🏆" maxLength={8} />
                </div>
                <div>
                  <Label htmlFor="achievement-title">ชื่อรางวัล/ผลงาน</Label>
                  <Input id="achievement-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="แชมป์รายการ..." />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="achievement-description">รายละเอียด</Label>
                  <Textarea id="achievement-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="รายละเอียดสั้น ๆ สำหรับแสดงเมื่อชี้ที่ emoji" rows={3} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="achievement-date">วันที่ได้รับรางวัล</Label>
                  <Input id="achievement-date" type="date" value={awardedAt} onChange={(event) => setAwardedAt(event.target.value)} />
                </div>
                {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600 sm:col-span-2">{error}</p>}
                <div className="sm:col-span-2">
                  <Button type="button" className="w-full bg-[#2748bf] hover:bg-[#153c85]" disabled={saving || !title.trim()} onClick={saveAchievement}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Award className="mr-2 h-4 w-4" />}
                    เพิ่มรางวัล
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

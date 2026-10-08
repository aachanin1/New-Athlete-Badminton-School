'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { LevelAssessment, LevelAssessmentPage } from '@/types/level-assessment'

export function LevelAssessmentDetails({ assessment }: { assessment: LevelAssessment }) {
  return (
    <div className="space-y-2 text-sm">
      <p className="text-xs text-gray-500">
        LV {assessment.level} · {new Date(assessment.createdAt).toLocaleString('th-TH', {
          timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit',
        })} · {assessment.evaluatedBy || 'ไม่พบชื่อผู้ประเมิน'}
      </p>
      <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{assessment.notes || 'ไม่ได้ระบุหมายเหตุในการประเมินครั้งนี้'}</p>
    </div>
  )
}

export function LevelAssessmentHistory({ studentId, studentType }: { studentId: string; studentType: 'child' | 'adult' }) {
  const [items, setItems] = useState<LevelAssessment[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef(false)
  const controller = useRef<AbortController | null>(null)

  const loadPage = useCallback(async (before: string | null, signal: AbortSignal) => {
    pending.current = true
    try {
      const params = new URLSearchParams({ studentId, studentType })
      if (before) params.set('before', before)
      const response = await fetch(`/api/coach/levels?${params}`, { signal, cache: 'no-store' })
      const result = await response.json() as LevelAssessmentPage & { error?: string }
      if (!response.ok) throw new Error(result.error || 'อ่านประวัติไม่สำเร็จ')
      if (signal.aborted) return
      setItems((previous) => before ? [...previous, ...result.items.filter((item) => !previous.some((old) => old.id === item.id))] : result.items)
      setNextCursor(result.nextCursor)
      setError(null)
    } catch (err) {
      if (!signal.aborted) setError(err instanceof Error ? err.message : 'อ่านประวัติไม่สำเร็จ')
    } finally {
      if (!signal.aborted) { pending.current = false; setLoading(false) }
    }
  }, [studentId, studentType])

  useEffect(() => {
    const initial = new AbortController()
    controller.current = initial
    void loadPage(null, initial.signal)
    return () => { controller.current?.abort() }
  }, [loadPage])

  const loadMore = () => {
    if (pending.current) return
    controller.current = new AbortController()
    setLoading(true)
    setError(null)
    void loadPage(items.length ? nextCursor : null, controller.current.signal)
  }

  return (
    <div className="mt-3 space-y-4" aria-busy={loading}>
      {items.map((assessment) => (
        <div key={assessment.id} className="border-l-2 pl-3" data-assessment-id={assessment.id}>
          <LevelAssessmentDetails assessment={assessment} />
        </div>
      ))}
      {error && <div role="alert" className="text-sm text-red-600">{error}</div>}
      {loading && <p role="status" className="text-sm text-gray-500">กำลังโหลดประวัติ...</p>}
      {!loading && !error && !items.length && <p className="text-sm text-gray-500">ยังไม่มีประวัติการประเมิน</p>}
      {!loading && (error || nextCursor) && (
        <Button type="button" variant="outline" size="sm" onClick={loadMore}>{error ? 'ลองโหลดประวัติอีกครั้ง' : 'โหลดประวัติเพิ่มเติม'}</Button>
      )}
    </div>
  )
}

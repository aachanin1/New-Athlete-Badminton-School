'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReviewSessionGroup } from '@/lib/admin-makeup-read-model'
import type { ReviewRoundRequestResult } from '@/lib/activity-log'

type Action = 'request_coach_review' | 'request_coach_evidence'
type Phase = 'pending' | 'unknown' | 'failed' | 'reconcile' | 'done'
interface PendingRef { requestId: string; anchor: string; action: Action; month: string; slots: string[] }
export interface ReviewRoundRequest extends PendingRef { group?: ReviewSessionGroup; phase: Phase; message: string; confirmed?: boolean }
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const unresolved = (r: ReviewRoundRequest) => ['pending', 'unknown', 'reconcile'].includes(r.phase)

export function useReviewRoundRequests(input: {
  actor: string
  onConfirmed: (anchor: string, month: string) => Promise<boolean>
  isExternallyBlocked: (ids: string[], slots: string[]) => boolean
}) {
  const registry = useRef<ReviewRoundRequest[]>([]), [requests, setRequests] = useState<ReviewRoundRequest[]>([]), inFlight = useRef(new Set<string>())
  const latest = useRef(input)
  useLayoutEffect(() => { latest.current = input }, [input])
  const storageKey = 'nasc-admin-review-round-v1:' + input.actor
  const publish = useCallback((record: ReviewRoundRequest) => {
    registry.current = [...registry.current.filter(r => r.requestId !== record.requestId), record]
    setRequests(registry.current)
  }, [])
  const persist = useCallback(() => {
    // Durable references contain no names, reasons, or attendance. The server
    // owns the receipt and verifies the logged-in actor on every readback.
    const refs = registry.current.filter(unresolved).map(({ requestId, anchor, action, month, slots }) => ({ requestId, anchor, action, month, slots }))
    if (refs.length) sessionStorage.setItem(storageKey, JSON.stringify(refs))
    else sessionStorage.removeItem(storageKey)
  }, [storageKey])
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || '[]')
      if (Array.isArray(saved)) {
        const restored: ReviewRoundRequest[] = saved.filter(r => r && uuid.test(r.requestId) && uuid.test(r.anchor)
          && ['request_coach_review', 'request_coach_evidence'].includes(r.action) && /^\d{4}-\d{2}$/.test(r.month)
          && Array.isArray(r.slots) && r.slots.length <= 10000 && r.slots.every((s: unknown) => typeof s === 'string' && uuid.test(s)))
          .map(r => ({ requestId: r.requestId, anchor: r.anchor, action: r.action, month: r.month, slots: r.slots,
            phase: 'unknown', message: 'มีคำขอเดิมที่ยังต้องตรวจสอบผลก่อนส่งอีกครั้ง' }))
        registry.current = restored; setRequests(restored)
      }
    } catch { /* Malformed local references cannot authorize a write. */ }
  }, [storageKey])
  const isBlocked = useCallback((ids: string[], slots: string[]) => registry.current.some(r => unresolved(r)
    && (ids.includes(r.anchor) || r.slots.some(s => slots.includes(s)) || r.group?.sessions.some(s => ids.includes(s.id)))), [])
  const execute = useCallback(async (record: ReviewRoundRequest, readOnly: boolean) => {
    if (inFlight.current.has(record.requestId)) return
    inFlight.current.add(record.requestId)
    let next = { ...record, phase: 'pending' as Phase, message: readOnly ? 'กำลังตรวจสอบคำขอเดิม…' : 'กำลังส่งคำขอของรอบนี้…' }
    publish(next)
    try {
      persist() // A write is not dispatched if durable preparation fails.
      if (record.confirmed) {
        const fresh = await latest.current.onConfirmed(record.anchor, record.month)
        next = { ...record, phase: fresh ? 'done' : 'reconcile', message: fresh ? record.message : 'ส่งสำเร็จแล้ว แต่ยังอ่านข้อมูลล่าสุดไม่ได้ กรุณาตรวจผลเดิม' }
      } else {
        const response = await fetch('/api/admin/makeup/review-request', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(20000), body: JSON.stringify({ requestId: record.requestId, anchor: record.anchor, action: record.action,
            group: record.group?.key || '', members: record.group?.sessions.map(s => s.id) || [record.anchor], readOnly }) })
        const result = await response.json() as ReviewRoundRequestResult & { error?: unknown; scopeChanged?: boolean }
        const errorMessage = typeof result.error === 'string' ? result.error : undefined
        const valid = response.ok && result.confirmed === true && result.requestId === record.requestId && result.anchorId === record.anchor && result.action === record.action
          && Array.isArray(result.targetSessionIds) && result.targetSessionIds.length > 0 && result.targetSessionIds.every(id => uuid.test(id))
          && result.targetCount === result.targetSessionIds.length && Number.isInteger(result.notificationCount) && result.notificationCount! > 0
          && typeof result.recordedAt === 'string' && Number.isFinite(Date.parse(result.recordedAt))
        if (valid) {
          const message = `${record.action === 'request_coach_evidence' ? 'ส่งคำขอหลักฐาน' : 'ส่งตรวจสอบ'}สำเร็จ · ${result.targetCount} คน · บันทึกผลแล้ว`
          next = { ...record, confirmed: true, phase: 'reconcile', message }; publish(next)
          const fresh = await latest.current.onConfirmed(record.anchor, record.month)
          next = { ...next, phase: fresh ? 'done' : 'reconcile', message: fresh ? message : message + ' · รออ่านข้อมูลล่าสุด' }
        } else if (readOnly && response.ok && result.confirmed === false && result.requestId === record.requestId && result.definitive === true && result.pending !== true) {
          next = { ...record, phase: 'failed', message: 'ยังไม่พบการส่งจากคำขอเดิม สามารถส่งคำขอเดิมอีกครั้งได้' }
        } else if (!readOnly && !response.ok && response.status >= 400 && response.status < 500 && result.definitive === true) {
          next = { ...record, phase: 'failed', message: errorMessage || 'ยังส่งไม่สำเร็จ กรุณาลองคำขอเดิม' }
          if (result.scopeChanged) await latest.current.onConfirmed(record.anchor, record.month)
        } else next = { ...record, phase: 'unknown', message: errorMessage || 'ยังยืนยันผลไม่ได้ กรุณาตรวจสอบคำขอเดิมก่อนส่งอีกครั้ง' }
      }
    } catch {
      next = { ...record, phase: record.confirmed ? 'reconcile' : 'unknown', message: record.confirmed ? 'ส่งสำเร็จแล้ว แต่ยังอ่านข้อมูลล่าสุดไม่ได้' : 'ยังยืนยันผลไม่ได้ กรุณาตรวจสอบคำขอเดิมก่อนส่งอีกครั้ง' }
    } finally {
      publish(next)
      try { persist() } catch { /* Keep the previous persisted reference. */ }
      inFlight.current.delete(record.requestId)
    }
  }, [publish, persist])
  const send = useCallback(async (group: ReviewSessionGroup, action: Action) => {
    const ids = group.sessions.map(s => s.id), slots = [...new Set(group.sessions.flatMap(s => s.schedule_slot_id ? [s.schedule_slot_id] : []))]
    const previous = registry.current.find(r => r.action === action && ids.includes(r.anchor) && r.phase !== 'done')
    if (previous && unresolved(previous)) { if (previous.phase !== 'pending') await execute(previous, true); return }
    if (isBlocked(ids, slots) || latest.current.isExternallyBlocked(ids, slots)) return
    const record: ReviewRoundRequest = { requestId: previous?.requestId || crypto.randomUUID(), anchor: group.sessions[0].id, group, action,
      slots, month: group.date.slice(0, 7), phase: 'pending', message: 'กำลังส่งคำขอของรอบนี้…' }
    await execute(record, false)
  }, [execute, isBlocked])
  const reconcile = useCallback((requestId: string) => {
    const record = registry.current.find(r => r.requestId === requestId)
    if (record) void execute(record, true)
  }, [execute])
  return { requests, send, reconcile, isBlocked }
}

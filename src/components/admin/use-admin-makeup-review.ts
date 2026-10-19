'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getReviewGroupKey } from '@/lib/admin-makeup-read-model'
import type { AdminReviewPage } from '@/lib/admin-makeup-review-server'
import { captureAdminReviewAnchor } from '@/lib/admin-review-scroll'

export type ReviewQueueData = AdminReviewPage & { key: string }

export function useAdminMakeupReview(input: {
  enabled: boolean; month: string; search: string; branch: string; course: string; status: string
  page: number; size: number; target?: string | null; date?: string | null
  onReconciled?: (ids: string[]) => void
}) {
  const query = new URLSearchParams({ mode: 'review', month: input.month, search: input.search, branch: input.branch,
    course: input.course, status: input.status, page: String(input.page), pageSize: String(input.size) })
  if (input.target) query.set('session', input.target)
  if (input.date) query.set('date', input.date)
  const queryText = query.toString(), key = queryText
  const [stored, setStored] = useState<ReviewQueueData | null>(null), [loading, setLoading] = useState(false), [error, setError] = useState('')
  const current = useRef({ key, month: input.month, enabled: input.enabled }), dataRef = useRef(stored)
  const pageController = useRef<AbortController | null>(null), scopeControllers = useRef(new Map<string, AbortController>())
  const revision = useRef(0), metadataRevision = useRef(0), loadingCount = useRef(0), failedScope = useRef<string | undefined>(undefined)
  const onReconciled = useRef(input.onReconciled)
  useLayoutEffect(() => {
    current.current = { key, month: input.month, enabled: input.enabled }; dataRef.current = stored
    onReconciled.current = input.onReconciled
  }, [key, input.month, input.enabled, input.onReconciled, stored])
  const publish = useCallback((data: ReviewQueueData) => {
    const restore = captureAdminReviewAnchor(); dataRef.current = data; setStored(data); restore()
  }, [])
  const read = useCallback(async function readReview(scope?: string): Promise<boolean> {
    if (!current.current.enabled) return true
    const requestKey = key
    const version = ++revision.current
    const controller = new AbortController()
    if (scope) { scopeControllers.current.get(scope)?.abort(); scopeControllers.current.set(scope, controller) }
    else { pageController.current?.abort(); pageController.current = controller }
    loadingCount.current++; setLoading(true); setError('')
    try {
      const params = new URLSearchParams(queryText); if (scope) params.set('scope', scope)
      const response = await fetch('/api/admin/makeup/queue?' + params, { cache: 'no-store', signal: controller.signal })
      const payload = await response.json() as AdminReviewPage & { error?: string }
      if (!response.ok || payload.complete !== true || !Array.isArray(payload.sessions) || !Array.isArray(payload.groups)) throw Error(payload.error || 'อ่านรายการไม่สำเร็จ')
      if (controller.signal.aborted || current.current.key !== requestKey) return true
      if (!scope) {
        // A full read started before another mutation must not overwrite that
        // mutation's newer scoped result, even if its response arrives last.
        if (version !== revision.current) return false
        publish({ ...payload, key: requestKey }); metadataRevision.current = version
      } else {
        if (!Array.isArray(payload.scopeSessionIds)) throw Error('ยังยืนยันขอบเขตรอบที่อ่านไม่ได้')
        const previous = dataRef.current
        if (!previous || previous.key !== requestKey) return true
        const affected = new Set(payload.scopeSessionIds), pageKeys = new Set(payload.groups.map(g => g.key))
        const metadata = version >= metadataRevision.current ? payload : previous
        const sessions = [...previous.sessions.filter(s => !affected.has(s.id)), ...payload.sessions.filter(s => pageKeys.has(getReviewGroupKey(s)))]
        publish({ ...metadata, key: requestKey, sessions: [...new Map(sessions.map(s => [s.id, s])).values()] })
        metadataRevision.current = Math.max(metadataRevision.current, version)
        onReconciled.current?.(payload.scopeSessionIds)
        const changedPage = previous.groups.map(g => g.key).join('\0') !== payload.groups.map(g => g.key).join('\0')
        if (changedPage) {
          // Filling a hole or a changed group boundary needs a page read, while
          // existing visible cards remain mounted throughout reconciliation.
          return await readReview()
        }
      }
      if (failedScope.current === scope) failedScope.current = undefined
      return true
    } catch (cause) {
      if (!controller.signal.aborted && current.current.key === requestKey) {
        failedScope.current = scope; setError(cause instanceof Error ? cause.message : 'อ่านรายการไม่สำเร็จ')
        return false
      }
      return true
    } finally {
      if (scope && scopeControllers.current.get(scope) === controller) scopeControllers.current.delete(scope)
      loadingCount.current = Math.max(0, loadingCount.current - 1)
      if (current.current.key === requestKey) setLoading(loadingCount.current > 0)
    }
  }, [key, queryText, publish])
  useEffect(() => {
    const controllers = scopeControllers.current
    pageController.current?.abort(); controllers.forEach(c => c.abort()); controllers.clear()
    failedScope.current = undefined
    if (!input.enabled) { setLoading(false); setError(''); return }
    const timer = window.setTimeout(() => void read(), input.search ? 200 : 0)
    return () => { window.clearTimeout(timer); pageController.current?.abort(); controllers.forEach(c => c.abort()) }
  }, [key, input.enabled, input.search, read])
  const refresh = useCallback(async (scope?: string, sourceMonth?: string) => {
    if (sourceMonth && sourceMonth !== current.current.month) return true
    return read(scope || failedScope.current)
  }, [read])
  return { key, data: stored?.key === key ? stored : null, loading, error, refresh }
}

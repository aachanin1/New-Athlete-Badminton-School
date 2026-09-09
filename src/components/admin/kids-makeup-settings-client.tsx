'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { KIDS_MAKEUP_MINIMUM_KEY, parseKidsMakeupMinimum, type KidsMakeupSettings } from '@/lib/kids-makeup-settings'

export function KidsMakeupSettingsClient({ initial, loadError }: { initial: KidsMakeupSettings | null; loadError?: string }) {
  const router = useRouter()
  const [saved, setSaved] = useState(initial)
  const [value, setValue] = useState(initial ? String(initial.minimum) : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(loadError || null)
  const [success, setSuccess] = useState(false)
  const inFlight = useRef(false)
  const retry = useRef<{ fingerprint: string; requestId: string } | null>(null)

  async function save() {
    if (inFlight.current || !saved) return
    setSuccess(false)
    const minimum = parseKidsMakeupMinimum(value)
    if (minimum === null) { setError('กรุณากรอกจำนวนเต็มตั้งแต่ 1 ขึ้นไป'); return }
    const fingerprint = `${saved.revision}:${minimum}`
    if (retry.current?.fingerprint !== fingerprint) retry.current = { fingerprint, requestId: crypto.randomUUID() }
    inFlight.current = true
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: saved.id, key: KIDS_MAKEUP_MINIMUM_KEY, minimum,
          expectedRevision: saved.revision, requestId: retry.current.requestId }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || 'บันทึกไม่สำเร็จ กรุณาโหลดข้อมูลใหม่')
      const data = result.data as KidsMakeupSettings
      if (data.minimum !== minimum || !Number.isSafeInteger(data.revision) || data.revision !== saved.revision + 1) {
        throw new Error('ยังยืนยันผลการบันทึกไม่ได้ กรุณาโหลดข้อมูลใหม่')
      }
      setSaved(data)
      setValue(String(data.minimum))
      retry.current = null
      setSuccess(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ยังยืนยันผลการบันทึกไม่ได้ กรุณาลองใหม่')
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }

  return <Card><CardContent className="space-y-4 p-6">
    <h1 className="text-xl font-bold text-[#153c85]">ตั้งค่าสิทธิ์ชดเชยคอร์สเด็ก</h1>
    <p className="text-sm text-gray-600">Super Admin เท่านั้นที่แก้ไขได้ ค่าที่บันทึกใช้กับรายการชดเชยใหม่ รายการที่จัดสำเร็จแล้วคงเดิม</p>
    <div className="max-w-lg space-y-2">
      <Label htmlFor="kids-makeup-minimum">จำนวนเรียนขั้นต่ำในเดือนถัดไปเพื่อใช้สิทธิ์ชดเชย</Label>
      <Input id="kids-makeup-minimum" inputMode="numeric" value={value} disabled={loading || !saved}
        onChange={(event) => { setValue(event.target.value); setSuccess(false); setError(null) }} />
      <p className="text-sm text-gray-500">นับสิทธิ์ซื้อที่ยืนยันชำระแล้วรวมพี่น้อง ไม่หักยอดนี้เมื่อใช้ชดเชย และยังต้องมีโควตากับรายการต้นทางที่เข้าเงื่อนไข</p>
    </div>
    {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
    {success ? <p role="status" className="text-sm text-emerald-700">บันทึกสำเร็จ</p> : null}
    <div className="flex gap-3">
      <Button onClick={save} disabled={loading || !saved}>{loading ? 'กำลังบันทึก...' : 'บันทึกขั้นต่ำ'}</Button>
      <Button variant="outline" disabled={loading} onClick={() => router.refresh()}>โหลดข้อมูลใหม่</Button>
    </div>
  </CardContent></Card>
}

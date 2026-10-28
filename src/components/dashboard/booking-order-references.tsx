'use client'
import { useState } from 'react'
import { Copy } from 'lucide-react'
import { bookingReference } from '@/lib/booking-reference'

export function BookingOrderReferences({ ids, visibleIds = ids }: { ids: string[]; visibleIds?: string[] }) {
  const [message, setMessage] = useState(''), [manual, setManual] = useState('')
  const copy = async (id: string) => {
    try { await navigator.clipboard.writeText(id); setManual(''); setMessage('คัดลอกรหัสเต็มแล้ว') }
    catch { setManual(id); setMessage('เลือกรหัสด้านล่างเพื่อคัดลอก') }
  }
  const reference = (id: string) => <button key={id} type="button" onClick={() => void copy(id)} aria-label={'คัดลอกรหัสเต็มของ ' + bookingReference(id, visibleIds)} className="inline-flex min-h-9 max-w-full items-center gap-2 rounded-md border bg-gray-50 px-2 py-1 text-left text-sm text-[#153c85] hover:bg-blue-50"><span className="break-all font-mono">{bookingReference(id, visibleIds)}</span><Copy className="h-3.5 w-3.5 shrink-0" /></button>
  return <div data-testid="booking-order-references" className="min-w-0 space-y-2">
    <p className="text-xs text-gray-500">Order ID{ids.length > 1 ? ` · ชำระรวม ${ids.length} รายการ` : ''}</p>
    <div className="flex flex-wrap gap-2">{ids.slice(0, 3).map(reference)}</div>
    {ids.length > 3 && <details><summary className="cursor-pointer text-sm font-semibold text-blue-700">ดูอีก {ids.length - 3} รหัสรายการ</summary><div className="mt-2 flex flex-wrap gap-2">{ids.slice(3).map(reference)}</div></details>}
    {message && <p role="status" className="text-xs text-blue-700">{message}</p>}
    {manual && <input aria-label="รหัสเต็มสำหรับคัดลอก" className="w-full rounded border p-2 text-xs" readOnly value={manual} onFocus={e => e.currentTarget.select()} />}
  </div>
}

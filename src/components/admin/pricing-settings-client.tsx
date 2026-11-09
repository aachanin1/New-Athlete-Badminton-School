'use client'

import { useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Save, ShieldCheck, Tags } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CourseCategory } from '@/lib/pricing'
import type { AdminPricingSnapshot, AdminPricingTier } from '@/lib/admin-pricing-settings'
import { validateKidsTierSet, type KidsRateCatalog } from '@/lib/booking-pricing-policy'
import { checkoutRequest, type BookingPackage } from '@/lib/booking-checkout'
import { adminOptionTotal, adminPurchaseOptions } from '@/lib/admin-purchase-options'

interface PricingSettingsClientProps {
  initialPricing: AdminPricingSnapshot | null
  pricingLoadError?: string
  kidsCatalogs?: { early: KidsRateCatalog | null; late: KidsRateCatalog; active: boolean } | null
  kidsCatalogError?: string
  pricingPackages: BookingPackage[] | null
}

const COURSE_LABELS: Record<CourseCategory, string> = {
  kids_group: 'เด็ก (กลุ่ม)',
  adult_group: 'ผู้ใหญ่ (กลุ่ม)',
  private: 'Private',
}

const COURSE_DESCRIPTIONS: Record<CourseCategory, string> = {
  kids_group: 'บิลใหม่คิดเรทจากจำนวนครั้งในบิลเดียว รวมพี่น้องในบิลนั้น และเริ่มนับใหม่เมื่อสร้างบิลใหม่',
  adult_group: 'เลือกเรียนรายครั้งหลายรอบในบิลเดียว หรือเลือกซื้อคอร์สตามจำนวนครั้ง',
  private: 'เลือกเรียนรายชั่วโมงหลายชั่วโมงในบิลเดียว หรือเลือกซื้อคอร์สตามจำนวนชั่วโมง',
}

const COURSE_ORDER = ['adult_group', 'private'] as const

function formatMoney(value: number) {
  return `฿${Number(value || 0).toLocaleString('th-TH')}`
}

function calculateAutoPackagePrice(tier: Pick<AdminPricingTier, 'min_sessions' | 'price_per_session'>) {
  return Math.round(Number(tier.min_sessions || 0) * Number(tier.price_per_session || 0))
}

function KidsCatalogEditor({ catalog, onSaved }: { catalog: KidsRateCatalog; onSaved: (catalog: KidsRateCatalog) => void }) {
  const [rows, setRows] = useState(catalog.tiers)
  const [saved, setSaved] = useState(catalog)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  async function save() {
    if (loading) return
    setSuccess(false)
    setError(null)
    try {
      const tiers = validateKidsTierSet(rows)
      setLoading(true)
      const response = await fetch('/api/admin/pricing', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regime: saved.regime, expectedRevision: saved.revision, tiers }) })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || 'บันทึกราคาไม่สำเร็จ กรุณาโหลดข้อมูลใหม่')
      const updated = result.data as KidsRateCatalog
      if (updated.regime !== saved.regime || updated.revision !== saved.revision + 1) throw new Error('ยังยืนยันผลการบันทึกไม่ได้ กรุณาโหลดข้อมูลใหม่')
      setSaved(updated)
      setRows(updated.tiers)
      onSaved(updated)
      setSuccess(true)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'บันทึกไม่สำเร็จ') }
    finally { setLoading(false) }
  }
  return <Card><CardContent className="space-y-4 p-4">
    <h2 className="font-semibold text-[#153c85]">เด็ก — {catalog.regime === 'early' ? 'ราคาปกติ' : 'ราคาครึ่งเดือน'}</h2>
    <p className="text-sm text-gray-500">บิลใหม่เริ่มนับเรทจากจำนวนครั้งในบิลนั้น รวมพี่น้องเฉพาะบิลเดียวกัน ราคาครึ่งเดือนใช้เมื่อจองวันที่ 16–สิ้นเดือนเพื่อเรียนในเดือนและปีเดียวกัน กรณีอื่นใช้ราคาปกติ ระบบเลือกชุดราคาจากกฎที่เปิดใช้บนเซิร์ฟเวอร์ บันทึกแยกชุด บิลเดิมยังใช้ชุดราคาที่เก็บไว้เมื่อจอง</p>
    {rows.map((row, index) => <div key={index} className="grid grid-cols-3 gap-3">
      {(['minSessions', 'maxSessions', 'ratePerSession'] as const).map((field) => <Label key={field} className="space-y-2">
        <span>{field === 'minSessions' ? 'เริ่มที่' : field === 'maxSessions' ? 'ถึง (ว่าง = ไม่จำกัด)' : 'ราคา/ครั้ง'}</span>
        <Input type="number" disabled={loading} value={row[field] ?? ''} onChange={(event) => {
          setError(null); setSuccess(false)
          const value = event.target.value
          setRows((current) => current.map((item, i) => i === index ? { ...item, [field]: field === 'maxSessions' && value === '' ? null : Number(value) } : item))
        }} />
      </Label>)}
    </div>)}
    {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
    {success ? <p role="status" className="text-sm text-emerald-700">บันทึกสำเร็จ</p> : null}
    <Button disabled={loading} onClick={save}>{loading ? 'กำลังบันทึก...' : `บันทึก${catalog.regime === 'early' ? 'ราคาปกติ' : 'ราคาครึ่งเดือน'}`}</Button>
  </CardContent></Card>
}

export function PricingSettingsClient({ initialPricing, pricingLoadError, kidsCatalogs, kidsCatalogError, pricingPackages }: PricingSettingsClientProps) {
  const [packages, setPackages] = useState(pricingPackages)
  const [savedPricing, setSavedPricing] = useState(initialPricing)
  const [rows, setRows] = useState<AdminPricingTier[]>(initialPricing?.tiers || [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(pricingLoadError || null)
  const [needsReload, setNeedsReload] = useState(!initialPricing)
  const inFlight = useRef(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [catalogUpdates, setCatalogUpdates] = useState<Partial<Record<KidsRateCatalog['regime'], KidsRateCatalog>>>({})
  const options = useMemo(() => {
    try {
      if (!packages?.length) throw Error('อ่านรูปแบบการซื้อไม่สำเร็จ กรุณาโหลดราคาล่าสุด')
      return { rows: adminPurchaseOptions(rows, packages), error: null }
    } catch (cause) { return { rows: [], error: cause instanceof Error ? cause.message : 'อ่านรูปแบบการซื้อไม่สำเร็จ' } }
  }, [rows, packages])

  const stats = useMemo(() => {
    const kidsTiers = kidsCatalogs ? [kidsCatalogs.early, kidsCatalogs.late].flatMap((saved) => {
      if (!saved) return []
      const updated = catalogUpdates[saved.regime]
      return (updated && updated.revision > saved.revision ? updated : saved).tiers
    }) : null
    return {
      total: savedPricing ? rows.length + (kidsTiers?.length || 0) : null,
      kidsLowest: kidsTiers?.length ? Math.min(...kidsTiers.map((tier) => tier.ratePerSession)) : null,
      adultBase: rows.find(row => row.course_type_name === 'adult_group' && row.min_sessions === 1)?.price_per_session,
      privateBase: rows.find(row => row.course_type_name === 'private' && row.min_sessions === 1)?.price_per_session,
    }
  }, [savedPricing, rows, kidsCatalogs, catalogUpdates])

  const onKidsCatalogSaved = (saved: KidsRateCatalog) => {
    setCatalogUpdates((current) => ({ ...current, [saved.regime]: saved }))
  }

  const updateRow = (id: string, field: keyof Pick<AdminPricingTier, 'min_sessions' | 'max_sessions' | 'price_per_session'>, value: string) => {
    setError(null)
    setSuccess(null)
    setRows((current) => current.map((row) => {
      if (row.id !== id) return row
      const numeric = value === '' ? null : Number(value)
      const nextRow = field === 'max_sessions'
        ? { ...row, max_sessions: numeric }
        : { ...row, [field]: Number(value || 0) }
      return { ...nextRow, package_price: calculateAutoPackagePrice(nextRow) }
    }))
  }

  const savePricing = async () => {
    if (inFlight.current || needsReload || !savedPricing || options.error) return
    inFlight.current = true
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/admin/pricing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          expected: savedPricing,
          tiers: rows.map((row) => ({
            id: row.id,
            min_sessions: row.min_sessions,
            max_sessions: row.max_sessions,
            price_per_session: row.price_per_session,
          })),
        }),
      })

      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.success || !result.data?.tiers) {
        if (response.status !== 400) setNeedsReload(true)
        setError(result?.error || 'บันทึกราคาไม่สำเร็จ')
        return
      }

      setSavedPricing({ asOfDate: result.data.asOfDate, tiers: result.data.tiers })
      setRows(result.data.tiers)
      setSuccess(result.data.changed ? 'บันทึกราคาเรียบร้อยแล้ว' : 'ข้อมูลราคายังเหมือนเดิม')
    } catch {
      setNeedsReload(true)
      setError('ยังยืนยันผลการบันทึกไม่ได้ กรุณาโหลดราคาล่าสุดก่อนทำต่อ')
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }

  const reloadPricing = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setLoading(true); setSuccess(null)
    try {
      const [response, catalog] = await Promise.all([
        fetch('/api/admin/pricing', { cache: 'no-store', signal: AbortSignal.timeout(15000) }),
        checkoutRequest<{ packages: BookingPackage[] }>('/api/booking-checkout?catalog=1'),
      ])
      const result = await response.json()
      if (!response.ok || !result.data?.tiers) throw new Error(result.error || 'อ่านราคาปัจจุบันไม่สำเร็จ')
      setSavedPricing(result.data); setRows(result.data.tiers); setNeedsReload(false); setError(null)
      setPackages(catalog.packages)
    } catch {
      setNeedsReload(true); setError('อ่านราคาปัจจุบันไม่สำเร็จ กรุณาโหลดราคาล่าสุดก่อนแก้ไข')
    } finally { inFlight.current = false; setLoading(false) }
  }

  const moneyOrMissing = (value: number | null | undefined) => value == null ? '—' : formatMoney(value)
  const formatDate = (value: string) => new Date(value + 'T00:00:00Z').toLocaleDateString('th-TH', { timeZone: 'UTC' })
  const editorDisabled = loading || needsReload || !savedPricing || Boolean(options.error)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-[#2748bf]">
            <Tags className="h-4 w-4" />
            Pricing Settings
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#153c85]">ตั้งค่าราคาค่าเรียน</h1>
          <p className="mt-1 text-sm text-gray-500">
            ตั้งราคารายครั้ง/รายชั่วโมงและคอร์สตามรูปแบบการซื้อ ระบบแสดงราคารวมให้ตรวจสอบก่อนบันทึก
          </p>
        </div>
        <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
          <ShieldCheck className="mr-1 h-3.5 w-3.5" />
          Super Admin เท่านั้น
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">รายการราคาทั้งหมด</p><p className="mt-1 text-2xl font-bold text-[#153c85]">{stats.total ?? '—'}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">เด็ก ต่ำสุด/ครั้ง</p><p className="mt-1 text-2xl font-bold text-emerald-600">{moneyOrMissing(stats.kidsLowest)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">ผู้ใหญ่ รายครั้ง</p><p className="mt-1 text-2xl font-bold text-orange-600">{moneyOrMissing(stats.adultBase)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Private รายชั่วโมง</p><p className="mt-1 text-2xl font-bold text-[#2748bf]">{moneyOrMissing(stats.privateBase)}</p></CardContent></Card>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      <div className="space-y-4">
        <div className="rounded-lg border bg-blue-50 p-4 text-sm text-blue-900">
          <p>แสดงเฉพาะเรทที่มีผลปัจจุบัน ราคาเก่ายังคงเก็บไว้เป็นประวัติ</p>
          <p>วันมีผลเปลี่ยนเวลา 07:00 น. (ไทย){savedPricing ? ` · ข้อมูลวันที่ ${formatDate(savedPricing.asOfDate)}` : ''}</p>
          <Button className="mt-2" variant="outline" disabled={loading} onClick={reloadPricing}>โหลดราคาล่าสุด</Button>
          {needsReload ? <p className="mt-2">ค่าที่กำลังแก้ยังอยู่ การโหลดใหม่จะแทนค่าด้วยข้อมูลล่าสุดก่อนบันทึก</p> : null}
        </div>
        {kidsCatalogError ? <p role="alert" className="text-red-600">{kidsCatalogError}</p> : null}
        {kidsCatalogs ? <>
          {!kidsCatalogs.active ? <p className="text-sm text-amber-700">ชุดราคาสองช่วงยังไม่เปิดใช้กับการจอง</p> : null}
          {kidsCatalogs.early ? <KidsCatalogEditor key={kidsCatalogs.early.versionId} catalog={kidsCatalogs.early} onSaved={onKidsCatalogSaved} /> : <p role="alert">ยังไม่มีหลักฐานชุดราคาช่วงวันที่ 1–15 กรุณาตรวจสอบข้อมูลราคา</p>}
          <KidsCatalogEditor key={kidsCatalogs.late.versionId} catalog={kidsCatalogs.late} onSaved={onKidsCatalogSaved} />
        </> : null}
        {options.error ? <p role="alert" className="text-red-600">{options.error}</p> : null}
        <p className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">รายครั้ง/รายชั่วโมงเลือกหลายรอบแล้วชำระบิลเดียว ใช้ได้ภายในเดือนเรียนเดิม เมื่อใกล้จำนวนคอร์ส ระบบจะแนะนำให้เปรียบเทียบ ผู้ใช้ต้องเลือกเปลี่ยนเป็นคอร์สเอง</p>
        {savedPricing ? COURSE_ORDER.map((courseType) => {
          const courseOptions = options.rows.filter(({ pack }) => pack.course === courseType).sort((a, b) => a.pack.quantity - b.pack.quantity)

          return (
            <Card key={courseType} data-testid={'pricing-course-' + courseType} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col gap-1 border-b bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-[#153c85]">{COURSE_LABELS[courseType]}</h2>
                    <p className="text-xs text-gray-500">{COURSE_DESCRIPTIONS[courseType]}</p>
                  </div>
                  <Badge variant="outline" className="w-fit bg-white">{courseOptions.length} รูปแบบ</Badge>
                </div>
                <div className="divide-y">
                  {courseOptions.map(({ pack, tier: row }) => {
                    const single = pack.quantity === 1
                    const unit = courseType === 'private' ? 'ชั่วโมง' : 'ครั้ง'
                    const total = adminOptionTotal(row, pack.quantity)
                    const legacyRate = !single && row.min_sessions > 1 && row.min_sessions !== pack.quantity
                    return <div key={pack.id} data-testid={'pricing-tier-' + row.id} data-purchase-option={pack.id} className="grid gap-4 px-4 py-4 sm:grid-cols-2 xl:grid-cols-[minmax(150px,1fr)_minmax(150px,1fr)_minmax(140px,1fr)_minmax(220px,1.4fr)] xl:items-start">
                      <div className="space-y-1.5">
                        <Label className="block min-h-4 text-xs text-gray-500">รูปแบบการซื้อ</Label>
                        <div className="flex h-10 items-center rounded-md border bg-gray-50 px-3 text-sm font-semibold text-[#153c85]">
                          {single ? courseType === 'private' ? 'รายชั่วโมง' : 'รายครั้ง' : `คอร์ส ${pack.quantity} ${unit}`}
                        </div>
                        <p className="text-xs text-gray-500">มีผล {formatDate(row.valid_from)} ถึง {row.valid_to ? formatDate(row.valid_to) : 'ไม่กำหนดวันสิ้นสุด'}</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="block min-h-4 text-xs">{single ? 'จำนวนที่ซื้อ' : 'จำนวนสิทธิ์ในคอร์ส'}</Label>
                        <div className="flex min-h-10 items-center rounded-md border bg-gray-50 px-3 py-2 text-sm" data-testid={'pricing-quantity-' + pack.id}>{single ? `เลือกได้หลาย${unit}ในบิลเดียว` : `${pack.quantity} ${unit}`}</div>
                        <p className="text-xs text-gray-500">{single ? 'ใช้ได้ภายในเดือนเรียนเดิม' : 'จำนวนตามคอร์สที่เปิดขาย'}</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={'option-price-' + pack.id} className="block min-h-4 text-xs">{legacyRate ? 'อัตราของชุดราคาเดิม' : `ราคา/${unit}`}</Label>
                        <Input
                          id={'option-price-' + pack.id}
                          type="number"
                          min={0}
                          step="0.01"
                          disabled={editorDisabled}
                          aria-label={`${courseType} ${row.id} ราคา`}
                          value={row.price_per_session}
                          onChange={(event) => updateRow(row.id, 'price_per_session', event.target.value)}
                        />
                        {legacyRate ? <p className="text-xs text-gray-500">เฉลี่ย {formatMoney(total / pack.quantity)}/{unit} · ใช้เงื่อนไขชุดราคาเดิม</p> : null}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="block min-h-4 text-xs">{single ? courseType === 'private' ? 'การคิดราคารายชั่วโมง' : 'การคิดราคารายครั้ง' : 'ราคารวมคอร์ส'}</Label>
                        <div className="flex min-h-10 items-center rounded-md border bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700" data-testid={'pricing-total-' + pack.id}>
                          {single ? `จำนวนที่เลือก × ${formatMoney(row.price_per_session)}/${unit}` : formatMoney(total)}
                        </div>
                        <p className="text-xs text-gray-500">{single ? `เช่น 3 ${unit} = ${formatMoney(adminOptionTotal(row, 3))}` : 'คำนวณจากราคาที่ตั้งไว้'}</p>
                      </div>
                    </div>
                  })}
                </div>
              </CardContent>
            </Card>
          )
        }) : null}
      </div>

      <div className="sticky bottom-0 z-10 -mx-2 border-t bg-white/95 px-2 py-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <Button className="w-full bg-[#2748bf] hover:bg-[#153c85] sm:w-auto" onClick={savePricing} disabled={editorDisabled}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          บันทึกราคาค่าเรียน
        </Button>
      </div>
    </div>
  )
}

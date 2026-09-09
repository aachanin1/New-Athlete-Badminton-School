'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Loader2, Save, ShieldCheck, Tags } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { buildPricingCatalog, type CourseCategory, type PricingTierInput } from '@/lib/pricing'
import { validateKidsTierSet, type KidsRateCatalog } from '@/lib/booking-pricing-policy'

interface PricingTierData {
  id: string
  course_type_id: string
  course_type_name: CourseCategory
  min_sessions: number
  max_sessions: number | null
  price_per_session: number
  package_price: number
  valid_from: string
  valid_to: string | null
  created_at: string | null
}

interface PricingSettingsClientProps {
  tiers: PricingTierData[]
  kidsCatalogs?: { early: KidsRateCatalog | null; late: KidsRateCatalog; active: boolean } | null
  kidsCatalogError?: string
}

const COURSE_LABELS: Record<CourseCategory, string> = {
  kids_group: 'เด็ก (กลุ่ม)',
  adult_group: 'ผู้ใหญ่ (กลุ่ม)',
  private: 'Private',
}

const COURSE_DESCRIPTIONS: Record<CourseCategory, string> = {
  kids_group: 'คิดเป็นรายเดือนและรวมจำนวนครั้งของพี่น้องในผู้ปกครองเดียวกัน',
  adult_group: 'รายครั้งหรือเรทช่วงของคลาสผู้ใหญ่กลุ่ม',
  private: 'รายชั่วโมงหรือเรทช่วงของคลาส Private',
}

const COURSE_ORDER: CourseCategory[] = ['kids_group', 'adult_group', 'private']

function formatMoney(value: number) {
  return `฿${Number(value || 0).toLocaleString('th-TH')}`
}

function tierLabel(tier: PricingTierData) {
  const unit = tier.course_type_name === 'private' ? 'ชม.' : 'ครั้ง'
  if (tier.max_sessions === null) return `${tier.min_sessions}+ ${unit}`
  if (tier.min_sessions === tier.max_sessions) return `${tier.min_sessions} ${unit}`
  return `${tier.min_sessions}-${tier.max_sessions} ${unit}`
}

function calculateAutoPackagePrice(tier: Pick<PricingTierData, 'min_sessions' | 'price_per_session'>) {
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
    <h2 className="font-semibold text-[#153c85]">เด็ก — {catalog.regime === 'early' ? 'จองวันที่ 1–15' : 'จองวันที่ 16–สิ้นเดือน'}</h2>
    <p className="text-sm text-gray-500">บันทึกแยกชุด บิลเดิมยังใช้ชุดราคาที่เก็บไว้เมื่อจอง</p>
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
    <Button disabled={loading} onClick={save}>{loading ? 'กำลังบันทึก...' : `บันทึกราคาช่วง${catalog.regime === 'early' ? 'วันที่ 1–15' : 'วันที่ 16–สิ้นเดือน'}`}</Button>
  </CardContent></Card>
}

export function PricingSettingsClient({ tiers, kidsCatalogs, kidsCatalogError }: PricingSettingsClientProps) {
  const router = useRouter()
  const [rows, setRows] = useState<PricingTierData[]>(tiers)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [catalogUpdates, setCatalogUpdates] = useState<Partial<Record<KidsRateCatalog['regime'], KidsRateCatalog>>>({})

  const catalog = useMemo(() => buildPricingCatalog(rows as PricingTierInput[]), [rows])

  const stats = useMemo(() => {
    const kidsTiers = kidsCatalogs ? [kidsCatalogs.early, kidsCatalogs.late].flatMap((saved) => {
      if (!saved) return []
      const updated = catalogUpdates[saved.regime]
      return (updated && updated.revision > saved.revision ? updated : saved).tiers
    }) : null
    return {
      total: kidsTiers ? rows.filter((row) => row.course_type_name !== 'kids_group').length + kidsTiers.length : rows.length,
      kidsLowest: Math.min(...(kidsTiers ? kidsTiers.map((tier) => tier.ratePerSession) : catalog.kids_group.map((tier) => tier.price_per_session))),
      adultBase: catalog.adult_group[0]?.price_per_session || 0,
      privateBase: catalog.private[0]?.price_per_session || 0,
    }
  }, [catalog, rows, kidsCatalogs, catalogUpdates])

  const onKidsCatalogSaved = (saved: KidsRateCatalog) => {
    setCatalogUpdates((current) => ({ ...current, [saved.regime]: saved }))
  }

  const updateRow = (id: string, field: keyof Pick<PricingTierData, 'min_sessions' | 'max_sessions' | 'price_per_session'>, value: string) => {
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
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/admin/pricing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tiers: rows.filter((row) => !kidsCatalogs || row.course_type_name !== 'kids_group').map((row) => ({
            id: row.id,
            min_sessions: row.min_sessions,
            max_sessions: row.max_sessions,
            price_per_session: row.price_per_session,
          })),
        }),
      })

      const result = await response.json().catch(() => null)
      if (!response.ok) {
        setError(result?.error || 'บันทึกราคาไม่สำเร็จ')
        return
      }

      setSuccess('บันทึกราคาเรียบร้อยแล้ว')
      router.refresh()
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
            <Tags className="h-4 w-4" />
            Pricing Settings
          </p>
          <h1 className="mt-1 text-2xl font-bold text-[#153c85]">ตั้งค่าราคาค่าเรียน</h1>
          <p className="mt-1 text-sm text-gray-500">
            แก้เฉพาะเรทต่อครั้ง/ชม. ที่ใช้คำนวณจริง ส่วนค่า DB auto ระบบคำนวณให้เพื่อรองรับ schema เดิม
          </p>
        </div>
        <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
          <ShieldCheck className="mr-1 h-3.5 w-3.5" />
          Super Admin เท่านั้น
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">เรทรวม</p><p className="mt-1 text-2xl font-bold text-[#153c85]">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">เด็ก ต่ำสุด/ครั้ง</p><p className="mt-1 text-2xl font-bold text-emerald-600">{formatMoney(stats.kidsLowest)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">ผู้ใหญ่ รายครั้ง</p><p className="mt-1 text-2xl font-bold text-orange-600">{formatMoney(stats.adultBase)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Private รายชม.</p><p className="mt-1 text-2xl font-bold text-[#2748bf]">{formatMoney(stats.privateBase)}</p></CardContent></Card>
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
        {kidsCatalogError ? <p role="alert" className="text-red-600">{kidsCatalogError}</p> : null}
        {kidsCatalogs ? <>
          {!kidsCatalogs.active ? <p className="text-sm text-amber-700">ชุดราคาสองช่วงยังไม่เปิดใช้กับการจอง</p> : null}
          {kidsCatalogs.early ? <KidsCatalogEditor key={kidsCatalogs.early.versionId} catalog={kidsCatalogs.early} onSaved={onKidsCatalogSaved} /> : <p role="alert">ยังไม่มีหลักฐานชุดราคาช่วงวันที่ 1–15 กรุณาตรวจสอบข้อมูลราคา</p>}
          <KidsCatalogEditor key={kidsCatalogs.late.versionId} catalog={kidsCatalogs.late} onSaved={onKidsCatalogSaved} />
        </> : null}
        {COURSE_ORDER.filter((courseType) => !kidsCatalogs || courseType !== 'kids_group').map((courseType) => {
          const courseRows = rows
            .filter((row) => row.course_type_name === courseType)
            .sort((a, b) => a.min_sessions - b.min_sessions)

          return (
            <Card key={courseType} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col gap-1 border-b bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-[#153c85]">{COURSE_LABELS[courseType]}</h2>
                    <p className="text-xs text-gray-500">{COURSE_DESCRIPTIONS[courseType]}</p>
                  </div>
                  <Badge variant="outline" className="w-fit bg-white">{courseRows.length} เรท</Badge>
                </div>
                <div className="divide-y">
                  {courseRows.map((row) => (
                    <div key={row.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[160px_repeat(4,minmax(130px,1fr))] lg:items-start">
                      <div className="space-y-1.5">
                        <Label className="block min-h-4 text-xs text-gray-500">ช่วงราคา</Label>
                        <div className="flex h-10 items-center rounded-md border bg-gray-50 px-3 text-sm font-semibold text-[#153c85]">
                          {tierLabel(row)}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="block min-h-4 text-xs">เริ่มที่</Label>
                        <Input
                          type="number"
                          min={1}
                          value={row.min_sessions}
                          onChange={(event) => updateRow(row.id, 'min_sessions', event.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="block min-h-4 text-xs">ถึง (ว่าง = ไม่จำกัด)</Label>
                        <Input
                          type="number"
                          min={row.min_sessions}
                          value={row.max_sessions ?? ''}
                          onChange={(event) => updateRow(row.id, 'max_sessions', event.target.value)}
                          placeholder="ไม่จำกัด"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="block min-h-4 text-xs">{courseType === 'private' ? 'ราคา/ชม.' : 'ราคา/ครั้ง'}</Label>
                        <Input
                          type="number"
                          min={0}
                          value={row.price_per_session}
                          onChange={(event) => updateRow(row.id, 'price_per_session', event.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="block min-h-4 text-xs">ค่า DB Auto</Label>
                        <div className="flex h-10 items-center rounded-md border bg-gray-50 px-3 text-sm font-semibold text-gray-700">
                          {formatMoney(calculateAutoPackagePrice(row))}
                        </div>
                        <p className="mt-1 text-[11px] text-gray-400">คำนวณอัตโนมัติ ห้ามแก้เอง</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="sticky bottom-0 z-10 -mx-2 border-t bg-white/95 px-2 py-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <Button className="w-full bg-[#2748bf] hover:bg-[#153c85] sm:w-auto" onClick={savePricing} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          บันทึกราคาค่าเรียน
        </Button>
      </div>
    </div>
  )
}

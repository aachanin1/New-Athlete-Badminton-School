import { familyMakeupReason, type KidsFamilyMakeupState } from '@/lib/kids-family-makeup'
import { formatThaiDateTimeWithWeekday } from '@/lib/date-format'

export function KidsStoreEligibility({ family, childId, sourceId, stored, confirmCredit = false, now }: { family: KidsFamilyMakeupState | null; childId: string | null; sourceId: string; stored: boolean; confirmCredit?: boolean; now: Date }) {
  const source = family?.sources.find(item => item.sourceSessionId === sourceId)
  const valid = family && family.sourceMonth && family.active && Date.parse(family.expiresAt) > now.getTime()
    && (family.remaining > 0 || !stored && confirmCredit || stored && source?.approval?.status === 'approved') && family.children.some(child => child.id === childId)
    && (!stored || family.eligible && Boolean(source))
  const blocked = family?.reason === 'paused' || family?.reason === 'expired' ? familyMakeupReason(family) : null
  const fallback = valid && family?.creditApprovalsEnabled && (!stored && confirmCredit || source?.approval?.status === 'approved')
  return <div className="text-sm" data-store-makeup-eligible={valid ? 'true' : 'false'}>
    {family?.sourceMonth ? <>
      {valid ? <p>{family.remaining > 0 ? `ใช้โควตาปกติก่อน (เหลือ ${family.remaining} รอบ)` : 'โควตาปกติเต็มแล้ว'}{fallback ? family.remaining > 0 ? ' · หากเต็ม แอดมินใช้เครดิตนี้ได้ 1 ครั้งตามอายุเดิม' : ' · แอดมินใช้เครดิตนี้ได้ 1 ครั้งตามอายุเดิม' : ' · ใช้ได้ตามต้นทางที่เข้าเกณฑ์ในเดือนถัดไป'}</p> : <p className="text-amber-800">{blocked || (family.remaining === 0 ? 'โควตาปกติเต็มแล้ว · เครดิตนี้ไม่สามารถใช้เกินโควตาได้' : 'ต้นทางนี้ยังไม่พร้อมใช้ชดเชยเดือนถัดไป กรุณาตรวจสิทธิ์ล่าสุด')}</p>}
      {stored ? <p>แอดมินจัดชดเชยได้ถึง {formatThaiDateTimeWithWeekday(new Date(Date.parse(family.expiresAt) - 1))} โดยไม่ต้องซื้อเดือนถัดไป และไม่ต่ออายุกระเป๋าปกติ</p> : null}
    </> : <p>ยังไม่มีข้อมูลสิทธิ์ชดเชยข้ามเดือนที่ยืนยันได้</p>}
  </div>
}

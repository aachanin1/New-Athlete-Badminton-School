import type { KidsRateTier } from '@/lib/booking-pricing-policy'
import type { BookingPackage } from '@/lib/booking-checkout'

export function PublicPricingRows({ course, kids, packages }: { course: 'kids_group' | 'adult_group' | 'private'; kids?: KidsRateTier[]; packages?: BookingPackage[] }) {
  if (!kids || !packages) return <p className="text-sm text-gray-600">ตรวจราคาล่าสุดในหน้าจองก่อนยืนยันรายการ</p>
  if (course === 'kids_group') return <div className="space-y-3" data-testid="public-kids-prices">
    <p className="text-xs text-gray-600">เรทปกติ · คิดจากจำนวนครั้งในบิลเดียว รวมพี่น้องในบิลนั้น เริ่มเรทใหม่ทุกบิล</p>
    {kids.map(t => <div key={t.minSessions} className="flex justify-between gap-3 text-sm"><span className="text-gray-600">{t.minSessions === t.maxSessions ? t.minSessions : t.maxSessions === null ? t.minSessions + '+' : t.minSessions + '–' + t.maxSessions} ครั้งในบิล</span><span className="font-bold">{t.ratePerSession.toLocaleString()} บาท/ครั้ง</span></div>)}
    <p className="text-xs text-gray-600">เรทกลางเดือนใช้เมื่อสร้างบิลตั้งแต่วันที่ 16 เพื่อเรียนเดือนเดียวกัน ตรวจชุดราคาที่ใช้จริงและยอดสุทธิได้ในหน้าจอง</p>
  </div>
  return <div className="space-y-3" data-testid={'public-' + course + '-prices'}>
    {packages.filter(p => p.course === course).map(p => <div key={p.id} className="flex justify-between gap-3 text-sm"><span className="text-gray-600">{p.quantity === 1 ? course === 'private' ? 'รายชั่วโมง' : 'รายครั้ง' : p.quantity + (course === 'private' ? ' ชั่วโมง' : ' ครั้ง')}</span><span className="font-bold">{p.price.toLocaleString()} บาท</span></div>)}
    <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">รายครั้งเลือกหลายรอบและชำระบิลเดียว ใช้ได้ภายในเดือนเรียนเดิม · ตรวจอายุคอร์สและยอดหลังคูปองในหน้าจอง</p>
  </div>
}

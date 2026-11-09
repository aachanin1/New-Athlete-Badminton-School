import { Button } from '@/components/ui/button'
import { packageValidityDescription } from '@/lib/booking-package-validity'
import type { BookingPackage } from '@/lib/booking-checkout'

export function BookingPackageRecommendation({ pack, selectedQuantity, singleRate, reference, onSelect }: {
  pack: BookingPackage; selectedQuantity: number; singleRate: number; reference: string; onSelect: () => void
}) {
  const unit = pack.course === 'private' ? 'ชั่วโมง' : 'ครั้ง'
  const singleTotal = Math.round((selectedQuantity * singleRate + Number.EPSILON) * 100) / 100
  const difference = Math.round((pack.price - singleTotal + Number.EPSILON) * 100) / 100
  return <aside className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm" data-testid="booking-package-recommendation">
    <p className="font-semibold text-orange-950">ลองเปรียบเทียบคอร์ส {pack.quantity} {unit}</p>
    <p className="mt-2">รายครั้งที่เลือก {selectedQuantity} {unit} · ฿{singleTotal.toLocaleString()} ก่อนคูปอง</p>
    <p className="mt-1">คอร์ส {pack.quantity} {unit} · ฿{pack.price.toLocaleString()} ก่อนคูปอง · {difference > 0 ? 'เพิ่มอีก ฿' + difference.toLocaleString() : difference < 0 ? 'ประหยัด ฿' + Math.abs(difference).toLocaleString() : 'ราคาเท่ากัน'}{pack.quantity > selectedQuantity ? ' ได้สิทธิ์เพิ่ม ' + (pack.quantity - selectedQuantity) + ' ' + unit : ''}</p>
    <p className="mt-1 text-xs text-gray-700">{packageValidityDescription(pack, reference)} · ระบบจะตรวจคูปองและยอดใหม่หลังเปลี่ยนคอร์ส</p>
    <Button type="button" variant="outline" className="mt-3 min-h-11 whitespace-normal" onClick={onSelect}>เปลี่ยนเป็นคอร์ส {pack.quantity} {unit}</Button>
    <p className="mt-2 text-xs text-gray-600">เลือกรายครั้งต่อได้ ใช้ได้เฉพาะเดือนเรียนเดิม</p>
  </aside>
}

import { bookingSummaryRounds } from '@/lib/booking-summary'
import { formatLearnerDisplayName } from '@/lib/learner-display-name'
import { packageValidityDescription } from '@/lib/booking-package-validity'
import { isPerSessionPurchase } from '@/lib/booking-purchase'
import type { Bill, PaymentState, Session } from './booking-payment-client'

const courseNames: Record<string, string> = { kids_group: 'กลุ่มเด็ก', adult_group: 'กลุ่มผู้ใหญ่', private: 'Private' }

export function BookingBillSummary({ bill, sessions, data, showPrice, showAllRounds = false }: { bill: Bill; sessions: Session[]; data: PaymentState; showPrice: boolean; showAllRounds?: boolean }) {
  const family = bill.course_types?.name === 'private'
  const visibleSessions = sessions.filter(s=>!['cancelled','walleted','rescheduled'].includes(s.status))
  const grouped = bookingSummaryRounds(visibleSessions, family)
  const learnerName = (id: string | null) => {
    if (!id) return data.userName
    const child = data.learners.find(c => c.id === id) || sessions.find(s => s.child_id === id)?.children || (bill.child_id === id ? bill.children : null)
    return child ? formatLearnerDisplayName({ fullName: child.full_name, nickname: child.nickname }) : 'ข้อมูลผู้เรียนไม่ครบ'
  }
  const participantIds = bill.package_participants?.length ? bill.package_participants : [...new Set(visibleSessions.map(s => s.child_id))]
  const names = (participantIds.length ? participantIds : [bill.child_id]).map(learnerName).join(', ')
  const branchNames = new Map(data.branches.map(b => [b.id, b.name]))
  const rounds = [...grouped.branches.values()].flat().sort((a,b)=>(a.session.date+a.session.start_time).localeCompare(b.session.date+b.session.start_time))
  const unit = family ? 'ชั่วโมง' : 'ครั้ง'
  const participants = new Set(participantIds.map(id=>id || 'self'))
  const renderRound = (round: { session: Session; members: Session[] }) => {
    const members = [...new Set(round.members.map(s=>s.child_id))]
    const differentMembers = family && (members.length !== participants.size || members.some(id=>!participants.has(id || 'self')))
    return <div key={round.session.id} className="min-w-0 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
      <p>{new Date(round.session.date + 'T00:00:00+07:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })} · {round.session.start_time.slice(0, 5)}–{round.session.end_time.slice(0, 5)}</p>
      {grouped.branches.size > 1 && <p className="break-words text-xs text-gray-600">{branchNames.get(round.session.branch_id) || 'ไม่มีข้อมูลชื่อสาขา'}</p>}
      {(differentMembers || !family && participants.size > 1) && <p className="break-words text-xs text-gray-600">ผู้เรียน: {members.map(learnerName).join(', ')}</p>}
    </div>
  }
  return <article className="min-w-0 border-b pb-4 last:border-0 last:pb-0" data-testid={'booking-summary-' + bill.id}>
    <h3 className="break-words font-semibold text-[#153c85]">{names} · {courseNames[bill.course_types?.name || ''] || 'คอร์สเรียน'}</h3>
    <p className="mt-1 break-words text-sm text-gray-600">{grouped.branches.size > 1 ? grouped.branches.size+' สาขา' : branchNames.get(rounds[0]?.session.branch_id || bill.branch_id) || bill.branches?.name || 'ไม่มีข้อมูลชื่อสาขา'}</p>
    {bill.package_snapshot ? <><p className="mt-1 text-sm text-gray-600">{isPerSessionPurchase(bill.package_snapshot) ? 'รายครั้ง' : 'ซื้อคอร์ส'} {bill.total_sessions} {unit} · {isPerSessionPurchase(bill.package_snapshot) ? 'วันเรียนที่แสดง' : 'เลือกวันแล้ว'} {grouped.count}{!isPerSessionPurchase(bill.package_snapshot) && ' · คงเหลือ ' + Math.max(0,bill.total_sessions-grouped.count)}</p><p className="mt-1 text-xs text-gray-600" data-testid={'payment-package-expiry-'+bill.id}>{packageValidityDescription(bill.package_snapshot, data.serverNow, bill.package_expiry_estimated === false ? bill.package_expiry : null)}</p></> : <p className="mt-1 text-sm text-gray-600">{grouped.count} {unit}</p>}
    {rounds.length ? <div className="mt-3 space-y-2">{(showAllRounds ? rounds : rounds.slice(0,3)).map(renderRound)}{!showAllRounds && rounds.length > 3 && <details><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-blue-700">ดูวันเรียนทั้งหมด ({rounds.length} รอบ)</summary><div className="max-h-64 space-y-2 overflow-y-auto">{rounds.slice(3).map(renderRound)}</div></details>}</div> : <p className="mt-2 text-sm text-gray-600">ยังไม่ได้เลือกวันเรียน</p>}
    {bill.coupon_code && <p className="mt-3 break-words text-sm text-green-800" data-testid={'booking-coupon-'+bill.id}>โค้ด {bill.coupon_code}{bill.coupon_state === 'released' ? ' · ไม่ใช้ส่วนลดแล้ว' : ' · ลด ฿'+Number(bill.coupon_discount || 0).toLocaleString()}</p>}
    {showPrice && <p className="mt-3 flex flex-wrap justify-between gap-2 font-semibold"><span>ยอดรายการนี้</span><span>฿{Number(bill.total_price).toLocaleString()}</span></p>}
  </article>
}

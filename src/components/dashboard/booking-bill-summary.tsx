import { bookingSummaryRounds } from '@/lib/booking-summary'
import { formatLearnerDisplayName } from '@/lib/learner-display-name'
import { packageValidityDescription } from '@/lib/booking-package-validity'
import type { Bill, PaymentState, Session } from './booking-payment-client'

const courseNames: Record<string, string> = { kids_group: 'กลุ่มเด็ก', adult_group: 'กลุ่มผู้ใหญ่', private: 'Private' }

export function BookingBillSummary({ bill, sessions, data, showPrice, showAllRounds = false }: { bill: Bill; sessions: Session[]; data: PaymentState; showPrice: boolean; showAllRounds?: boolean }) {
  const family = bill.course_types?.name === 'private'
  const grouped = bookingSummaryRounds(sessions, family)
  const learnerName = (id: string | null) => {
    if (!id) return data.userName
    const child = data.learners.find(c => c.id === id) || sessions.find(s => s.child_id === id)?.children || (bill.child_id === id ? bill.children : null)
    return child ? formatLearnerDisplayName({ fullName: child.full_name, nickname: child.nickname }) : 'ข้อมูลผู้เรียนไม่ครบ'
  }
  const participantIds = bill.package_participants?.length ? bill.package_participants : [...new Set(sessions.map(s => s.child_id))]
  const names = (participantIds.length ? participantIds : [bill.child_id]).map(learnerName).join(', ')
  const branchNames = new Map(data.branches.map(b => [b.id, b.name]))
  const renderRound = (round: { session: Session; members: Session[] }) => <div key={round.session.id} className="mt-2 text-sm text-gray-700">
    <p>{new Date(round.session.date + 'T00:00:00+07:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })} · {round.session.start_time.slice(0, 5)}–{round.session.end_time.slice(0, 5)}</p>
    {family && <p className="text-xs text-gray-500">ผู้เรียน: {[...new Set(round.members.map(s => s.child_id))].map(learnerName).join(', ')}</p>}
  </div>
  return <article className="min-w-0 border-b pb-4 last:border-0" data-testid={'booking-summary-' + bill.id}>
    <h3 className="break-words font-semibold text-[#153c85]">{names} · {courseNames[bill.course_types?.name || ''] || 'คอร์สเรียน'}</h3>
    {bill.package_snapshot && <p className="mt-1 text-sm text-gray-600">แพ็กเกจ {bill.total_sessions} {family ? 'ชั่วโมง' : 'ครั้ง'} · {packageValidityDescription(bill.package_snapshot, data.serverNow, bill.package_expiry_estimated === false ? bill.package_expiry : null)}</p>}
    <p className="mt-1 text-sm text-gray-600">{grouped.count ? `เลือกวันเรียนแล้ว ${grouped.count} รอบ · ${grouped.branches.size} สาขา` : 'ยังไม่ได้เลือกวันเรียน'}</p>
    {[...grouped.branches].map(([branchId, rounds]) => <section key={branchId} className="mt-3 min-w-0 rounded-xl bg-gray-50 p-3">
      <h4 className="break-words text-sm font-semibold text-[#153c85]">{branchNames.get(branchId) || 'ไม่มีข้อมูลชื่อสาขา'} · {rounds.length} รอบ</h4>
      {(showAllRounds ? rounds : rounds.slice(0, 3)).map(renderRound)}
      {!showAllRounds && rounds.length > 3 && <details className="mt-2 text-sm"><summary className="min-h-11 cursor-pointer py-2 font-semibold text-blue-700">ดูอีก {rounds.length - 3} รอบในสาขานี้</summary><div className="max-h-64 overflow-y-auto">{rounds.slice(3).map(renderRound)}</div></details>}
    </section>)}
    {showPrice && <p className="mt-3 flex flex-wrap justify-between gap-2 font-semibold"><span>ยอดรายการนี้</span><span>฿{Number(bill.total_price).toLocaleString()}</span></p>}
  </article>
}

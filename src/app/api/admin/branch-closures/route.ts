import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireSuperAdminUser } from '@/lib/auth/admin'
import { readBranchDateClosures } from '@/lib/branch-date-closures-server'
import { isValidDateKey } from '@/lib/date-format'
import { formatLearnerDisplayName } from '@/lib/learner-display-name'

const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const access = await requireSuperAdminUser()
  if (!access) return NextResponse.json({ error: 'ไม่มีสิทธิ์จัดการวันปิดสาขา' }, { status: 403 })
  const date = request.nextUrl.searchParams.get('date') || '', branch = request.nextUrl.searchParams.get('branch') || ''
  if (!isValidDateKey(date) || !uuid.test(branch)) return NextResponse.json({ error: 'เลือกสาขาและวันที่ให้ครบ' }, { status: 400 })
  try {
    const client = getServiceRoleClient(), [year, month] = date.slice(0, 7).split('-').map(Number)
    const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
    const closures = await readBranchDateClosures(client, `${date.slice(0, 7)}-01`, end, true)
    const impact: Array<Record<string, unknown>> = []
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client.from('booking_sessions').select('id,child_id,date,start_time,end_time,status,bookings!inner(status,user_id,profiles(full_name),course_types(name)),children(full_name,nickname)')
        .eq('branch_id', branch).eq('date', date).is('cancelled_at', null).in('status', ['scheduled', 'completed', 'absent'])
        .neq('bookings.status', 'cancelled').order('id').range(offset, offset + 999)
      if (error) throw new Error('อ่านรายการจองเดิมไม่สำเร็จ')
      for (const raw of data || []) {
        const row = raw as unknown as { id: string; child_id: string | null; date: string; start_time: string; end_time: string; status: string; bookings: { status: string; user_id: string; profiles: { full_name: string } | null; course_types: { name: string } | null }; children: { full_name: string; nickname: string | null } | null }
        impact.push({ id: row.id, date: row.date, start: row.start_time, end: row.end_time, status: row.status, bookingStatus: row.bookings.status,
          course: row.bookings.course_types?.name, learner: formatLearnerDisplayName({ fullName: row.child_id ? row.children?.full_name : row.bookings.profiles?.full_name, nickname: row.child_id ? row.children?.nickname : null }) })
      }
      if (!data || data.length < 1000) break
    }
    return NextResponse.json({ closures, impact }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'อ่านวันปิดสาขาไม่สำเร็จ' }, { status: 503 }) }
}

export async function POST(request: NextRequest) {
  const access = await requireSuperAdminUser()
  if (!access) return NextResponse.json({ error: 'ไม่มีสิทธิ์จัดการวันปิดสาขา' }, { status: 403 })
  try {
    const body = await request.json()
    if (!uuid.test(body.branchId || '') || !isValidDateKey(body.date || '') || typeof body.closed !== 'boolean'
      || !uuid.test(body.requestId || '') || typeof body.reason !== 'string' || !body.reason.trim() || body.reason.length > 1000) {
      return NextResponse.json({ error: 'เลือกสาขา วันที่ และระบุเหตุผลให้ครบ' }, { status: 400 })
    }
    const { data, error } = await getServiceRoleClient().rpc('branch_date_closure_set_v1', {
      p_actor_id: access.user.id, p_branch_id: body.branchId, p_date: body.date, p_closed: body.closed,
      p_reason: body.reason.trim(), p_request_id: body.requestId,
    })
    if (error) {
      const code = /(?:BRANCH_CLOSURE|TASK10)_[A-Z_]+/.exec(error.message)?.[0]
      const messages: Record<string, string> = { BRANCH_CLOSURE_DATE_PAST: 'ประกาศปิดได้ตั้งแต่วันนี้เป็นต้นไป', BRANCH_CLOSURE_REPLAY_CONFLICT: 'รายละเอียดคำขอเปลี่ยน กรุณาตรวจสอบรายการเดิม', BRANCH_CLOSURE_BRANCH_INVALID: 'สาขาไม่พร้อมใช้งาน', BRANCH_CLOSURE_NOT_FOUND: 'ไม่พบวันปิดที่ต้องการยกเลิก', TASK10_UNAUTHORIZED: 'ไม่มีสิทธิ์จัดการวันปิดสาขา' }
      return NextResponse.json({ error: (code && messages[code]) || 'ยังยืนยันผลการบันทึกไม่ได้', code: code || 'BRANCH_CLOSURE_UNAVAILABLE' }, { status: code ? 409 : 503 })
    }
    return NextResponse.json(data)
  } catch { return NextResponse.json({ error: 'ยังยืนยันผลการบันทึกไม่ได้', code: 'BRANCH_CLOSURE_UNAVAILABLE' }, { status: 503 }) }
}

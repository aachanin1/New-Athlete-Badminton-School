import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireAdminMenuAccess } from '@/lib/auth/admin'
import { formatLearnerDisplayName } from '@/lib/learner-display-name'
import type { MakeupHistoryEvent, MakeupHistoryResult } from '@/lib/admin-makeup-history'

const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
type RawEvent = Omit<MakeupHistoryEvent, 'learner' | 'participants'> & { learnerFullName: string | null; learnerNickname: string | null; participants: Array<{ childId: string | null; fullName: string | null; nickname: string | null }> }
export async function GET(request: NextRequest) {
  const access = await requireAdminMenuAccess('makeup')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })
  const q = request.nextUrl.searchParams, month = q.get('month') || '', user = q.get('parent') || '', child = q.get('child') || null
  const course = q.get('course') || '', kind = q.get('kind') || 'all', page = Number(q.get('page') || 1), reference=q.get('reference')
  if (!uuid.test(user) || child !== null && !uuid.test(child) || !/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month) || month.slice(0, 4) >= '9999'
    || reference!==null&&!uuid.test(reference) || !['kids_group', 'adult_group', 'private'].includes(course) || !['all', 'wallet', 'absent', 'use'].includes(kind) || !Number.isInteger(page) || page < 1 || page > 10000) {
    return NextResponse.json({ error: 'ข้อมูลประวัติไม่ถูกต้อง' }, { status: 400 })
  }
  try {
    const client = getServiceRoleClient()
    const { data, error } = await client.rpc('admin_makeup_history_ledger_v3', { p_actor: access.ctx.user.id, p_month: `${month}-01`, p_user: user, p_course: course, p_child: child, p_kind: kind, p_page: page, p_reference: reference })
    if (error || !data) throw new Error('History unavailable')
    const result = data as Omit<MakeupHistoryResult, 'items'> & { items: RawEvent[] }
    const additions=result.items.filter(e=>e.source.referenceOnly).map(e=>e.id.slice('additional:'.length))
    const additionParticipants=new Map<string,Array<{childId:string|null;name:string}>>()
    if(additions.length){
      const {data:members,error:memberError}=await client.from('booking_sessions').select('admin_makeup_grant_id,child_id,children(full_name,nickname),bookings!inner(profiles!bookings_user_id_fkey(full_name))').in('admin_makeup_grant_id',additions).order('id')
      if(memberError)throw memberError
      for(const m of members as unknown as Array<{admin_makeup_grant_id:string;child_id:string|null;children:{full_name:string|null;nickname:string|null}|null;bookings:{profiles:{full_name:string|null}|null}}>){
        const list=additionParticipants.get(m.admin_makeup_grant_id)||[]
        list.push({childId:m.child_id,name:formatLearnerDisplayName({fullName:m.child_id?m.children?.full_name:m.bookings.profiles?.full_name,nickname:m.child_id?m.children?.nickname:null})});additionParticipants.set(m.admin_makeup_grant_id,list)
      }
    }
    return NextResponse.json({ ...result, items: result.items.map(({ learnerFullName, learnerNickname, ...event }) => ({
      ...event, learner: formatLearnerDisplayName({ fullName: learnerFullName, nickname: learnerNickname }),
      participants: event.source.referenceOnly?additionParticipants.get(event.id.slice('additional:'.length))||[]:event.participants.map(({ childId, fullName, nickname }) => ({ childId, name: formatLearnerDisplayName({ fullName, nickname }) })),
    })) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch { return NextResponse.json({ error: 'อ่านประวัติไม่สำเร็จ กรุณาลองใหม่' }, { status: 503 }) }
}

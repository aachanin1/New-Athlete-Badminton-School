import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireSuperAdminUser } from '@/lib/auth/admin'
import { readBranchDateClosures } from '@/lib/branch-date-closures-server'
import { isValidDateKey } from '@/lib/date-format'
import { formatLearnerDisplayName } from '@/lib/learner-display-name'

const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
 const access=await requireSuperAdminUser()
 if(!access)return NextResponse.json({error:'ไม่มีสิทธิ์จัดการวันปิดสาขา'},{status:403})
 const q=request.nextUrl.searchParams,mode=q.get('mode')||'impact',date=q.get('date')||'',branch=q.get('branch')||'',month=q.get('month')||date.slice(0,7),page=Number(q.get('page')||1)
 if(!['overview','summary','impact'].includes(mode)||!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month)||month.slice(0,4)>='9999'||(branch&&!uuid.test(branch))||!Number.isInteger(page)||page<1||page>10000
  ||mode!=='overview'&&(!isValidDateKey(date)||!branch))return NextResponse.json({error:'เลือกสาขาและวันที่ให้ครบ'},{status:400})
 try{
  const client=getServiceRoleClient()
  if(mode==='overview'){
   const {data,error}=await client.rpc('admin_branch_closure_overview_v1',{p_actor_id:access.user.id,p_month:month+'-01',p_branch:branch||null})
   if(error)throw Error('อ่านวันปิดสาขาไม่สำเร็จ')
   return NextResponse.json({closures:data},{headers:{'Cache-Control':'private, no-store'}})
  }
  const [year,m]=month.split('-').map(Number),end=new Date(Date.UTC(year,m,0)).toISOString().slice(0,10)
  const closures=await readBranchDateClosures(client,month+'-01',end,true)
  if(mode==='summary'){
   const {count,error}=await client.from('booking_sessions').select('id,bookings!inner(status)',{count:'exact',head:true}).eq('branch_id',branch).eq('date',date).is('cancelled_at',null).in('status',['scheduled','completed','absent']).neq('bookings.status','cancelled')
   if(error||count===null)throw Error('อ่านจำนวนรายการเดิมไม่สำเร็จ')
   return NextResponse.json({closures,total:count},{headers:{'Cache-Control':'private, no-store'}})
  }
  const {data,error,count}=await client.from('booking_sessions').select('id,child_id,date,start_time,end_time,status,is_makeup,bookings!inner(status,user_id,profiles(full_name),course_types(name)),children(full_name,nickname,parent_id)',{count:'exact'})
   .eq('branch_id',branch).eq('date',date).is('cancelled_at',null).in('status',['scheduled','completed','absent']).neq('bookings.status','cancelled').order('start_time').order('id').range((page-1)*20,page*20-1)
  if(error||count===null)throw Error('อ่านรายการจองเดิมไม่สำเร็จ')
  const rows=(data||[]) as unknown as Array<{id:string;child_id:string|null;date:string;start_time:string;end_time:string;status:string;is_makeup:boolean;bookings:{status:string;user_id:string;profiles:{full_name:string}|null;course_types:{name:string}|null};children:{full_name:string;nickname:string|null;parent_id:string}|null}>
  const impact=rows.map(r=>({id:r.id,date:r.date,start:r.start_time,end:r.end_time,status:r.status,isMakeup:r.is_makeup,identityValid:(!r.child_id&&r.bookings.course_types?.name!=='kids_group')||Boolean(r.child_id&&r.children?.parent_id===r.bookings.user_id),bookingStatus:r.bookings.status,course:r.bookings.course_types?.name,learner:r.child_id&&r.children?.parent_id!==r.bookings.user_id?formatLearnerDisplayName({}):formatLearnerDisplayName({fullName:r.child_id?r.children?.full_name:r.bookings.profiles?.full_name,nickname:r.child_id?r.children?.nickname:null})}))
  return NextResponse.json({closures,impact,total:count,page,pageSize:20},{headers:{'Cache-Control':'private, no-store'}})
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'อ่านวันปิดสาขาไม่สำเร็จ'},{status:503})}
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

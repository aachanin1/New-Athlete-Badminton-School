import {NextRequest,NextResponse} from 'next/server'
import {requireAdminMenuAccess} from '@/lib/auth/admin'
import {createClient} from '@/lib/supabase/server'
import {readAdminMakeupMonth} from '@/lib/admin-makeup-month-server'
import {selectMakeupReview,selectLegacyMakeup} from '@/lib/admin-makeup-selection'
import {loadTask10Policy} from '@/lib/task10-policy'
import {getServiceRoleClient} from '@/lib/auth/admin'

export async function GET(request:NextRequest) {
 const access=await requireAdminMenuAccess('makeup');if(!access.ok)return NextResponse.json({error:access.message},{status:access.status})
 const q=request.nextUrl.searchParams,month=q.get('month')||'',mode=q.get('mode')||'review',page=Number(q.get('page')||1),pageSize=Number(q.get('pageSize')||15)
 const detail=q.get('group')||undefined
 const filter={search:q.get('search')?.trim()||'',branch:q.get('branch')||'all',course:q.get('course')||'all',status:q.get('status')||'all',session:q.get('session'),date:q.get('date')}
 if(!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month)||month.slice(0,4)>='9999'||!['review','legacy'].includes(mode)||![15,25,50].includes(pageSize)||!Number.isInteger(page)||page<1||page>10000||filter.search.length>200
  ||!['all','kids_group','adult_group','private'].includes(filter.course)||!(filter.branch==='all'||/^[0-9a-f-]{36}$/i.test(filter.branch))
  ||!['all','no_coach','waiting_attendance','coach_evidence','coach_requested','actionable','makeup','expired'].includes(filter.status)||(detail?.length||0)>2000)return NextResponse.json({error:'ข้อมูลตัวกรองไม่ถูกต้อง'},{status:400})
 try {
  const policy=await loadTask10Policy(getServiceRoleClient())
  const data=await readAdminMakeupMonth(await createClient(),month,mode as 'review'|'legacy',Boolean(policy.effectiveAt))
  const result=mode==='review'?selectMakeupReview(data.sessions,filter,page,pageSize,detail):selectLegacyMakeup(data.sessions,data.linkedSessions,filter,page,pageSize,Boolean(policy.effectiveAt))
  if(detail&&'detailFound' in result&&!result.detailFound)return NextResponse.json({error:'ข้อมูลเคสเปลี่ยนแล้ว กรุณาโหลดรายการล่าสุด'},{status:409})
  return NextResponse.json({...result,coaches:data.coaches,page,pageSize},{headers:{'Cache-Control':'private, no-store'}})
 } catch {return NextResponse.json({error:'อ่านรายการไม่สำเร็จ กรุณาลองใหม่'},{status:503})}
}

import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { loadTask10Policy } from '@/lib/task10-policy'
import { MakeupClient } from '@/components/admin/makeup-client'
import { isValidDateKey } from '@/lib/date-format'

export default async function MakeupPage({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}) {
 const q=searchParams?await searchParams:{}
 const text=(key:string)=>typeof q[key]==='string'?q[key] as string:null
 const validMonth=(value:string|null):value is string=>Boolean(value&&/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value)&&value.slice(0,4)<'9999')
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
 const currentMonth=today.slice(0,7),input=text('month')
 const invalidMonth=q.month!==undefined&&!validMonth(input)
 let month=!invalidMonth&&input?input:currentMonth
 const supabase=await createClient()
 const session=text('session')
 if(q.month===undefined&&session&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(session)){
  const {data,error}=await supabase.from('booking_sessions').select('date,bookings!inner(status)').eq('id',session).eq('bookings.status','verified').maybeSingle()
  if(error)throw new Error('อ่านเดือนของรายการที่เลือกไม่สำเร็จ')
  if(data&&validMonth((data as {date:string}).date.slice(0,7)))month=(data as {date:string}).date.slice(0,7)
 } else if(q.month===undefined&&isValidDateKey(text('date')||'')&&validMonth(text('date')!.slice(0,7)))month=text('date')!.slice(0,7)
 const [{data:branches,error},familyPolicy]=await Promise.all([supabase.from('branches').select('id,name,slug').eq('is_active',true).order('name'),loadTask10Policy(getServiceRoleClient())])
 if(error)throw new Error('อ่านสาขาไม่สำเร็จ')
 return <MakeupClient familyCards={[]} sessions={[]} linkedSessions={[]} coaches={[]} scheduleTemplates={[]} familyPolicy={familyPolicy} branches={branches||[]} selectedSourceMonth={month} currentMonth={currentMonth} invalidMonth={invalidMonth} initialTab={text('tab')==='manage'?'manage':text('tab')==='makeup'?'makeup':undefined} manageSessionId={text('tab')==='manage'?session:null} reviewTarget={{sessionId:text('tab')==='manage'?null:session,date:text('date')}} />
}

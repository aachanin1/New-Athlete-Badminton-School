import {NextResponse} from 'next/server'
import {requireAdminMenuAccess} from '@/lib/auth/admin'
import {createClient} from '@/lib/supabase/server'
import {readFutureBranchDateClosureState} from '@/lib/branch-date-closures-server'
export async function GET(){
 const access=await requireAdminMenuAccess('makeup');if(!access.ok)return NextResponse.json({error:access.message},{status:access.status})
 const client=await createClient(),{available,closures}=await readFutureBranchDateClosureState(client)
 if(!available)return NextResponse.json({error:'อ่านวันปิดสาขาไม่สำเร็จ กรุณาลองใหม่'},{status:503})
 interface Row{id:string;branch_id:string;course_type_id:string;day_of_week:number;start_time:string;end_time:string;is_active:boolean;notes:string|null;branches:{slug:string}|null;course_types:{name:string}|null}
 const rows:Row[]=[]
 for(let offset=0;;offset+=1000){
  const {data,error}=await client.from('schedule_templates').select('id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active,notes,branches(slug),course_types(name)').eq('is_active',true).order('id').range(offset,offset+999)
  if(error)return NextResponse.json({error:'อ่านรอบเรียนไม่สำเร็จ'},{status:503})
  rows.push(...(data||[]) as unknown as Row[]);if(!data||data.length<1000)break
 }
 return NextResponse.json({templates:rows.map(t=>({...t,branch_slug:t.branches?.slug||'',course_type_name:t.course_types?.name,start_time:t.start_time.slice(0,5),end_time:t.end_time.slice(0,5),closed_dates:closures.filter(c=>c.branch_id===t.branch_id).map(c=>c.closure_date)}))},{headers:{'Cache-Control':'private, no-store'}})
}

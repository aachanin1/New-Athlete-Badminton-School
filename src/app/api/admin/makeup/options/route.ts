import {NextRequest,NextResponse} from 'next/server'
import {getServiceRoleClient,requireAdminMenuAccess} from '@/lib/auth/admin'
import {createClient} from '@/lib/supabase/server'
import {readFutureBranchDateClosureState} from '@/lib/branch-date-closures-server'
export async function GET(request:NextRequest){
 const access=await requireAdminMenuAccess('makeup');if(!access.ok)return NextResponse.json({error:access.message},{status:access.status})
 const q=request.nextUrl.searchParams,parent=q.get('parent'),month=q.get('month'),children=q.get('children')?.split(',')
 let busy:unknown=[]
 let busyTask:Promise<{data:unknown;error:unknown}>|null=null
 if(parent||month||children){
  const uuid=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
  if(!parent||!uuid.test(parent)||!month||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||!children?.length||children.length>20||children.some(id=>id!=='self'&&!uuid.test(id)))return NextResponse.json({error:'ข้อมูลผู้เรียนไม่ถูกต้อง'},{status:400})
  busyTask=Promise.resolve(getServiceRoleClient().rpc(q.get('legacy')==='true'?'admin_makeup_busy_legacy_v2':'admin_makeup_busy_v2',{p_actor:access.ctx.user.id,p_parent:parent,p_children:children.map(id=>id==='self'?null:id),p_month:month+'-01'})).then(result=>({data:result.data,error:result.error})).catch(error=>({data:null,error}))
 }
 const client=await createClient(),{available,closures}=await readFutureBranchDateClosureState(client)
 if(!available)return NextResponse.json({error:'อ่านวันปิดสาขาไม่สำเร็จ กรุณาลองใหม่'},{status:503})
 interface Row{id:string;branch_id:string;course_type_id:string;day_of_week:number;start_time:string;end_time:string;is_active:boolean;notes:string|null;branches:{slug:string}|null;course_types:{name:string}|null}
 const rows:Row[]=[]
 for(let offset=0;;offset+=1000){
  const {data,error}=await client.from('schedule_templates').select('id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active,notes,branches(slug),course_types(name)').eq('is_active',true).order('id').range(offset,offset+999)
  if(error)return NextResponse.json({error:'อ่านรอบเรียนไม่สำเร็จ'},{status:503})
  rows.push(...(data||[]) as unknown as Row[]);if(!data||data.length<1000)break
 }
 if(busyTask){const result=await busyTask;if(result.error||!Array.isArray(result.data))return NextResponse.json({error:'อ่านตารางผู้เรียนไม่สำเร็จ กรุณาลองใหม่'},{status:503});busy=result.data}
 return NextResponse.json({busy,templates:rows.map(t=>({...t,branch_slug:t.branches?.slug||'',course_type_name:t.course_types?.name,start_time:t.start_time.slice(0,5),end_time:t.end_time.slice(0,5),closed_dates:closures.filter(c=>c.branch_id===t.branch_id).map(c=>c.closure_date)}))},{headers:{'Cache-Control':'private, no-store'}})
}

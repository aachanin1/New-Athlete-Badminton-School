import {NextRequest,NextResponse} from 'next/server'
import {getServiceRoleClient,requireAdminMenuAccess} from '@/lib/auth/admin'
const uuid=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
export async function GET(request:NextRequest) {
 const access=await requireAdminMenuAccess('makeup');if(!access.ok)return NextResponse.json({error:access.message},{status:access.status})
 const q=request.nextUrl.searchParams,month=q.get('month')||'',course=q.get('course')||'',search=q.get('search')?.trim()||'',mode=q.get('mode')||'learners',page=Number(q.get('page')||1)
 const optional=(name:string)=>q.get(name)||null
 if(!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month)||month.slice(0,4)>='9999'||!['kids_group','adult_group','private'].includes(course)||!['learners','sessions','families'].includes(mode)||!Number.isInteger(page)||page<1||page>10000||search.length>200
  ||['branch','user','child','booking'].some(k=>optional(k)&&!uuid.test(optional(k)!))||(['learners','families'].includes(mode)&&search.length<2)||mode==='sessions'&&!optional('user'))return NextResponse.json({error:'เลือกคอร์สและค้นหาผู้เรียนให้ครบ'},{status:400})
 const {data,error}=await getServiceRoleClient().rpc('admin_makeup_lookup_v1',{p_actor_id:access.ctx.user.id,p_month:month+'-01',p_course:course,p_search:search,p_branch:optional('branch'),p_page:page,p_mode:mode,p_user:optional('user'),p_child:optional('child'),p_booking:optional('booking')})
 if(error||!data)return NextResponse.json({error:'อ่านรายการไม่สำเร็จ กรุณาลองใหม่'},{status:503})
 return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}})
}

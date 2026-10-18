import {NextRequest,NextResponse} from 'next/server'
import {getServiceRoleClient,requireAdminMenuAccess} from '@/lib/auth/admin'
export async function GET(request:NextRequest){
 const access=await requireAdminMenuAccess('makeup');if(!access.ok)return NextResponse.json({error:access.message},{status:access.status})
 const source=request.nextUrl.searchParams.get('source')||''
 if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(source))return NextResponse.json({error:'ข้อมูลต้นทางไม่ถูกต้อง'},{status:400})
 const client=getServiceRoleClient(),items:Array<Record<string,unknown>>=[]
 for(let offset=0;;offset+=1000){
  const {data,error}=await client.from('booking_sessions').select('id,booking_id,child_id,branch_id,schedule_slot_id,date,start_time,end_time,status,is_makeup,rescheduled_from_id,bookings!inner(user_id,status)')
   .eq('rescheduled_from_id',source).eq('is_makeup',true).eq('bookings.status','verified').order('id').range(offset,offset+999)
  if(error)return NextResponse.json({error:'ยังอ่านผลยืนยันไม่ได้ กรุณาตรวจสอบสถานะล่าสุดอีกครั้ง'},{status:503})
  const rows=(data||[]) as unknown as Array<Record<string,unknown>&{bookings:{user_id:string}}>
  items.push(...rows.map(row=>({...row,user_id:row.bookings.user_id,bookings:undefined})))
  if(!data||data.length<1000)break
 }
 return NextResponse.json({items},{headers:{'Cache-Control':'private, no-store'}})
}

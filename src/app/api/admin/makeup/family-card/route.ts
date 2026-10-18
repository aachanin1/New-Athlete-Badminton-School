import {NextRequest,NextResponse} from 'next/server'
import {getServiceRoleClient,requireAdminMenuAccess} from '@/lib/auth/admin'
import {readKidsFamilyMakeupWithDestinations} from '@/lib/kids-family-makeup-server'
export async function GET(request:NextRequest){
 const access=await requireAdminMenuAccess('makeup');if(!access.ok)return NextResponse.json({error:access.message},{status:access.status})
 const parent=request.nextUrl.searchParams.get('parent')||'',month=request.nextUrl.searchParams.get('month')||''
 if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(parent)||!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month)||month.slice(0,4)>='9999')return NextResponse.json({error:'เลือกครอบครัวและเดือนต้นทางให้ครบ'},{status:400})
 try{
  const client=getServiceRoleClient(),[{data:profile,error},state]=await Promise.all([client.from('profiles').select('full_name').eq('id',parent).single(),readKidsFamilyMakeupWithDestinations(client,access.ctx.user.id,parent,month)])
  if(error||!profile||!state.sourceMonth)throw Error('อ่านสิทธิ์ไม่สำเร็จ')
  return NextResponse.json({parentName:profile.full_name||'ไม่ทราบผู้ปกครอง',branchIds:[],branchNames:[],state},{headers:{'Cache-Control':'private, no-store'}})
 }catch{return NextResponse.json({error:'อ่านสิทธิ์ครอบครัวไม่สำเร็จ กรุณาลองใหม่'},{status:503})}
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { checkoutRpc, checkoutError } from '@/lib/booking-checkout-server'
import { isSameOriginMutation } from '@/lib/progressive-payment-integration'
import type { KidsFamilyMakeupState } from '@/lib/kids-family-makeup'
import type {WalletInventory} from '@/lib/booking-wallet-inventory'
interface WalletQueryClient { from(name:string):ReturnType<ReturnType<typeof getServiceRoleClient>['from']> }
export async function GET(request:NextRequest) {
  const client=await createClient(),{data:{user}}=await client.auth.getUser()
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401})
  try{
    const admin=getServiceRoleClient(),db=admin as unknown as WalletQueryClient
    if(request.nextUrl.searchParams.get('calendarOnly')==='1'){
      const month=request.nextUrl.searchParams.get('month')||''
      if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||Number(month.slice(0,4))<2000||Number(month.slice(0,4))>2200)return NextResponse.json({error:'เดือนที่เลือกไม่ถูกต้อง'},{status:400})
      const next=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),1)).toISOString().slice(0,10)
      const sessions=await admin.from('booking_sessions').select('id,booking_id,branch_id,date,start_time,end_time,child_id,bookings!inner(user_id,status)',{count:'exact'})
        .eq('bookings.user_id',user.id).in('bookings.status',['pending_payment','paid','verified'])
        .gte('date',month+'-01').lt('date',next).not('status','in','(rescheduled,walleted)').is('cancelled_at',null).order('id').limit(2001)
      if(sessions.error||(sessions.data?.length||0)>2000||sessions.count!==(sessions.data?.length||0))throw Error('BOOKING_UX_READ_FAILED')
      return NextResponse.json({month,sessions:(sessions.data||[]).map(s=>({id:s.id,bookingId:s.booking_id,branchId:s.branch_id,date:s.date,start:s.start_time,end:s.end_time,childId:s.child_id}))},{headers:{'Cache-Control':'private, no-store'}})
    }
    if(request.nextUrl.searchParams.get('inventory')==='2'){
      const group=request.nextUrl.searchParams.get('group'),selected=request.nextUrl.searchParams.get('selected')?.split(',').filter(Boolean)||[]
      if(group&&!/^[a-f0-9]{32}$/.test(group)||selected.length>32||selected.some(id=>!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)))return NextResponse.json({error:'กลุ่มสิทธิไม่ถูกต้อง'},{status:400})
      const [inventory,branches,templates,children,profile,closures,rules]=await Promise.all([
        checkoutRpc<WalletInventory>('booking_ux_wallet_inventory_v1',{p_actor:user.id,p_group:group,p_selected:[...new Set(selected)]}),
        admin.from('branches').select('id,name,slug').eq('is_active',true).order('name'),
        admin.from('schedule_templates').select('id,branch_id,course_type_id,day_of_week,start_time,end_time,course_types(name)').eq('is_active',true).limit(2001),
        admin.from('children').select('id,full_name,nickname').eq('parent_id',user.id),
        admin.from('profiles').select('full_name').eq('id',user.id).single(),
        admin.from('branch_date_closures').select('branch_id,closure_date').eq('is_active',true).gte('closure_date',new Date().toISOString().slice(0,10)),
        checkoutRpc('booking_ux_wallet_rules_v1',{p_actor:user.id}),
      ])
      if([branches,templates,children,profile,closures].some(r=>r.error)||(templates.data?.length||0)>2000)throw Error('BOOKING_UX_READ_FAILED')
      return NextResponse.json({...inventory,branches:branches.data,templates:templates.data,children:children.data,userName:profile.data?.full_name||'ตนเอง',rules,closures:closures.data},{headers:{'Cache-Control':'private, no-store'}})
    }
    const history=request.nextUrl.searchParams.get('history')==='1',offset=Number(request.nextUrl.searchParams.get('offset')||0)
    const course=request.nextUrl.searchParams.get('course')
    if(course&&!['kids_group','adult_group','private'].includes(course))return NextResponse.json({error:'ประเภทกระเป๋าไม่ถูกต้อง'},{status:400})
    if(!Number.isInteger(offset)||offset<0||offset>100000)return NextResponse.json({error:'หน้ารายการไม่ถูกต้อง'},{status:400})
    if(request.nextUrl.searchParams.get('historyOnly')==='1'){
      const month=request.nextUrl.searchParams.get('month')||''
      if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||Number(month.slice(0,4))<2000||Number(month.slice(0,4))>2200||!course)return NextResponse.json({error:'เดือนหรือประเภทประวัติไม่ถูกต้อง'},{status:400})
      if(request.nextUrl.searchParams.get('historyFormat')==='2'){
        const page=await checkoutRpc('booking_ux_wallet_history_v1',{p_actor:user.id,p_month:month+'-01',p_course:course,p_offset:offset})
        return NextResponse.json(page,{headers:{'Cache-Control':'private, no-store'}})
      }
      // Older open tabs keep their original used/expired response contract.
      // Each independent stream is bounded before joining. No templates, profile,
      // calendar or entitlement RPC is needed for a historical month.
      const start=new Date(month+'-01T00:00:00+07:00').toISOString(),end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),1,-7)).toISOString(),now=new Date().toISOString(),size=20
      const eventFilter=`and(status.eq.redeemed,redeemed_at.gte.${start},redeemed_at.lt.${end}),and(status.in.(active,expired,available),expires_at.gte.${start},expires_at.lt.${end},expires_at.lte.${now})`
      const creditSelect='id,original_session_id,child_id,original_date,status,expires_at,redeemed_at,lesson_wallet_credit_members(child_id),course_types!inner(name)'
      const [creditResult,unitResult,useResult]=await Promise.all([
        admin.from('lesson_wallet_credits').select(creditSelect).eq('user_id',user.id).eq('course_types.name',course).or(eventFilter).order('id').range(offset,offset+size),
        db.from('booking_package_units').select('id,participants,status,expires_at,redeemed_at,bookings!inner(user_id,package_snapshot,course_types!inner(name))').eq('bookings.user_id',user.id).eq('bookings.course_types.name',course).or(eventFilter).order('id').range(offset,offset+size),
        course==='kids_group'?admin.from('task10_family_makeup_uses').select('credit_id,source_session_id,source_root_id,created_at').eq('parent_id',user.id).gte('created_at',start).lt('created_at',end).order('id').range(offset,offset+size):Promise.resolve({data:[],error:null}),
      ])
      if([creditResult,unitResult,useResult].some(r=>r.error))throw Error('BOOKING_UX_READ_FAILED')
      const hasMore=[creditResult,unitResult,useResult].some(r=>(r.data?.length||0)>size),uses=useResult.data?.slice(0,size)||[]
      const useFilter=uses.length?uses.map(u=>`original_session_id.in.(${[u.source_session_id,u.source_root_id].filter(Boolean).join(',')})${u.credit_id?',id.eq.'+u.credit_id:''}`).join(','):''
      const extra=useFilter?await admin.from('lesson_wallet_credits').select(creditSelect).eq('user_id',user.id).eq('course_types.name',course).or(useFilter).limit(61):{data:[],error:null}
      if(extra.error||(extra.data?.length||0)>60)throw Error('BOOKING_UX_READ_FAILED')
      const credits=[...new Map([...(creditResult.data?.slice(0,size)||[]),...(extra.data||[])].map(c=>[c.id,c])).values()]
      // Also check spends outside the requested month: an old Admin spend must
      // never reappear later as an expired unused credit.
      const proofs=credits.length?await admin.from('task10_family_makeup_uses').select('credit_id,source_session_id,source_root_id,created_at').eq('parent_id',user.id).or(`credit_id.in.(${credits.map(c=>c.id).join(',')}),source_session_id.in.(${credits.map(c=>c.original_session_id).join(',')}),source_root_id.in.(${credits.map(c=>c.original_session_id).join(',')})`).limit(241):{data:[],error:null}
      if(proofs.error||(proofs.data?.length||0)>240)throw Error('BOOKING_UX_READ_FAILED')
      const rows=credits.flatMap(c=>{
        const proof=proofs.data?.find(u=>u.credit_id===c.id||u.source_session_id===c.original_session_id||u.source_root_id===c.original_session_id),at=proof?.created_at||c.redeemed_at||c.expires_at
        if(Date.parse(at)<Date.parse(start)||Date.parse(at)>=Date.parse(end))return[]
        return[{id:c.id,kind:'wallet',participants:c.lesson_wallet_credit_members?.length?c.lesson_wallet_credit_members.map(m=>m.child_id):[c.child_id],status:proof||c.status==='redeemed'?'redeemed':'expired',at,originalDate:c.original_date}]
      })
      const units=(unitResult.data?.slice(0,size)||[]) as unknown as Array<{id:string;participants:Array<string|null>;status:string;expires_at:string;redeemed_at:string|null;bookings:{package_snapshot:{quantity:number}}}>
      return NextResponse.json({month,course,rows:[...rows,...units.map(u=>({id:u.id,kind:'package',participants:u.participants,status:u.status==='redeemed'?'redeemed':'expired',at:u.redeemed_at||u.expires_at,quantity:u.bookings.package_snapshot.quantity}))].sort((a,b)=>b.at.localeCompare(a.at)||a.id.localeCompare(b.id)),nextOffset:hasMore?offset+size:null},{headers:{'Cache-Control':'private, no-store'}})
    }
    const instant=new Date(),today=new Date(instant.getTime()+7*3600000),now=instant.toISOString(),previousMonth=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth()-1,1)).toISOString().slice(0,10)
    let creditsQuery=admin.from('lesson_wallet_credits').select('id,booking_id,original_session_id,child_id,course_type_id,status,original_date,original_start_time,original_end_time,expires_at,entitlement_policy,participant_count,lesson_wallet_credit_members(child_id),course_types!inner(name),branches(name)').eq('user_id',user.id)
    let unitsQuery=db.from('booking_package_units').select('id,booking_id,participants,status,expires_at,bookings!inner(user_id,package_snapshot,course_types!inner(name),branches(name))').eq('bookings.user_id',user.id)
    if(course){creditsQuery=creditsQuery.eq('course_types.name',course);unitsQuery=unitsQuery.eq('bookings.course_types.name',course)}
    if(!history){creditsQuery=creditsQuery.in('status',['active','expired']).or('expires_at.gt.'+now+',original_date.gte.'+previousMonth);unitsQuery=unitsQuery.eq('status','available').gt('expires_at',now)}
    const [credits,units,branches,templates,children,profile,closures,rules]=await Promise.all([
      creditsQuery.order('expires_at',{ascending:!history}).order('id').range(offset,offset+200),
      unitsQuery.order('expires_at',{ascending:!history}).order('id').range(offset,offset+200),
      admin.from('branches').select('id,name,slug').eq('is_active',true).order('name'),
      admin.from('schedule_templates').select('id,branch_id,course_type_id,day_of_week,start_time,end_time,course_types(name)').eq('is_active',true).limit(2001),
      admin.from('children').select('id,full_name,nickname').eq('parent_id',user.id),
      admin.from('profiles').select('full_name').eq('id',user.id).single(),
      admin.from('branch_date_closures').select('branch_id,closure_date').eq('is_active',true).gte('closure_date',new Date().toISOString().slice(0,10)),
      checkoutRpc('booking_ux_wallet_rules_v1',{p_actor:user.id}),
    ])
    if([credits,units,branches,templates,children,profile,closures].some(r=>r.error)||(credits.data?.length||0)>2000||(units.data?.length||0)>2000||(templates.data?.length||0)>2000)throw Error('BOOKING_UX_READ_FAILED')
    const hasMore=(credits.data?.length||0)>200||(units.data?.length||0)>200
    const rawCredits=credits.data?.slice(0,200)||[],unitPage=units.data?.slice(0,200)||[]
    // Admin Makeup spends the shared canonical source. Some compatible historical
    // writers retain the Wallet row's old status; never advertise that source twice.
    const spent=rawCredits.length?await admin.from('task10_family_makeup_uses').select('credit_id,source_session_id,source_root_id')
      .eq('parent_id',user.id).or('credit_id.in.('+rawCredits.map(c=>c.id).join(',')+'),source_session_id.in.('+rawCredits.map(c=>c.original_session_id).join(',')+'),source_root_id.in.('+rawCredits.map(c=>c.original_session_id).join(',')+')').limit(601):{data:[],error:null}
    if(spent.error||(spent.data?.length||0)>600)throw Error('BOOKING_UX_READ_FAILED')
    const creditPage=rawCredits.map(c=>spent.data?.some(s=>s.credit_id===c.id||s.source_session_id===c.original_session_id||s.source_root_id===c.original_session_id)?{...c,status:'redeemed' as const}:c)
    const creditRows=creditPage as unknown as Array<{original_date:string;course_types:{name:string}|null}>|null
    const sourceMonths=[...new Set((creditRows||[]).filter(c=>c.course_types?.name==='kids_group').map(c=>c.original_date.slice(0,7)))].filter(m=>{
      const [y,n]=m.split('-').map(Number);return Date.UTC(y,n+1,1)>Date.now()-7*60*60*1000
    }).slice(-2)
    const makeup=(await Promise.all(sourceMonths.map(m=>checkoutRpc<KidsFamilyMakeupState>('booking_ux_parent_state_v1',{p_actor:user.id,p_month:m+'-01'})))).filter(m=>Array.isArray(m.sources))
    return NextResponse.json({credits:creditPage,units:unitPage,nextOffset:hasMore?offset+200:null,branches:branches.data,templates:templates.data,children:children.data,userName:profile.data?.full_name||'ตนเอง',makeup,rules,closures:closures.data},{headers:{'Cache-Control':'private, no-store'}})
  }catch(e){return NextResponse.json({error:checkoutError(e)},{status:503})}
}
export async function POST(request:NextRequest){
  if(!isSameOriginMutation(request))return NextResponse.json({error:'Invalid origin'},{status:403})
  const client=await createClient(),{data:{user}}=await client.auth.getUser()
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401})
  try{
    const body=await request.json()
    if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.requestId||'')||!Array.isArray(body.picks)||body.picks.length<1||body.picks.length>32)return NextResponse.json({error:'เลือกรอบให้ครบก่อนยืนยัน'},{status:400})
    const result=await checkoutRpc('booking_ux_redeem_many_v3',{p_actor:user.id,p_request:body.requestId,p_picks:body.picks})
    return NextResponse.json(result)
  }catch(e){return NextResponse.json({error:checkoutError(e)},{status:409})}
}

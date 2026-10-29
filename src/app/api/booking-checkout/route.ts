import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { CheckoutRpcError, checkoutError, checkoutRpc, loadBookingPackages } from '@/lib/booking-checkout-server'
import { isSameOriginMutation } from '@/lib/progressive-payment-integration'
import { loadBookingPaymentLifecycle } from '@/lib/booking-payment-lifecycle'
import { normalizePaymentTransferSettings, PAYMENT_TRANSFER_SETTING_KEY, resolveBookingTransferAccounts } from '@/lib/payment-settings'
import { readFutureBranchDateClosures } from '@/lib/branch-date-closures-server'
import { packageExpiryAt, packageRoundWithinExpiry } from '@/lib/booking-package-validity'

const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const privateHeaders = { 'Cache-Control': 'private, no-store' }
interface CheckoutTableClient {
  from(name: string): ReturnType<ReturnType<typeof getServiceRoleClient>['from']>
}

export async function GET(request: NextRequest) {
  const client = await createClient(), { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    if (request.nextUrl.searchParams.get('catalog') === '1') return NextResponse.json({ packages: await loadBookingPackages() }, { headers: privateHeaders })
    const admin = getServiceRoleClient(), db = admin as unknown as CheckoutTableClient
    const prepareRequestId=request.nextUrl.searchParams.get('prepareRequestId')
    if(prepareRequestId){
      if(!uuid.test(prepareRequestId))return NextResponse.json({error:'รหัสคำขอไม่ถูกต้อง'},{status:400})
      const prior=await admin.from('progressive_payment_batches').select('id,status,pricing_scope_id').eq('user_id',user.id).eq('prepare_idempotency_key',prepareRequestId).maybeSingle()
      if(prior.error)throw prior.error
      return NextResponse.json({found:Boolean(prior.data),batch:prior.data},{headers:privateHeaders})
    }
    const requestId = request.nextUrl.searchParams.get('requestId')
    if (requestId) {
      if (!uuid.test(requestId)) return NextResponse.json({ error: 'รหัสคำขอไม่ถูกต้อง' }, { status: 400 })
      const operation=request.nextUrl.searchParams.get('operation')
      if(operation&&!['create','update','child','redeem','set'].includes(operation))return NextResponse.json({error:'ประเภทคำขอไม่ถูกต้อง'},{status:400})
      const { data, error } = await db.from('booking_ux_requests').select('operation,result').eq('actor_id', user.id).eq('request_id', requestId).maybeSingle()
      if (error) throw error
      if(data&&operation&&data.operation!==operation)return NextResponse.json({error:'คำขอเดิมมีประเภทต่างกัน'},{status:409})
      // The released Kids/Legacy editors retain their own durable receipts.
      // Read only the authenticated actor's exact request and bill; never retry a write here.
      if(!data&&operation==='update'){
        const bookingId=request.nextUrl.searchParams.get('bookingId')
        if(!bookingId||!uuid.test(bookingId))return NextResponse.json({error:'รหัสรายการไม่ถูกต้อง'},{status:400})
        const [progressive,legacy]=await Promise.all([
          admin.from('progressive_booking_mutation_receipts').select('result').eq('user_id',user.id).eq('client_request_id',requestId).eq('mutation_type','update').eq('booking_id',bookingId).maybeSingle(),
          admin.from('task10_legacy_booking_mutations').select('result').eq('user_id',user.id).eq('request_id',requestId).eq('booking_id',bookingId).maybeSingle(),
        ])
        if(progressive.error||legacy.error)throw Error('BOOKING_UX_READ_FAILED')
        const receipt=progressive.data||legacy.data
        return NextResponse.json({found:Boolean(receipt),result:receipt?.result},{headers:privateHeaders})
      }
      return NextResponse.json({ found: Boolean(data), result: data?.result }, { headers: privateHeaders })
    }
    const id = request.nextUrl.searchParams.get('bookingId')
    const legacyIds=request.nextUrl.searchParams.get('legacyIds')?.split(',')
    if(legacyIds&&(!legacyIds.length||legacyIds.length>100||legacyIds.some(v=>!uuid.test(v))||new Set(legacyIds).size!==legacyIds.length)||id&&legacyIds)return NextResponse.json({error:'รายการชำระรวมไม่ถูกต้อง'},{status:400})
    if (id && !uuid.test(id)) return NextResponse.json({ error: 'รหัสรายการไม่ถูกต้อง' }, { status: 400 })
    let query = admin.from('bookings').select('*,branches(name),children(full_name,nickname),course_types(name)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(101)
    query = id ? query.eq('id', id) : legacyIds?query.in('id',legacyIds):query.in('status', ['pending_payment', 'paid'])
    const [bookingsResult, setting, branches, learners, profile] = await Promise.all([
      query,
      admin.from('system_settings').select('value').eq('key', PAYMENT_TRANSFER_SETTING_KEY).maybeSingle(),
      admin.from('branches').select('id,name,slug,is_active').order('name'),
      admin.from('children').select('id,full_name,nickname').eq('parent_id',user.id),
      admin.from('profiles').select('full_name').eq('id',user.id).single(),
    ])
    if (bookingsResult.error || setting.error || branches.error || learners.error || profile.error) throw new Error('BOOKING_UX_READ_FAILED')
    const bookings = bookingsResult.data || []
    if(bookings.length>100)throw new Error('BOOKING_UX_SCOPE_LIMIT')
    if(legacyIds&&(bookings.length!==legacyIds.length||bookings.some(b=>b.pricing_scope_id)))return NextResponse.json({error:'ไม่พบรายการชำระรวมของบัญชีนี้'},{status:404})
    if (id && !bookings.length) return NextResponse.json({ error: 'ไม่พบรายการของบัญชีนี้' }, { status: 404 })
    // Progressive payment always expands to its complete current pending scope.
    const scopeId = bookings[0]?.pricing_scope_id
    if (id && scopeId && bookings[0]?.status === 'pending_payment') {
      const scope = await admin.from('bookings').select('*,branches(name),children(full_name,nickname),course_types(name)').eq('user_id', user.id).eq('pricing_scope_id', scopeId).eq('status', 'pending_payment').order('created_at').limit(101)
      if (scope.error || (scope.data?.length || 0) > 100) throw new Error('BOOKING_UX_SCOPE_LIMIT')
      bookings.splice(0, bookings.length, ...(scope.data || []))
    }
    if(id&&scopeId&&['paid','verified'].includes(bookings[0]?.status)){
      const membership=await admin.from('progressive_payment_batch_bookings').select('payment_batch_id,progressive_payment_batches!inner(user_id,status)').eq('booking_id',id).eq('progressive_payment_batches.user_id',user.id).in('progressive_payment_batches.status',['submitted','under_review','approved']).limit(2)
      if(membership.error||(membership.data?.length||0)>1)throw Error('BOOKING_UX_READ_FAILED')
      const batchId=membership.data?.[0]?.payment_batch_id
      if(batchId){
        const members=await admin.from('progressive_payment_batch_bookings').select('booking_id').eq('payment_batch_id',batchId).limit(101)
        if(members.error||!members.data?.length||members.data.length>100)throw Error('BOOKING_UX_SCOPE_LIMIT')
        const grouped=await admin.from('bookings').select('*,branches(name),children(full_name,nickname),course_types(name)').eq('user_id',user.id).in('id',members.data.map(m=>m.booking_id)).order('created_at')
        if(grouped.error||grouped.data?.length!==members.data.length)throw Error('BOOKING_UX_READ_FAILED')
        bookings.splice(0,bookings.length,...(grouped.data||[]))
      }
    }
    if(id&&bookings[0]?.status==='cancelled'){
      const receipt=await db.from('booking_ux_requests').select('result').eq('actor_id',user.id).eq('operation','set').contains('result',{bookingIds:[id],total:0}).order('created_at',{ascending:false}).limit(1).maybeSingle()
      if(receipt.error)throw receipt.error
      const members=(receipt.data?.result as {bookingIds?:unknown})?.bookingIds
      if(Array.isArray(members)&&members.length>0&&members.length<=100&&members.every(v=>typeof v==='string'&&uuid.test(v))){
        const grouped=await admin.from('bookings').select('*,branches(name),children(full_name,nickname),course_types(name)').eq('user_id',user.id).in('id',members).eq('status','cancelled').order('created_at')
        if(grouped.error||grouped.data?.length!==members.length)throw Error('BOOKING_UX_READ_FAILED')
        bookings.splice(0,bookings.length,...grouped.data)
      }
    }
    if (bookings.length > 100) throw new Error('BOOKING_UX_SCOPE_LIMIT')
    const ids = bookings.map(b => b.id), scopeIds = [...new Set(bookings.map(b => b.pricing_scope_id).filter((v): v is string => Boolean(v)))]
    const [life, sessions, payments, scopes, batches, coupons, legacyCoupons] = await Promise.all([
      loadBookingPaymentLifecycle(admin, ids),
      ids.length ? admin.from('booking_sessions').select('id,booking_id,date,start_time,end_time,branch_id,child_id,status,children(full_name,nickname),branches(name)').in('booking_id', ids).order('date').limit(2001) : { data: [], error: null },
      ids.length ? admin.from('payments').select('id,booking_id,status,notes,verified_at,created_at,receipts:task10_accepted_receipts(request_id)').in('booking_id', ids).order('created_at', { ascending: false }).limit(1001) : { data: [], error: null },
      scopeIds.length ? admin.from('booking_pricing_scopes').select('id,revision').in('id', scopeIds) : { data: [], error: null },
      scopeIds.length ? admin.from('progressive_payment_batches').select('id,pricing_scope_id,status,total_amount,prepared_expires_at,created_at,rejection_reason,upload_recorded_at,slipok_response_code,progressive_payment_batch_bookings(booking_id)').eq('user_id', user.id).in('pricing_scope_id', scopeIds).in('status', ['prepared', 'submitted', 'under_review', 'rejected']).order('created_at', { ascending: false }).limit(101) : { data: [], error: null },
      ids.length ? db.from('progressive_coupon_reservations').select('booking_id,coupon_code_snapshot,gross_price_snapshot,discount_amount_snapshot,status,coupons(code)').eq('user_id',user.id).in('booking_id',ids) : { data: [], error: null },
      ids.length ? db.from('coupon_usages').select('booking_id,discount_amount,coupons(code)').eq('user_id',user.id).in('booking_id',ids) : { data: [], error: null },
    ])
    if (sessions.error || payments.error || scopes.error || batches.error || coupons.error || legacyCoupons.error || (sessions.data?.length || 0) > 2000 || (payments.data?.length || 0) > 1000 || (batches.data?.length || 0) > 100) throw new Error('BOOKING_UX_READ_FAILED')
    const couponMap = new Map((coupons.data || []).map(row => [row.booking_id, row]))
    const legacyCouponMap = new Map((legacyCoupons.data || []).map(row => [row.booking_id, row]))
    let editor = null
    if(request.nextUrl.searchParams.get('editor')==='1' && (id || legacyIds) && ids.length){
      const [token,templates,closures]=await Promise.all([checkoutRpc<string>('booking_ux_set_token_v1',{p_actor:user.id,p_ids:ids}),admin.from('schedule_templates').select('id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active,notes,branches(slug),course_types(name)').eq('is_active',true),readFutureBranchDateClosures(admin)])
      if(templates.error)throw templates.error
      editor={token,templates:templates.data,closures}
    }
    const serverNow = new Date().toISOString()
    const approved = new Map<string, string[]>()
    for (const payment of payments.data || []) if (payment.status === 'approved' && payment.verified_at) approved.set(payment.booking_id, [...(approved.get(payment.booking_id) || []), payment.verified_at])
    const expiryByBill = new Map(bookings.map(b => {
      const evidence = approved.get(b.id)
      const confirmed = b.status === 'verified' && evidence?.length === 1
      const terms = b.package_snapshot as { quantity: number; validity_months: number } | null
      if (terms && terms.quantity > 1 && b.status === 'verified' && !confirmed) throw Error('BOOKING_UX_PAYMENT_EVIDENCE_REQUIRED')
      return [b.id, { expiry: packageExpiryAt(terms, confirmed ? evidence[0] : serverNow), estimated: !confirmed }] as const
    }))
    const invalidBills = new Set<string>()
    for (const session of sessions.data || []) if (!['cancelled', 'walleted', 'rescheduled'].includes(session.status) && !packageRoundWithinExpiry(expiryByBill.get(session.booking_id)?.expiry, session.date, session.end_time)) invalidBills.add(session.booking_id)
    return NextResponse.json({ editor, bookings: bookings.map(b => {
      const coupon = couponMap.get(b.id)
      const legacyCoupon = legacyCouponMap.get(b.id)
      const terms = coupon?.coupons as unknown as { code?: string } | null
      const legacyTerms = legacyCoupon?.coupons as unknown as { code?: string } | null
      const discount = coupon ? coupon.status !== 'released' ? Number(coupon.discount_amount_snapshot) : 0 : Number(legacyCoupon?.discount_amount || 0)
      return { ...b, coupon_code: coupon?.coupon_code_snapshot || terms?.code || legacyTerms?.code || null, coupon_gross: coupon && coupon.status !== 'released' ? Number(coupon.gross_price_snapshot) : Number(b.total_price) + discount, coupon_discount: discount, coupon_state: coupon?.status || null,
        lifecycle: life.get(b.id), package_expiry: expiryByBill.get(b.id)?.expiry, package_expiry_estimated: expiryByBill.get(b.id)?.estimated, package_dates_valid: !invalidBills.has(b.id) }
    }), sessions: sessions.data, payments: payments.data, scopes: scopes.data, batches: batches.data,
      transferSettings: normalizePaymentTransferSettings(setting.data?.value, branches.data || []), branches: branches.data, learners:learners.data, userName:profile.data?.full_name||'ตนเอง', serverNow }, { headers: privateHeaders })
  } catch (error) { return NextResponse.json({ error: checkoutError(error) }, { status: 503 }) }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  const client = await createClient(), { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json()
    if(body.action==='set'){
      if(!uuid.test(body.requestId||'')||!body.input||!Array.isArray(body.input.bookingIds))return NextResponse.json({error:'ข้อมูลรายการไม่ครบ'},{status:400})
      const result=await checkoutRpc('booking_ux_edit_set_v1',{p_actor:user.id,p_request:body.requestId,p_input:body.input,p_preview:body.preview===true})
      return NextResponse.json(result,{headers:privateHeaders})
    }
    if (body.action === 'duration') {
      const result = await checkoutRpc('booking_ux_set_duration_v1', { p_actor: user.id, p_id: body.packageId, p_months: body.months, p_revision: body.revision })
      return NextResponse.json({ result }, { headers: privateHeaders })
    }
    if (body.action !== 'create' || !uuid.test(body.requestId || '') || !body.input || typeof body.input !== 'object') return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })
    if (Number(body.input.expectedTotalPrice) > 0) {
      const admin=getServiceRoleClient()
      const [settings,branches]=await Promise.all([admin.from('system_settings').select('value').eq('key',PAYMENT_TRANSFER_SETTING_KEY).maybeSingle(),admin.from('branches').select('id,name,slug,is_active')])
      if(settings.error||branches.error)throw Error('BOOKING_UX_READ_FAILED')
      const roster=branches.data||[],transfer=normalizePaymentTransferSettings(settings.data?.value,roster)
      const sessions=Array.isArray(body.input.sessions)?body.input.sessions.map((s:{branchId:string})=>({booking_id:'new',branch_id:s.branchId,status:'scheduled'})):[]
      const result=resolveBookingTransferAccounts(transfer,roster,['new'],[{id:'new',branch_id:body.input.branchId,status:'pending_payment'}],{new:sessions})
      if(result.issues.length||!result.cards.length)return NextResponse.json({error:'ยังไม่มีข้อมูลบัญชีรับเงินที่ถูกต้องสำหรับสาขานี้ กรุณาติดต่อเจ้าหน้าที่ก่อนเริ่มชำระ'},{status:409})
    }
    const result = await checkoutRpc('booking_ux_create_v1', { p_actor: user.id, p_request: body.requestId, p_input: body.input })
    return NextResponse.json(result, { headers: privateHeaders })
  } catch (error) { const definitive=error instanceof CheckoutRpcError&&error.definitive;return NextResponse.json({ error: checkoutError(error),definitive,requiresReadback:error instanceof CheckoutRpcError&&error.requiresReadback }, { status: definitive?409:503 }) }
}

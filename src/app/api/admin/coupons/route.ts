import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { logActivity } from '@/lib/activity-log'

type DiscountType = 'fixed' | 'percent'

interface ProfileRole {
  role: string
}

interface CouponPayload {
  code?: string
  discountType?: DiscountType
  discountValue?: number
  minPurchase?: number | null
  maxUses?: number | null
  validFrom?: string | null
  validTo?: string | null
  isActive?: boolean
}

interface PatchPayload extends CouponPayload {
  couponId?: string
}

interface DbError {
  message: string
}

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Supabase admin env is not configured')
  return createAdminClient(url, serviceKey)
}

async function requireAdmin(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as unknown as { data: ProfileRole | null }

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) return null
  return user
}

function normalizeCode(code?: string) {
  return code?.trim().toUpperCase().replace(/\s+/g, '')
}

function normalizeNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null
  return Number(value)
}

function validateCouponPayload(payload: CouponPayload, mode: 'create' | 'update') {
  const code = normalizeCode(payload.code)
  const discountValue = normalizeNumber(payload.discountValue)
  const minPurchase = normalizeNumber(payload.minPurchase)
  const maxUses = normalizeNumber(payload.maxUses)

  if (mode === 'create' && !code) return { error: 'กรุณากรอกรหัสคูปอง' }
  if (code && !/^[A-Z0-9_-]{3,32}$/.test(code)) return { error: 'รหัสคูปองต้องเป็น A-Z, 0-9, _ หรือ - ความยาว 3-32 ตัวอักษร' }
  if (payload.discountType && !['fixed', 'percent'].includes(payload.discountType)) return { error: 'ประเภทส่วนลดไม่ถูกต้อง' }
  if (mode === 'create' && !payload.discountType) return { error: 'กรุณาเลือกประเภทส่วนลด' }
  if (mode === 'create' && (!discountValue || discountValue <= 0)) return { error: 'กรุณากรอกมูลค่าส่วนลดมากกว่า 0' }
  if (discountValue !== null && discountValue <= 0) return { error: 'มูลค่าส่วนลดต้องมากกว่า 0' }
  if (payload.discountType === 'percent' && discountValue !== null && (discountValue < 1 || discountValue > 100)) return { error: 'ส่วนลดแบบเปอร์เซ็นต์ต้องอยู่ระหว่าง 1-100' }
  if (minPurchase !== null && minPurchase < 0) return { error: 'ยอดขั้นต่ำต้องไม่ติดลบ' }
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) return { error: 'จำนวนครั้งที่ใช้ได้ต้องเป็นเลขจำนวนเต็มมากกว่า 0' }
  if (payload.validFrom && payload.validTo && payload.validTo < payload.validFrom) return { error: 'วันหมดอายุต้องไม่อยู่ก่อนวันเริ่มใช้งาน' }

  return {
    value: {
      code,
      discountType: payload.discountType,
      discountValue,
      minPurchase,
      maxUses,
      validFrom: payload.validFrom || null,
      validTo: payload.validTo || null,
      isActive: payload.isActive,
    },
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const payload = await request.json() as CouponPayload
    const parsed = validateCouponPayload(payload, 'create')
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

    const coupon = parsed.value
    const adminSupabase = getAdminSupabase()
    const { data, error } = await adminSupabase
      .from('coupons')
      .insert({
        code: coupon.code,
        discount_type: coupon.discountType,
        discount_value: coupon.discountValue,
        min_purchase: coupon.minPurchase,
        max_uses: coupon.maxUses,
        valid_from: coupon.validFrom || new Date().toISOString().split('T')[0],
        valid_to: coupon.validTo,
        created_by: admin.id,
        is_active: coupon.isActive ?? true,
      })
      .select('id')
      .single() as unknown as { data: { id: string } | null; error: DbError | null }

    if (error) {
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        return NextResponse.json({ error: `รหัสคูปอง "${coupon.code}" มีอยู่แล้ว` }, { status: 409 })
      }
      return NextResponse.json({ error: `สร้างคูปองไม่สำเร็จ: ${error.message}` }, { status: 500 })
    }

    await logActivity({
      userId: admin.id,
      action: 'create_coupon',
      entityType: 'coupon',
      entityId: data?.id || null,
      details: coupon,
      ipAddress: request.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({ success: true, couponId: data?.id })
  } catch (error) {
    console.error('Create coupon error:', error)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${getErrorMessage(error)}` }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const payload = await request.json() as PatchPayload
    if (!payload.couponId) return NextResponse.json({ error: 'couponId is required' }, { status: 400 })

    const parsed = validateCouponPayload(payload, 'update')
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

    const coupon = parsed.value
    const updates: Record<string, string | number | boolean | null> = {}
    if (coupon.code) updates.code = coupon.code
    if (coupon.discountType !== undefined) updates.discount_type = coupon.discountType
    if (coupon.discountValue !== null) updates.discount_value = coupon.discountValue
    if (payload.minPurchase !== undefined) updates.min_purchase = coupon.minPurchase
    if (payload.maxUses !== undefined) updates.max_uses = coupon.maxUses
    if (payload.validFrom !== undefined) updates.valid_from = coupon.validFrom || new Date().toISOString().split('T')[0]
    if (payload.validTo !== undefined) updates.valid_to = coupon.validTo
    if (coupon.isActive !== undefined) updates.is_active = coupon.isActive

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'ไม่มีข้อมูลที่จะอัปเดต' }, { status: 400 })
    }

    const adminSupabase = getAdminSupabase()
    const { error } = await adminSupabase
      .from('coupons')
      .update(updates)
      .eq('id', payload.couponId) as unknown as { error: DbError | null }

    if (error) {
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        return NextResponse.json({ error: `รหัสคูปอง "${coupon.code}" มีอยู่แล้ว` }, { status: 409 })
      }
      return NextResponse.json({ error: `อัปเดตไม่สำเร็จ: ${error.message}` }, { status: 500 })
    }

    await logActivity({
      userId: admin.id,
      action: 'update_coupon',
      entityType: 'coupon',
      entityId: payload.couponId,
      details: updates,
      ipAddress: request.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update coupon error:', error)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${getErrorMessage(error)}` }, { status: 500 })
  }
}

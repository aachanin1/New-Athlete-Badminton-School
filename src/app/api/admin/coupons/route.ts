import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createAdminClient(url, serviceKey)
}

async function requireAdmin(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single() as any
  if (!profile || !['admin', 'super_admin'].includes(profile.role)) return null
  return user
}

// POST: Create a new coupon
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { code, discountType, discountValue, minPurchase, maxUses, validFrom, validTo } = body

    if (!code || !discountType || !discountValue) {
      return NextResponse.json({ error: 'กรุณากรอก code, ประเภทส่วนลด, และมูลค่าส่วนลด' }, { status: 400 })
    }

    if (!['fixed', 'percent'].includes(discountType)) {
      return NextResponse.json({ error: 'ประเภทส่วนลดต้องเป็น fixed หรือ percent' }, { status: 400 })
    }

    if (discountType === 'percent' && (discountValue < 1 || discountValue > 100)) {
      return NextResponse.json({ error: 'เปอร์เซ็นต์ต้องอยู่ระหว่าง 1-100' }, { status: 400 })
    }

    const adminSupabase = getAdminSupabase()

    const { data, error: insertErr } = await adminSupabase
      .from('coupons')
      .insert({
        code: code.trim().toUpperCase(),
        discount_type: discountType,
        discount_value: discountValue,
        min_purchase: minPurchase || null,
        max_uses: maxUses || null,
        valid_from: validFrom || new Date().toISOString().split('T')[0],
        valid_to: validTo || null,
        created_by: admin.id,
        is_active: true,
      })
      .select('id')
      .single() as any

    if (insertErr) {
      if (insertErr.message.includes('unique') || insertErr.message.includes('duplicate')) {
        return NextResponse.json({ error: `รหัสคูปอง "${code}" มีอยู่แล้ว` }, { status: 409 })
      }
      return NextResponse.json({ error: `สร้างคูปองไม่สำเร็จ: ${insertErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, couponId: data.id })
  } catch (err: any) {
    console.error('Create coupon error:', err)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${err.message}` }, { status: 500 })
  }
}

// PATCH: Toggle active / update coupon
export async function PATCH(request: NextRequest) {
  const supabase = createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { couponId, isActive, maxUses, validTo } = body

    if (!couponId) {
      return NextResponse.json({ error: 'couponId is required' }, { status: 400 })
    }

    const adminSupabase = getAdminSupabase()
    const updates: Record<string, any> = {}
    if (isActive !== undefined) updates.is_active = isActive
    if (maxUses !== undefined) updates.max_uses = maxUses || null
    if (validTo !== undefined) updates.valid_to = validTo || null

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'ไม่มีข้อมูลที่จะอัปเดต' }, { status: 400 })
    }

    const { error: updateErr } = await adminSupabase
      .from('coupons')
      .update(updates)
      .eq('id', couponId)

    if (updateErr) {
      return NextResponse.json({ error: `อัปเดตไม่สำเร็จ: ${updateErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Update coupon error:', err)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${err.message}` }, { status: 500 })
  }
}

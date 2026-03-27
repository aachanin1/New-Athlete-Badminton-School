import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireSuperAdminUser } from '@/lib/auth/admin'

// POST — create new setting
export async function POST(req: NextRequest) {
  const admin = await requireSuperAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { key, value } = body
    const supabaseAdmin = getServiceRoleClient()

    if (!key?.trim()) {
      return NextResponse.json({ error: 'กรุณากรอก key' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .insert({ key: key.trim(), value: value ?? {}, updated_by: admin.user.id })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH — update setting
export async function PATCH(req: NextRequest) {
  const admin = await requireSuperAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { id, key, value } = body
    const supabaseAdmin = getServiceRoleClient()

    if (!id && !key) {
      return NextResponse.json({ error: 'ไม่พบ setting ID หรือ key' }, { status: 400 })
    }

    const query = supabaseAdmin.from('system_settings').update({ value: value ?? {}, updated_by: admin.user.id })

    if (id) {
      query.eq('id', id)
    } else {
      query.eq('key', key)
    }

    const { data, error } = await query.select().single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

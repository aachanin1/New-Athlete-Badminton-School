import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireAdminUser } from '@/lib/auth/admin'

// POST — create new branch
export async function POST(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const supabaseAdmin = getServiceRoleClient()
    const body = await req.json()
    const { name, address, is_active } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อสาขา' }, { status: 400 })
    }

    // Generate slug from name
    const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-\u0E00-\u0E7F]/g, '')

    const { data, error } = await supabaseAdmin
      .from('branches')
      .insert({ name: name.trim(), slug, address, is_active: is_active ?? true })
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

// PATCH — update branch
export async function PATCH(req: NextRequest) {
  const admin = await requireAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const supabaseAdmin = getServiceRoleClient()
    const body = await req.json()
    const { id, name, address, is_active } = body

    if (!id) {
      return NextResponse.json({ error: 'ไม่พบ branch ID' }, { status: 400 })
    }

    const updates: any = {}
    if (name !== undefined) updates.name = name.trim()
    if (address !== undefined) updates.address = address
    if (is_active !== undefined) updates.is_active = is_active

    const { data, error } = await supabaseAdmin
      .from('branches')
      .update(updates)
      .eq('id', id)
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

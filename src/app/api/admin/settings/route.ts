import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST — create new setting
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { key, value } = body

    if (!key?.trim()) {
      return NextResponse.json({ error: 'กรุณากรอก key' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .insert({ key: key.trim(), value: value ?? {} })
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
  try {
    const body = await req.json()
    const { id, key, value } = body

    if (!id && !key) {
      return NextResponse.json({ error: 'ไม่พบ setting ID หรือ key' }, { status: 400 })
    }

    const query = supabaseAdmin.from('system_settings').update({ value: value ?? {} })

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

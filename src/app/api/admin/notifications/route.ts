import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST — send notification to user(s)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { user_id, title, message, type } = body

    if (!title?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'กรุณากรอกหัวข้อและข้อความ' }, { status: 400 })
    }

    const notifType = type || 'system'

    // If user_id is 'all' or null, send to all users
    if (!user_id || user_id === 'all') {
      const { data: users } = await supabaseAdmin
        .from('profiles')
        .select('id')

      const inserts = (users || []).map((u: any) => ({
        user_id: u.id,
        title: title.trim(),
        message: message.trim(),
        type: notifType,
      }))

      if (inserts.length > 0) {
        const { error } = await supabaseAdmin
          .from('notifications')
          .insert(inserts)

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 })
        }
      }

      return NextResponse.json({ success: true, sent_to: inserts.length })
    }

    // Send to specific user
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id,
        title: title.trim(),
        message: message.trim(),
        type: notifType,
      })
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

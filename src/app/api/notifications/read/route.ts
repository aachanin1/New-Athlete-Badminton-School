import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { notificationId, markAll } = await request.json()

    let query = (supabase.from('notifications') as any)
      .update({ is_read: true })
      .eq('user_id', user.id)

    if (markAll) {
      query = query.eq('is_read', false)
    } else if (notificationId) {
      query = query.eq('id', notificationId)
    } else {
      return NextResponse.json({ error: 'ต้องส่ง notificationId หรือ markAll' }, { status: 400 })
    }

    const { error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

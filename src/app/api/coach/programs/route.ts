import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { notifyRoles } from '@/lib/notifications'

async function requireCoach(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single() as any
  if (!profile || !['coach', 'head_coach', 'admin', 'super_admin'].includes(profile.role)) return null
  return user
}

// POST: Create or update a teaching program
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const coach = await requireCoach(supabase)
  if (!coach) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { programId, programContent, status } = await request.json()

    if (!programContent) {
      return NextResponse.json({ error: 'กรุณากรอกเนื้อหาโปรแกรม' }, { status: 400 })
    }

    if (programId) {
      // Update existing
      const { error: updateErr } = await (supabase.from('teaching_programs') as any)
        .update({
          program_content: programContent,
          status: status || 'draft',
          updated_at: new Date().toISOString(),
        })
        .eq('id', programId)
        .eq('coach_id', coach.id)

      if (updateErr) {
        return NextResponse.json({ error: `อัปเดตไม่สำเร็จ: ${updateErr.message}` }, { status: 500 })
      }
    } else {
      // Create new (without schedule_slot_id for now — general program)
      const { error: insertErr } = await (supabase.from('teaching_programs') as any).insert({
        coach_id: coach.id,
        program_content: programContent,
        status: status || 'draft',
      })

      if (insertErr) {
        return NextResponse.json({ error: `สร้างไม่สำเร็จ: ${insertErr.message}` }, { status: 500 })
      }
    }

    if (status === 'submitted') {
      const adminSupabase = getServiceRoleClient()
      const { data: profile } = await ((adminSupabase
        .from('profiles')
        .select('full_name')
        .eq('id', coach.id)
        .single()) as any)

      await notifyRoles(adminSupabase as any, {
        roles: ['super_admin'],
        title: 'โปรแกรมสอนรอตรวจ',
        message: `${profile?.full_name || 'โค้ช'} ส่งโปรแกรมสอนเข้าตรวจแล้ว`,
        type: 'system',
        link_url: '/admin/logs',
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Program error:', err)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${err.message}` }, { status: 500 })
  }
}

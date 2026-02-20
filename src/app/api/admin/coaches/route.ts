import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

// Admin-only API: create coach account, update role, manage coach_branches
// Uses service_role key to create auth users

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

// POST: Create a new coach account
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { email, password, full_name, phone, role, branchIds } = body

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ (email, password, ชื่อ)' }, { status: 400 })
    }

    if (!['coach', 'head_coach'].includes(role)) {
      return NextResponse.json({ error: 'role ต้องเป็น coach หรือ head_coach' }, { status: 400 })
    }

    const adminSupabase = getAdminSupabase()

    // Create auth user
    const { data: authData, error: authErr } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })

    if (authErr) {
      if (authErr.message.includes('already been registered')) {
        return NextResponse.json({ error: 'อีเมลนี้มีในระบบแล้ว' }, { status: 409 })
      }
      return NextResponse.json({ error: `สร้างบัญชีไม่สำเร็จ: ${authErr.message}` }, { status: 500 })
    }

    const userId = authData.user.id

    // Update profile role & phone (profile auto-created by trigger)
    await adminSupabase
      .from('profiles')
      .update({ role, phone: phone || null })
      .eq('id', userId)

    // Insert coach_branches
    if (branchIds && branchIds.length > 0) {
      const rows = branchIds.map((bid: string) => ({
        coach_id: userId,
        branch_id: bid,
        is_head_coach: role === 'head_coach',
      }))
      await adminSupabase.from('coach_branches').insert(rows)
    }

    return NextResponse.json({ success: true, userId })
  } catch (err: any) {
    console.error('Create coach error:', err)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${err.message}` }, { status: 500 })
  }
}

// PATCH: Update coach role or branches
export async function PATCH(request: NextRequest) {
  const supabase = createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { coachId, role, phone, branchIds } = body

    if (!coachId) {
      return NextResponse.json({ error: 'coachId is required' }, { status: 400 })
    }

    const adminSupabase = getAdminSupabase()

    // Update profile
    const updates: Record<string, any> = {}
    if (role && ['coach', 'head_coach', 'user'].includes(role)) updates.role = role
    if (phone !== undefined) updates.phone = phone || null

    if (Object.keys(updates).length > 0) {
      await adminSupabase.from('profiles').update(updates).eq('id', coachId)
    }

    // Update branches if provided
    if (branchIds !== undefined) {
      // Remove all existing
      await adminSupabase.from('coach_branches').delete().eq('coach_id', coachId)
      // Insert new
      if (branchIds.length > 0) {
        const isHead = (role || 'coach') === 'head_coach'
        const rows = branchIds.map((bid: string) => ({
          coach_id: coachId,
          branch_id: bid,
          is_head_coach: isHead,
        }))
        await adminSupabase.from('coach_branches').insert(rows)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Update coach error:', err)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${err.message}` }, { status: 500 })
  }
}

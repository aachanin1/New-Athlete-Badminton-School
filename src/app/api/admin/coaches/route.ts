import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireAdminMenuAccess } from '@/lib/auth/admin'
import { normalizeCoachEmploymentType } from '@/lib/coach-teaching-rules'

// Admin-only API: create coach account, update role, manage coach_branches
// Uses service_role key to create auth users

// POST: Create a new coach account
export async function POST(request: NextRequest) {
  const access = await requireAdminMenuAccess('coaches')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })

  try {
    const body = await request.json()
    const { email, password, full_name, phone, role, branchIds, employmentType } = body

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ (email, password, ชื่อ)' }, { status: 400 })
    }

    if (!['coach', 'head_coach'].includes(role)) {
      return NextResponse.json({ error: 'role ต้องเป็น coach หรือ head_coach' }, { status: 400 })
    }

    const coachEmploymentType = normalizeCoachEmploymentType(employmentType)
    const adminSupabase = getServiceRoleClient()

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
      .update({ role, phone: phone || null, coach_employment_type: coachEmploymentType })
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error('Create coach error:', err)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${err.message}` }, { status: 500 })
  }
}

// PATCH: Update coach role or branches
export async function PATCH(request: NextRequest) {
  const access = await requireAdminMenuAccess('coaches')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })

  try {
    const body = await request.json()
    const { coachId, role, phone, branchIds, employmentType } = body

    if (!coachId) {
      return NextResponse.json({ error: 'coachId is required' }, { status: 400 })
    }

    const adminSupabase = getServiceRoleClient()

    // Update profile
    const updates: Record<string, string | null> = {}
    if (role && ['coach', 'head_coach', 'user'].includes(role)) updates.role = role
    if (phone !== undefined) updates.phone = phone || null
    if (employmentType !== undefined) updates.coach_employment_type = normalizeCoachEmploymentType(employmentType)
    if (role === 'user') updates.coach_employment_type = null

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    console.error('Update coach error:', err)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${err.message}` }, { status: 500 })
  }
}

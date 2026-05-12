import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { logActivity } from '@/lib/activity-log'

interface ProfileRole {
  role: string
}

interface CoachAssignmentRow {
  schedule_slot_id: string
}

interface ScheduleSlotRow {
  id: string
  branch_id: string
  date: string
  start_time: string
  end_time: string
}

interface ExistingCheckinRow {
  id: string
}

interface CheckinInsertRow {
  id: string
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
}

async function requireCoach(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as unknown as { data: ProfileRole | null }

  if (!profile || !['coach', 'head_coach', 'admin', 'super_admin'].includes(profile.role)) return null
  return user
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const coach = await requireCoach(supabase)
  if (!coach) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const adminSupabase = getServiceRoleClient()
    const formData = await request.formData()
    const scheduleSlotId = formData.get('scheduleSlotId') as string | null
    const lat = formData.get('lat') as string | null
    const lng = formData.get('lng') as string | null
    const photo = formData.get('photo')

    if (!scheduleSlotId) {
      return NextResponse.json({ error: 'กรุณาเลือกรอบสอน' }, { status: 400 })
    }

    if (!(photo instanceof File) || photo.size <= 0) {
      return NextResponse.json({ error: 'กรุณาแนบรูปเซลฟี่หรือรูปตัวเองก่อนเช็คอิน' }, { status: 400 })
    }

    if (!photo.type.startsWith('image/')) {
      return NextResponse.json({ error: 'ไฟล์เช็คอินต้องเป็นรูปภาพเท่านั้น' }, { status: 400 })
    }

    const { data: assignment } = await adminSupabase
      .from('coach_assignments')
      .select('schedule_slot_id')
      .eq('coach_id', coach.id)
      .eq('schedule_slot_id', scheduleSlotId)
      .maybeSingle<CoachAssignmentRow>()

    if (!assignment) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์เช็คอินรอบนี้' }, { status: 403 })
    }

    const { data: slot, error: slotError } = await adminSupabase
      .from('schedule_slots')
      .select('id, branch_id, date, start_time, end_time')
      .eq('id', scheduleSlotId)
      .single<ScheduleSlotRow>()

    if (slotError || !slot) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลรอบสอน' }, { status: 404 })
    }

    const now = new Date()
    const today = now.toISOString().split('T')[0]
    if (slot.date !== today) {
      return NextResponse.json({ error: 'เช็คอินได้เฉพาะรอบสอนของวันนี้' }, { status: 400 })
    }

    const startDate = new Date(`${slot.date}T${slot.start_time}`)
    const endDate = new Date(`${slot.date}T${slot.end_time}`)
    const earliestCheckin = new Date(startDate.getTime() - (120 * 60 * 1000))
    const latestCheckin = new Date(endDate.getTime() + (15 * 60 * 1000))

    if (now < earliestCheckin || now > latestCheckin) {
      return NextResponse.json({ error: 'เช็คอินได้เฉพาะช่วงก่อนเริ่มสอนและระหว่างรอบสอนของตัวเอง' }, { status: 400 })
    }

    const { data: existingCheckin } = await adminSupabase
      .from('coach_checkins')
      .select('id')
      .eq('coach_id', coach.id)
      .eq('schedule_slot_id', scheduleSlotId)
      .maybeSingle<ExistingCheckinRow>()

    if (existingCheckin) {
      return NextResponse.json({ error: 'คุณเช็คอินรอบนี้ไปแล้ว' }, { status: 400 })
    }

    const ext = photo.name.split('.').pop() || 'jpg'
    const fileName = `checkins/${coach.id}/${scheduleSlotId}-${Date.now()}.${ext}`
    const buffer = Buffer.from(await photo.arrayBuffer())

    const { error: uploadError } = await adminSupabase.storage
      .from('coach-checkins')
      .upload(fileName, buffer, {
        contentType: photo.type,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: `อัปโหลดรูปไม่สำเร็จ: ${uploadError.message}` }, { status: 500 })
    }

    const { data: urlData } = adminSupabase.storage.from('coach-checkins').getPublicUrl(fileName)
    const photoUrl = urlData?.publicUrl || null

    if (!photoUrl) {
      return NextResponse.json({ error: 'ไม่สามารถสร้าง URL รูปเช็คอินได้' }, { status: 500 })
    }

    const { data: checkinRow, error: insertError } = await adminSupabase
      .from('coach_checkins')
      .insert({
        coach_id: coach.id,
        schedule_slot_id: scheduleSlotId,
        branch_id: slot.branch_id,
        checkin_time: now.toISOString(),
        photo_url: photoUrl,
        location_lat: lat ? parseFloat(lat) : null,
        location_lng: lng ? parseFloat(lng) : null,
      })
      .select('id')
      .single<CheckinInsertRow>()

    if (insertError) {
      return NextResponse.json({ error: `เช็คอินไม่สำเร็จ: ${insertError.message}` }, { status: 500 })
    }

    await logActivity({
      userId: coach.id,
      action: 'coach_checkin',
      entityType: 'coach_checkin',
      entityId: checkinRow?.id || null,
      details: {
        scheduleSlotId,
        branchId: slot.branch_id,
        hasPhoto: true,
      },
      ipAddress: request.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({ success: true, photoUrl })
  } catch (error) {
    console.error('Checkin error:', error)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${getErrorMessage(error)}` }, { status: 500 })
  }
}

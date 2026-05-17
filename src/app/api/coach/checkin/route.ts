import { NextRequest, NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity-log'
import { getServiceRoleClient } from '@/lib/auth/admin'
import { notifyCoachCheckinAttendanceReminder } from '@/lib/coach-notifications'
import { createClient } from '@/lib/supabase/server'
import { getBangkokDateString } from '@/lib/utils'
import type { UserRole } from '@/types/database'

const MAX_PHOTO_SIZE_BYTES = 10 * 1024 * 1024
const CHECKIN_BUCKET = 'coach-checkins'
const CHECKIN_WINDOW_MINUTES = 30
const REQUIRED_PHOTO_SOURCE = 'camera_capture'

interface ProfileRole {
  role: UserRole
}

interface ScheduleSlotRow {
  id: string
  branch_id: string
  date: string
  start_time: string
  end_time: string
  branches?: { name: string | null } | null
  course_types?: { name: string | null } | null
}

interface ExistingCheckinRow {
  id: string
}

interface CheckinInsertRow {
  id: string
}

interface GroupAssignmentRow {
  id: string
  coach_id: string | null
}

interface LegacyAssignmentRow {
  schedule_slot_id: string
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
}

function createBangkokDateTime(date: string, time: string) {
  return new Date(`${date}T${time.slice(0, 8)}+07:00`)
}

function getSafeImageExtension(file: File) {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/gif') return 'gif'
  return 'jpg'
}

function parseCoordinate(value: string | null, min: number, max: number) {
  if (!value) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null
  return parsed
}

async function requireCoach(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single() as unknown as { data: ProfileRole | null }

  if (!profile || !['coach', 'head_coach'].includes(profile.role)) return null
  return { user, role: profile.role }
}

async function canCoachCheckinSlot(
  adminSupabase: ReturnType<typeof getServiceRoleClient>,
  coachId: string,
  scheduleSlotId: string,
) {
  const { data: groupRows } = await adminSupabase
    .from('coach_assignment_groups')
    .select('id, coach_id')
    .eq('schedule_slot_id', scheduleSlotId) as unknown as { data: GroupAssignmentRow[] | null }

  const groups = groupRows || []
  if (groups.length > 0) {
    return groups.some((group) => group.coach_id === coachId)
  }

  const { data: assignment } = await adminSupabase
    .from('coach_assignments')
    .select('schedule_slot_id')
    .eq('coach_id', coachId)
    .eq('schedule_slot_id', scheduleSlotId)
    .maybeSingle<LegacyAssignmentRow>()

  return Boolean(assignment)
}

function validatePhoto(photo: FormDataEntryValue | null) {
  if (!(photo instanceof File) || photo.size <= 0) {
    return { photo: null, error: 'กรุณาถ่ายเซลฟี่จากกล้องหน้าก่อนเช็คอิน' }
  }

  if (!photo.type.startsWith('image/')) {
    return { photo: null, error: 'ไฟล์เช็คอินต้องเป็นรูปภาพเท่านั้น' }
  }

  if (photo.size > MAX_PHOTO_SIZE_BYTES) {
    return { photo: null, error: 'รูปเช็คอินต้องมีขนาดไม่เกิน 10 MB' }
  }

  return { photo, error: null }
}

function validateCheckinWindow(now: Date, slot: ScheduleSlotRow) {
  const startDate = createBangkokDateTime(slot.date, slot.start_time)
  const earliestCheckin = new Date(startDate.getTime() - (CHECKIN_WINDOW_MINUTES * 60 * 1000))
  const latestCheckin = new Date(startDate.getTime() + (CHECKIN_WINDOW_MINUTES * 60 * 1000))

  return now >= earliestCheckin && now <= latestCheckin
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const coach = await requireCoach(supabase)
  if (!coach) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let uploadedPath: string | null = null

  try {
    const adminSupabase = getServiceRoleClient()
    const formData = await request.formData()
    const scheduleSlotId = formData.get('scheduleSlotId') as string | null
    const lat = parseCoordinate(formData.get('lat') as string | null, -90, 90)
    const lng = parseCoordinate(formData.get('lng') as string | null, -180, 180)
    const photoSource = formData.get('photoSource') as string | null
    const photoValidation = validatePhoto(formData.get('photo'))

    if (!scheduleSlotId) {
      return NextResponse.json({ error: 'กรุณาเลือกรอบสอน' }, { status: 400 })
    }

    if (photoSource !== REQUIRED_PHOTO_SOURCE) {
      return NextResponse.json({ error: 'ต้องถ่ายเซลฟี่จากกล้องหน้าในระบบเท่านั้น ไม่สามารถเลือกไฟล์รูปจากเครื่องได้' }, { status: 400 })
    }

    if (lat === null || lng === null) {
      return NextResponse.json({ error: 'กรุณาอนุญาตตำแหน่งที่ตั้งก่อนเช็คอิน' }, { status: 400 })
    }

    if (photoValidation.error || !photoValidation.photo) {
      return NextResponse.json({ error: photoValidation.error }, { status: 400 })
    }

    const hasPermission = await canCoachCheckinSlot(adminSupabase, coach.user.id, scheduleSlotId)
    if (!hasPermission) {
      return NextResponse.json({ error: 'คุณไม่มีสิทธิ์เช็คอินรอบนี้' }, { status: 403 })
    }

    const { data: slot, error: slotError } = await adminSupabase
      .from('schedule_slots')
      .select(`
        id,
        branch_id,
        date,
        start_time,
        end_time,
        branches(name),
        course_types(name)
      `)
      .eq('id', scheduleSlotId)
      .single<ScheduleSlotRow>()

    if (slotError || !slot) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลรอบสอน' }, { status: 404 })
    }

    const now = new Date()
    const today = getBangkokDateString(now)
    if (slot.date !== today) {
      return NextResponse.json({ error: 'เช็คอินได้เฉพาะรอบสอนของวันนี้' }, { status: 400 })
    }

    if (!validateCheckinWindow(now, slot)) {
      return NextResponse.json({ error: 'เช็คอินได้ตั้งแต่ก่อนเริ่มสอน 30 นาที ถึงหลังเริ่มสอน 30 นาทีเท่านั้น' }, { status: 400 })
    }

    const { data: existingCheckin } = await adminSupabase
      .from('coach_checkins')
      .select('id')
      .eq('coach_id', coach.user.id)
      .eq('schedule_slot_id', scheduleSlotId)
      .maybeSingle<ExistingCheckinRow>()

    if (existingCheckin) {
      return NextResponse.json({ error: 'คุณเช็คอินรอบนี้ไปแล้ว' }, { status: 400 })
    }

    const ext = getSafeImageExtension(photoValidation.photo)
    uploadedPath = `checkins/${coach.user.id}/${scheduleSlotId}-${Date.now()}.${ext}`
    const buffer = Buffer.from(await photoValidation.photo.arrayBuffer())

    const { error: uploadError } = await adminSupabase.storage
      .from(CHECKIN_BUCKET)
      .upload(uploadedPath, buffer, {
        contentType: photoValidation.photo.type,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: `อัปโหลดรูปไม่สำเร็จ: ${uploadError.message}` }, { status: 500 })
    }

    const { data: urlData } = adminSupabase.storage.from(CHECKIN_BUCKET).getPublicUrl(uploadedPath)
    const photoUrl = urlData?.publicUrl || null

    if (!photoUrl) {
      await adminSupabase.storage.from(CHECKIN_BUCKET).remove([uploadedPath])
      uploadedPath = null
      return NextResponse.json({ error: 'ไม่สามารถสร้าง URL รูปเช็คอินได้' }, { status: 500 })
    }

    const { data: checkinRow, error: insertError } = await adminSupabase
      .from('coach_checkins')
      .insert({
        coach_id: coach.user.id,
        schedule_slot_id: scheduleSlotId,
        branch_id: slot.branch_id,
        checkin_time: now.toISOString(),
        photo_url: photoUrl,
        location_lat: lat,
        location_lng: lng,
      })
      .select('id')
      .single<CheckinInsertRow>()

    if (insertError) {
      await adminSupabase.storage.from(CHECKIN_BUCKET).remove([uploadedPath])
      uploadedPath = null
      return NextResponse.json({ error: `เช็คอินไม่สำเร็จ: ${insertError.message}` }, { status: 500 })
    }

    await logActivity({
      userId: coach.user.id,
      action: 'coach_checkin',
      entityType: 'coach_checkin',
      entityId: checkinRow?.id || null,
      details: {
        scheduleSlotId,
        branchId: slot.branch_id,
        hasPhoto: true,
        photoRequired: true,
        photoSource,
        locationRequired: true,
        lat,
        lng,
        checkinWindowMinutes: CHECKIN_WINDOW_MINUTES,
        source: 'assigned_slot_checkin',
      },
      ipAddress: request.headers.get('x-forwarded-for'),
    })

    await notifyCoachCheckinAttendanceReminder(adminSupabase, coach.user.id, slot)

    return NextResponse.json({ success: true, photoUrl })
  } catch (error) {
    if (uploadedPath) {
      try {
        await getServiceRoleClient().storage.from(CHECKIN_BUCKET).remove([uploadedPath])
      } catch {
        // Best-effort cleanup only.
      }
    }
    console.error('Checkin error:', error)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${getErrorMessage(error)}` }, { status: 500 })
  }
}

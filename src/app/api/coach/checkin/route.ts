import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function requireCoach(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single() as any
  if (!profile || !['coach', 'head_coach', 'admin', 'super_admin'].includes(profile.role)) return null
  return user
}

// POST: Create a check-in record with optional photo
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const coach = await requireCoach(supabase)
  if (!coach) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await request.formData()
    const branchId = formData.get('branchId') as string
    const lat = formData.get('lat') as string | null
    const lng = formData.get('lng') as string | null
    const photo = formData.get('photo') as File | null

    if (!branchId) {
      return NextResponse.json({ error: 'กรุณาเลือกสาขา' }, { status: 400 })
    }

    let photoUrl: string | null = null

    // Upload photo if provided
    if (photo && photo.size > 0) {
      const ext = photo.name.split('.').pop() || 'jpg'
      const fileName = `checkins/${coach.id}/${Date.now()}.${ext}`
      const buffer = Buffer.from(await photo.arrayBuffer())

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('coach-checkins')
        .upload(fileName, buffer, {
          contentType: photo.type,
          upsert: false,
        })

      if (uploadErr) {
        console.error('Upload error:', uploadErr)
        // Continue without photo
      } else {
        const { data: urlData } = supabase.storage.from('coach-checkins').getPublicUrl(fileName)
        photoUrl = urlData?.publicUrl || null
      }
    }

    const { error: insertErr } = await (supabase.from('coach_checkins') as any).insert({
      coach_id: coach.id,
      branch_id: branchId,
      checkin_time: new Date().toISOString(),
      photo_url: photoUrl,
      location_lat: lat ? parseFloat(lat) : null,
      location_lng: lng ? parseFloat(lng) : null,
    })

    if (insertErr) {
      return NextResponse.json({ error: `เช็คอินไม่สำเร็จ: ${insertErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, photoUrl })
  } catch (err: any) {
    console.error('Checkin error:', err)
    return NextResponse.json({ error: `เกิดข้อผิดพลาด: ${err.message}` }, { status: 500 })
  }
}

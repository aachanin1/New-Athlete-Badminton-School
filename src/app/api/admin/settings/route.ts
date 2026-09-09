import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireSuperAdminUser } from '@/lib/auth/admin'
import { KIDS_MAKEUP_MINIMUM_KEY, parseKidsMakeupMinimum } from '@/lib/kids-makeup-settings'
import { callTask10, Task10Error } from '@/lib/task10-policy'

async function saveKidsMinimum(actorId: string, body: Record<string, unknown>) {
  const minimum = parseKidsMakeupMinimum(body.minimum)
  if (minimum === null || !Number.isSafeInteger(body.expectedRevision)
    || typeof body.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(body.requestId)) {
    return NextResponse.json({ error: 'กรอกจำนวนเต็มตั้งแต่ 1 ขึ้นไป และโหลดข้อมูลล่าสุดก่อนบันทึก' }, { status: 400 })
  }
  try {
    const data = await callTask10(getServiceRoleClient(), 'task10_save_makeup_setting_v1', {
      p_actor_id: actorId, p_minimum: minimum, p_expected_revision: body.expectedRevision, p_request_id: body.requestId,
    })
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error), code: error instanceof Task10Error ? error.code : undefined },
      { status: error instanceof Task10Error ? error.status : 500 })
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
}

// POST — create new setting
export async function POST(req: NextRequest) {
  const admin = await requireSuperAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { key, value } = body
    const supabaseAdmin = getServiceRoleClient()

    if (!key?.trim()) {
      return NextResponse.json({ error: 'กรุณากรอก key' }, { status: 400 })
    }

    if (key.trim() === KIDS_MAKEUP_MINIMUM_KEY) {
      if (body.id) {
        const { data: row, error } = await supabaseAdmin.from('system_settings').select('key').eq('id', body.id).maybeSingle()
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        if (row?.key !== KIDS_MAKEUP_MINIMUM_KEY) return NextResponse.json({ error: 'ID และ key ไม่ตรงกัน' }, { status: 409 })
      }
      return saveKidsMinimum(admin.user.id, body)
    }

    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .insert({ key: key.trim(), value: value ?? {}, updated_by: admin.user.id })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

// PATCH — update setting
export async function PATCH(req: NextRequest) {
  const admin = await requireSuperAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { id, key, value } = body
    const supabaseAdmin = getServiceRoleClient()

    if (!id && !key) {
      return NextResponse.json({ error: 'ไม่พบ setting ID หรือ key' }, { status: 400 })
    }

    // Resolve the stored key first: a PATCH by id must not bypass the protected
    // setting branch, even if the caller omits or forges its key.
    if (id) {
      const { data: row, error } = await supabaseAdmin.from('system_settings').select('key').eq('id', id).maybeSingle()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      if (row?.key === KIDS_MAKEUP_MINIMUM_KEY || key === KIDS_MAKEUP_MINIMUM_KEY) {
        if (!row || (key && key !== row.key)) return NextResponse.json({ error: 'ID และ key ไม่ตรงกัน' }, { status: 409 })
        return saveKidsMinimum(admin.user.id, body)
      }
    } else if (key === KIDS_MAKEUP_MINIMUM_KEY) {
      return saveKidsMinimum(admin.user.id, body)
    }

    const query = supabaseAdmin.from('system_settings').update({ value: value ?? {}, updated_by: admin.user.id })

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
  } catch (err) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 })
  }
}

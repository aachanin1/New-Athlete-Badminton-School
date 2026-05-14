import { NextRequest, NextResponse } from 'next/server'

import { MAX_LEVEL } from '@/constants/levels'
import { logActivity } from '@/lib/activity-log'
import { getServiceRoleClient, requireSuperAdminUser } from '@/lib/auth/admin'
import type { LevelCategory } from '@/types/database'

const LEVEL_CATEGORIES: LevelCategory[] = ['basic', 'athlete_1', 'athlete_2', 'athlete_3']

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
}

export async function PATCH(req: NextRequest) {
  const admin = await requireSuperAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const id = Number(body.id)
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const category = body.category as LevelCategory

    if (!Number.isInteger(id) || id < 1 || id > MAX_LEVEL) {
      return NextResponse.json({ error: `Level ต้องอยู่ระหว่าง 1-${MAX_LEVEL}` }, { status: 400 })
    }

    if (!name) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อ Level' }, { status: 400 })
    }

    if (!LEVEL_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'หมวด Level ไม่ถูกต้อง' }, { status: 400 })
    }

    const supabaseAdmin = getServiceRoleClient()
    const updateData = {
      name,
      description: typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null,
      program_name: typeof body.programName === 'string' && body.programName.trim() ? body.programName.trim() : null,
      requirements: typeof body.requirements === 'string' && body.requirements.trim() ? body.requirements.trim() : null,
      category,
      is_active: Boolean(body.isActive),
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabaseAdmin
      .from('levels')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logActivity({
      userId: admin.user.id,
      action: 'level_updated',
      entityType: 'level',
      entityId: String(id),
      details: { id, name, category, isActive: updateData.is_active },
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

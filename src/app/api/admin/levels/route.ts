import { NextRequest, NextResponse } from 'next/server'

import { DEFAULT_EXTENDED_LEVEL_CATEGORY } from '@/constants/levels'
import { logActivity } from '@/lib/activity-log'
import { getServiceRoleClient, requireSuperAdminUser } from '@/lib/auth/admin'
import type { LevelCategory } from '@/types/database'

const LEVEL_CATEGORIES: LevelCategory[] = ['basic', 'athlete_1', 'athlete_2', 'athlete_3']

interface LevelPayload {
  id?: number | string
  name?: string
  description?: string
  programName?: string
  requirements?: string
  category?: LevelCategory
  isActive?: boolean
}

interface LevelIdRow {
  id: number
}

interface DbError {
  message: string
  code?: string
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
}

function cleanText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function validateCategory(category: unknown): category is LevelCategory {
  return LEVEL_CATEGORIES.includes(category as LevelCategory)
}

function buildLevelData(body: LevelPayload) {
  const name = cleanText(body.name)
  const category = validateCategory(body.category) ? body.category : DEFAULT_EXTENDED_LEVEL_CATEGORY

  return {
    name,
    category,
    description: cleanText(body.description),
    program_name: cleanText(body.programName),
    requirements: cleanText(body.requirements),
    is_active: body.isActive !== false,
    updated_at: new Date().toISOString(),
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireSuperAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json() as LevelPayload
    const levelData = buildLevelData(body)

    if (!levelData.name) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อ Level' }, { status: 400 })
    }

    const supabaseAdmin = getServiceRoleClient()
    const explicitId = body.id !== undefined && body.id !== ''
      ? Number(body.id)
      : null

    if (explicitId !== null && (!Number.isInteger(explicitId) || explicitId < 1)) {
      return NextResponse.json({ error: 'เลข Level ต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป' }, { status: 400 })
    }

    const { data: latestLevel, error: latestError } = await supabaseAdmin
      .from('levels')
      .select('id')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle() as unknown as { data: LevelIdRow | null; error: DbError | null }

    if (latestError) {
      return NextResponse.json({ error: latestError.message }, { status: 500 })
    }

    const id = explicitId ?? ((latestLevel?.id || 0) + 1)
    const { data, error } = await supabaseAdmin
      .from('levels')
      .insert({
        id,
        ...levelData,
      })
      .select()
      .single()

    if (error) {
      const message = error.code === '23505'
        ? `มี Level ${id} อยู่แล้ว`
        : error.message
      return NextResponse.json({ error: message }, { status: 500 })
    }

    await logActivity({
      userId: admin.user.id,
      action: 'level_created',
      entityType: 'level',
      entityId: String(id),
      details: { id, name: levelData.name, category: levelData.category, isActive: levelData.is_active },
      ipAddress: req.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await requireSuperAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json() as LevelPayload
    const id = Number(body.id)
    const levelData = buildLevelData(body)

    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: 'เลข Level ต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป' }, { status: 400 })
    }

    if (!levelData.name) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อ Level' }, { status: 400 })
    }

    if (!validateCategory(body.category)) {
      return NextResponse.json({ error: 'หมวด Level ไม่ถูกต้อง' }, { status: 400 })
    }

    const supabaseAdmin = getServiceRoleClient()
    const { data, error } = await supabaseAdmin
      .from('levels')
      .update(levelData)
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
      details: { id, name: levelData.name, category: levelData.category, isActive: levelData.is_active },
      ipAddress: req.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireAdminMenuAccess } from '@/lib/auth/admin'
import { logActivity } from '@/lib/activity-log'

interface ExpensePayload {
  expenseDate?: string
  category?: string
  description?: string | null
  amount?: number | string
  branchId?: string | null
}

interface DbError {
  message: string
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'เกิดข้อผิดพลาด'
}

function normalizeAmount(value: ExpensePayload['amount']) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

function isDateInput(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

export async function POST(request: NextRequest) {
  const access = await requireAdminMenuAccess('finance')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })
  const admin = access.ctx

  try {
    const payload = await request.json() as ExpensePayload
    const amount = normalizeAmount(payload.amount)
    const category = payload.category?.trim()
    const description = payload.description?.trim() || null

    if (!isDateInput(payload.expenseDate)) {
      return NextResponse.json({ error: 'กรุณาเลือกวันที่รายจ่าย' }, { status: 400 })
    }

    if (!category) {
      return NextResponse.json({ error: 'กรุณากรอกหมวดรายจ่าย' }, { status: 400 })
    }

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'จำนวนเงินต้องมากกว่า 0' }, { status: 400 })
    }

    const supabaseAdmin = getServiceRoleClient()
    const { data, error } = await supabaseAdmin
      .from('finance_expenses')
      .insert({
        expense_date: payload.expenseDate,
        category,
        description,
        amount,
        branch_id: payload.branchId || null,
        created_by: admin.user.id,
      })
      .select('id')
      .single() as unknown as { data: { id: string } | null; error: DbError | null }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logActivity({
      userId: admin.user.id,
      action: 'create_finance_expense',
      entityType: 'finance_expense',
      entityId: data?.id || null,
      details: { category, amount, expenseDate: payload.expenseDate, branchId: payload.branchId || null },
      ipAddress: request.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({ success: true, expenseId: data?.id })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const access = await requireAdminMenuAccess('finance')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })
  const admin = access.ctx

  try {
    const expenseId = request.nextUrl.searchParams.get('id')
    if (!expenseId) return NextResponse.json({ error: 'expense id is required' }, { status: 400 })

    const supabaseAdmin = getServiceRoleClient()
    const { error } = await supabaseAdmin
      .from('finance_expenses')
      .delete()
      .eq('id', expenseId) as unknown as { error: DbError | null }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logActivity({
      userId: admin.user.id,
      action: 'delete_finance_expense',
      entityType: 'finance_expense',
      entityId: expenseId,
      details: {},
      ipAddress: request.headers.get('x-forwarded-for'),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}

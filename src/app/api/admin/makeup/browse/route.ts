import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient, requireAdminMenuAccess } from '@/lib/auth/admin'

export async function GET(request: NextRequest) {
  const access = await requireAdminMenuAccess('makeup')
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })
  const q = request.nextUrl.searchParams, month = q.get('month') || '', course = q.get('course') || ''
  const search = q.get('search')?.trim() || '', branch = q.get('branch') || 'all', status = q.get('status') || 'all', page = Number(q.get('page') || 1)
  if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month) || month.slice(0, 4) >= '9999'
    || !['kids_group', 'adult_group', 'private'].includes(course) || search.length > 200
    || !(branch === 'all' || /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(branch))
    || !['all', 'actionable', 'makeup', 'expired'].includes(status) || !Number.isInteger(page) || page < 1 || page > 10000) {
    return NextResponse.json({ error: 'ข้อมูลตัวกรองไม่ถูกต้อง' }, { status: 400 })
  }
  const { data, error } = await getServiceRoleClient().rpc('admin_makeup_browse_v1', {
    p_actor: access.ctx.user.id, p_month: `${month}-01`, p_course: course, p_search: search,
    p_branch: branch === 'all' ? null : branch, p_status: status, p_page: page,
  })
  if (error || !data) return NextResponse.json({ error: 'อ่านรายการชดเชยไม่สำเร็จ กรุณาลองใหม่' }, { status: 503 })
  return NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } })
}

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const results: Record<string, unknown> = {}
  const errors: string[] = []

  // 1. Test branches
  const { data: branches, error: branchErr } = await supabase
    .from('branches')
    .select('id, name, slug')
    .order('name')

  if (branchErr) errors.push(`branches: ${branchErr.message}`)
  else results.branches = { count: branches.length, data: branches }

  // 2. Test course_types
  const { data: courseTypes, error: ctErr } = await supabase
    .from('course_types')
    .select('id, name, max_students, duration_hours')

  if (ctErr) errors.push(`course_types: ${ctErr.message}`)
  else results.course_types = { count: courseTypes.length, data: courseTypes }

  // 3. Test levels
  const { data: levels, error: lvlErr } = await supabase
    .from('levels')
    .select('id, name, category')
    .order('id')

  if (lvlErr) errors.push(`levels: ${lvlErr.message}`)
  else results.levels = { count: levels.length, sample: levels.slice(0, 3) }

  // 4. Test pricing_tiers
  const { data: pricing, error: priceErr } = await supabase
    .from('pricing_tiers')
    .select('id, course_type_id, min_sessions, max_sessions, price_per_session, package_price')

  if (priceErr) errors.push(`pricing_tiers: ${priceErr.message}`)
  else results.pricing_tiers = { count: pricing.length }

  // 5. Test auth connection
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  results.auth = { connected: !authErr, user: user ? user.email : null }

  const ok = errors.length === 0

  return NextResponse.json({
    status: ok ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    errors: errors.length > 0 ? errors : undefined,
    results,
  }, { status: ok ? 200 : 500 })
}

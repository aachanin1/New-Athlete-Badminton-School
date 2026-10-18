import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { BranchDateClosure } from '@/lib/branch-date-closures'
import { getBangkokDateKey } from '@/lib/date-format'

/** Complete bounded reads; unavailable policy must not appear as no closures. */
export async function readBranchDateClosures(client: SupabaseClient, from: string, to: string, includeInactive = false) {
  const rows: BranchDateClosure[] = []
  for (let offset = 0; ; offset += 1000) {
    let query = client.from('branch_date_closures').select('id,branch_id,closure_date,reason,is_active,updated_at')
      .gte('closure_date', from).lte('closure_date', to).order('closure_date').order('id').range(offset, offset + 999)
    if (!includeInactive) query = query.eq('is_active', true)
    const { data, error } = await query
    if (error) throw new Error('อ่านวันปิดสาขาไม่สำเร็จ กรุณาลองใหม่')
    rows.push(...data as BranchDateClosure[])
    if (data.length < 1000) return rows
  }
}

export function readFutureBranchDateClosures(client: SupabaseClient) {
  return readBranchDateClosures(client, getBangkokDateKey(new Date())!, '9998-12-31')
}

/** Keep existing records readable when new-date selection cannot be verified. */
export async function readFutureBranchDateClosureState(client: SupabaseClient) {
  try { return { available: true, closures: await readFutureBranchDateClosures(client) } }
  catch { return { available: false, closures: [] as BranchDateClosure[] } }
}

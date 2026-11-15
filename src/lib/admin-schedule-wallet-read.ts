import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { AdminScheduleWalletCreditRow } from '@/lib/admin-schedules-model'

export interface ScheduleWalletCredit extends AdminScheduleWalletCreditRow {
  id: string
  user_id: string
}
export interface ScheduleMakeupUse {
  parent_id: string
  credit_id: string | null
  source_session_id: string
  source_root_id: string
}

/** Exact stored source only: do not expand a re-walleted descendant to its root. */
export function projectScheduleWalletCredits(credits: ScheduleWalletCredit[], uses: ScheduleMakeupUse[]) {
  const creditKeys = new Set<string>(), sourceKeys = new Set<string>()
  for (const use of uses) {
    if (use.credit_id) creditKeys.add(use.parent_id + ':' + use.credit_id)
    for (const id of [use.source_session_id, use.source_root_id]) {
      sourceKeys.add(use.parent_id + ':' + id)
    }
  }
  return credits.map(credit => creditKeys.has(credit.user_id + ':' + credit.id)
    || sourceKeys.has(credit.user_id + ':' + credit.original_session_id)
    ? { ...credit, status: 'redeemed' as const } : credit)
}

/** Called server-side after the schedules permission and source-row RLS checks. */
export async function readScheduleWalletUses(
  client: SupabaseClient<Database>,
  credits: ScheduleWalletCredit[],
  onPage: (rows: number) => void = () => {},
) {
  const uses: ScheduleMakeupUse[] = []
  // Four UUID lists (including owners) must stay below proxy URL limits.
  const chunkSize = 40, pageSize = 1000
  for (let chunk = 0; chunk < credits.length; chunk += chunkSize) {
    const batch = credits.slice(chunk, chunk + chunkSize)
    const parents = [...new Set(batch.map(c => c.user_id))]
    const ids = batch.map(c => c.id).join(',')
    const sources = batch.map(c => c.original_session_id).join(',')
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await client.from('task10_family_makeup_uses')
        .select('id,parent_id,credit_id,source_session_id,source_root_id')
        .in('parent_id', parents)
        .or(`credit_id.in.(${ids}),source_session_id.in.(${sources}),source_root_id.in.(${sources})`)
        .order('id').range(offset, offset + pageSize - 1)
      if (error) throw new Error('Admin schedule makeup-use query failed: ' + error.message)
      const page = data || []
      onPage(page.length)
      uses.push(...page)
      if (page.length < pageSize) break
    }
  }
  return projectScheduleWalletCredits(credits, uses)
}

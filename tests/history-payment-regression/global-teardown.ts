import {
  getHistoryFixtureResidueCount,
  resetLocalDatabase,
  waitForLocalSupabaseAuth,
} from './local-supabase'

export default async function globalTeardown() {
  resetLocalDatabase()
  await waitForLocalSupabaseAuth()
  const residue = await getHistoryFixtureResidueCount()
  if (residue !== 0) throw new Error(`[history-payment-e2e] disposable fixture residue: ${residue}`)
  console.log('[history-payment-e2e] disposable fixture residue: 0')
}

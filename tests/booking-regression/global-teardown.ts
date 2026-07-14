import { getFixtureResidueCount, resetLocalDatabase, waitForLocalSupabaseAuth } from './local-supabase'

export default async function globalTeardown() {
  resetLocalDatabase()
  await waitForLocalSupabaseAuth()
  const residue = await getFixtureResidueCount()
  if (residue !== 0) throw new Error(`[booking-e2e] disposable fixture residue: ${residue}`)
  console.log('[booking-e2e] disposable fixture residue: 0')
}

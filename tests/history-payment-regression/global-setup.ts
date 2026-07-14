import {
  resetLocalDatabase,
  seedHistoryPaymentFixture,
  waitForLocalSupabaseAuth,
} from './local-supabase'

export default async function globalSetup() {
  resetLocalDatabase()
  await waitForLocalSupabaseAuth()
  const fixture = await seedHistoryPaymentFixture()
  console.log(`[history-payment-e2e] disposable fixture ready for user ${fixture.userId}`)
}

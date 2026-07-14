import { resetLocalDatabase, seedBookingFixture, waitForLocalSupabaseAuth } from './local-supabase'

export default async function globalSetup() {
  resetLocalDatabase()
  await waitForLocalSupabaseAuth()
  const fixture = await seedBookingFixture()
  console.log(`[booking-e2e] disposable fixture ready for user ${fixture.userId}`)
}

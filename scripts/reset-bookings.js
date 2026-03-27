import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('Environment variables:')
console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'NOT SET')
console.log('SUPABASE_SERVICE_ROLE_KEY:', serviceKey ? 'SET' : 'NOT SET')

if (!supabaseUrl || !serviceKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

async function clearBookingsAndPayments() {
  console.log('🧹 Clearing bookings, payments, and notifications...')

  // Delete in order of dependencies
  const tables = [
    'notifications',
    'payments',
    'booking_sessions',
    'bookings'
  ]

  for (const table of tables) {
    console.log(`🗑️  Deleting from ${table}...`)
    const { error } = await supabase.from(table).delete().gte('id', '00000000-0000-0000-0000-000000000000')
    if (error) {
      console.error(`❌ Error deleting from ${table}:`, error)
    } else {
      console.log(`✅ Cleared ${table}`)
    }
  }

  console.log('🎉 Done. Database is reset for bookings/payments/notifications.')
}

clearBookingsAndPayments().catch(console.error)

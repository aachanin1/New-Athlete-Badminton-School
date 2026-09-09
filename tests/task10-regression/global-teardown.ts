import { teardownTask10 } from './local-supabase'

export default async function globalTeardown() { await teardownTask10() }

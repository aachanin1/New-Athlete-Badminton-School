import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { consumeKidsFamilyMakeup, readKidsFamilyMakeup } from '@/lib/kids-family-makeup'
import { Task10Error, task10RpcError } from '@/lib/task10-policy'
import { formatLearnerDisplayName } from '@/lib/learner-display-name'

const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

export async function readKidsFamilyMakeupWithDestinations(client: SupabaseClient, actorId: string, parentId: string, sourceMonth: string) {
  const state = await readKidsFamilyMakeup(client, actorId, parentId, sourceMonth)
  // The authorized state owns child identity. Hydrate only those children in
  // that same family; display enrichment cannot add a learner or entitlement.
  const childNames = new Map<string, string>()
  const childIds = [...new Set((state.children || []).map(child => child.id))]
  for (let offset = 0; offset < childIds.length; offset += 100) {
    const { data, error } = await client.from('children').select('id,full_name,nickname')
      .eq('parent_id', parentId).in('id', childIds.slice(offset, offset + 100)).order('id')
    if (error) throw task10RpcError()
    for (const child of data || []) childNames.set(child.id, formatLearnerDisplayName({ fullName: child.full_name, nickname: child.nickname }))
  }
  const children = (state.children || []).map(child => ({ id: child.id, name: childNames.get(child.id) || formatLearnerDisplayName({}) }))
  const ids: string[] = []
  // Exact family/source-month evidence, not a destination-month history scan.
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from('task10_family_makeup_uses').select('id,destination_session_id')
      .eq('parent_id', parentId).eq('source_month', `${sourceMonth}-01`).order('id').range(offset, offset + 999)
    if (error) throw task10RpcError()
    ids.push(...(data || []).map(row => row.destination_session_id as string))
    if (!data || data.length < 1000) break
  }
  // Earlier compatible Makeup bookings may predate task10-use evidence. Resolve
  // their real links from this family's source month without a history scan.
  const [year, month] = sourceMonth.split('-').map(Number)
  const end = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)
  const sourceIds: string[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from('booking_sessions')
      .select('id,bookings!inner(user_id,course_types!inner(name))').eq('bookings.user_id', parentId)
      .eq('bookings.course_types.name', 'kids_group').gte('date', `${sourceMonth}-01`).lt('date', end)
      .order('id').range(offset, offset + 999)
    if (error) throw task10RpcError()
    sourceIds.push(...(data || []).map(row => row.id as string))
    if (!data || data.length < 1000) break
  }
  for (let offset = 0; offset < sourceIds.length; offset += 100) {
    for (let page = 0; ; page += 1000) {
      const { data, error } = await client.from('booking_sessions').select('id')
        .in('rescheduled_from_id', sourceIds.slice(offset, offset + 100)).eq('is_makeup', true).order('id').range(page, page + 999)
      if (error) throw task10RpcError()
      ids.push(...(data || []).map(row => row.id as string))
      if (!data || data.length < 1000) break
    }
  }
  const uniqueIds = [...new Set(ids)]
  const destinations: NonNullable<typeof state.destinations> = []
  for (let offset = 0; offset < uniqueIds.length; offset += 100) {
    const { data, error } = await client.from('booking_sessions')
      .select('id,child_id,date,start_time,end_time,branches(name),children(full_name,nickname)')
      .in('id', uniqueIds.slice(offset, offset + 100)).order('date').order('id')
    if (error || data?.length !== uniqueIds.slice(offset, offset + 100).length) throw task10RpcError()
    for (const row of data as unknown as Array<{ id: string; child_id: string; date: string; start_time: string; end_time: string; branches: { name: string } | null; children: { full_name: string | null; nickname: string | null } | null }>) {
      destinations.push({ id: row.id, childId: row.child_id, childName: formatLearnerDisplayName({ fullName: row.children?.full_name, nickname: row.children?.nickname }),
        date: row.date, startTime: row.start_time, endTime: row.end_time, branchName: row.branches?.name || 'ไม่พบข้อมูลสาขา' })
    }
  }
  return { ...state, children, destinations }
}

/** Selects a source, never writes entitlement itself. The RPC owns locks and replay. */
export async function consumeNextKidsFamilyMakeup(client: SupabaseClient, actorId: string, body: Record<string, unknown>) {
  const { parent_id: parentId, source_month: sourceMonth, request_id: requestId, attending_child_id: childId } = body
  if (![parentId, requestId, childId].every(value => typeof value === 'string' && uuid.test(value))
    || typeof sourceMonth !== 'string' || !/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(sourceMonth)) {
    throw task10RpcError('TASK10_INVALID_REQUEST')
  }
  const prior = async () => {
    const { data, error } = await client.from('task10_family_makeup_uses')
      .select('parent_id, source_month, source_session_id').eq('actor_id', actorId).eq('request_id', requestId).maybeSingle()
    if (error) throw task10RpcError()
    if (data && (data.parent_id !== (parentId as string).toLowerCase() || data.source_month !== `${sourceMonth}-01`)) {
      throw task10RpcError('TASK10_IDEMPOTENCY_CONFLICT')
    }
    return data as { source_session_id: string } | null
  }
  const consume = (source: string) => consumeKidsFamilyMakeup(client, actorId, { ...body, original_session_id: source })
  // Replay must precede the active-policy/remaining-source checks. The RPC still
  // checks permission and its complete fingerprint, including child and target.
  const existing = await prior()
  if (existing) return consume(existing.source_session_id)
  const state = await readKidsFamilyMakeup(client, actorId, parentId as string, sourceMonth)
  if (!state.eligible || !state.children?.some(child => child.id === (childId as string).toLowerCase())) {
    const committed = await prior()
    if (committed) return consume(committed.source_session_id)
    throw task10RpcError(!state.active ? 'TASK10_MAKEUP_PAUSED' : 'TASK10_MAKEUP_INELIGIBLE')
  }
  // Preserve the RPC's ORDER BY session id. Do not introduce source-kind priority.
  const source = state.sources[0]
  if (!source) throw task10RpcError('TASK10_SOURCE_CONFLICT')
  try {
    return await consume(source.sourceSessionId)
  } catch (error) {
    // Another copy of this request can commit between our read and RPC lock.
    // Resolve only that request's committed source, never try another entitlement.
    const committed = await prior()
    if (committed) return consume(committed.source_session_id)
    if (error instanceof Task10Error) throw error
    throw task10RpcError()
  }
}

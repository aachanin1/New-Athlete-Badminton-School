export interface NoClassReturnSession {
  sessionId: string
  learnerName: string
  parentName: string
  unitId: string
}

export interface NoClassReturnUnit {
  unitId: string
  sessionIds: string[]
  amount: number
  unit: 'hour' | 'session'
  expiresAt: string
  expirySource?: 'stored_credit' | 'original_month_end'
}

export interface NoClassReturnPreview {
  eligible: boolean
  anchorId: string
  scopeFingerprint: string
  scheduleSlotId: string
  coachId: string | null
  coachName: string | null
  branchName: string
  courseType: 'kids_group' | 'adult_group' | 'private'
  date: string
  startTime: string
  endTime: string
  sessions: NoClassReturnSession[]
  units: NoClassReturnUnit[]
  targetSessionIds: string[]
  targetCount: number
  blockers: Array<{ code: string; message: string }>
  coachHours: 0
}

export interface NoClassReturnCredit extends NoClassReturnUnit {
  creditId: string
}

export interface NoClassReturnReceipt {
  confirmed: true
  requestId: string
  anchorId: string
  recordedAt: string
  targetSessionIds: string[]
  targetCount: number
  credits: NoClassReturnCredit[]
  coachHours: 0
}

export interface NoClassReturnMissingReceipt {
  confirmed: false
  requestId: string
  definitive: boolean
  pending?: boolean
}

export interface NoClassReturnError {
  error: string
  definitive: boolean
  scopeChanged?: boolean
}

export const noClassReturnUuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const dateTime = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
const ids = (value: unknown): value is string[] => Array.isArray(value) && value.every(id => typeof id === 'string' && noClassReturnUuid.test(id)) && new Set(value).size === value.length
const sameIds = (left: string[], right: string[]) => left.length === right.length
  && new Set(left).size === left.length && new Set(right).size === right.length && left.every(id => right.includes(id))

function isUnit(value: unknown): value is NoClassReturnUnit {
  return record(value) && typeof value.unitId === 'string' && noClassReturnUuid.test(value.unitId)
    && ids(value.sessionIds) && value.sessionIds.length > 0 && typeof value.amount === 'number'
    && Number.isFinite(value.amount) && value.amount > 0 && (value.unit === 'hour' || value.unit === 'session') && dateTime(value.expiresAt)
    && (value.expirySource === undefined || value.expirySource === 'stored_credit' || value.expirySource === 'original_month_end')
}

function unitsCoverMembers(units: NoClassReturnUnit[], targetIds: string[]) {
  const members = units.flatMap(unit => unit.sessionIds)
  return new Set(units.map(unit => unit.unitId)).size === units.length
    && new Set(members).size === members.length && sameIds(members, targetIds)
}

export function isNoClassReturnPreview(value: unknown, anchor: string): value is NoClassReturnPreview {
  if (!record(value) || typeof value.eligible !== 'boolean' || value.anchorId !== anchor
    || typeof value.scopeFingerprint !== 'string' || !value.scopeFingerprint.length
    || typeof value.scheduleSlotId !== 'string' || !noClassReturnUuid.test(value.scheduleSlotId)
    || !(value.coachId === null || typeof value.coachId === 'string' && noClassReturnUuid.test(value.coachId))
    || !(value.coachName === null || typeof value.coachName === 'string') || typeof value.branchName !== 'string'
    || typeof value.courseType !== 'string' || !['kids_group', 'adult_group', 'private'].includes(value.courseType)
    || typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)
    || typeof value.startTime !== 'string' || !/^\d{2}:\d{2}(:\d{2})?$/.test(value.startTime)
    || typeof value.endTime !== 'string' || !/^\d{2}:\d{2}(:\d{2})?$/.test(value.endTime)
    || !ids(value.targetSessionIds) || value.targetCount !== value.targetSessionIds.length || value.coachHours !== 0
    || !Array.isArray(value.sessions) || !value.sessions.every(session => record(session) && typeof session.sessionId === 'string'
      && noClassReturnUuid.test(session.sessionId) && typeof session.learnerName === 'string' && typeof session.parentName === 'string'
      && typeof session.unitId === 'string' && noClassReturnUuid.test(session.unitId))
    || !Array.isArray(value.units) || !value.units.every(isUnit) || !Array.isArray(value.blockers)
    || !value.blockers.every(blocker => record(blocker) && typeof blocker.code === 'string' && typeof blocker.message === 'string')) return false
  const preview = value as unknown as NoClassReturnPreview
  if (!sameIds(preview.sessions.map(session => session.sessionId), preview.targetSessionIds)) return false
  if (!unitsCoverMembers(preview.units, preview.targetSessionIds)
    || !preview.sessions.every(session => preview.units.some(unit => unit.unitId === session.unitId && unit.sessionIds.includes(session.sessionId)))) return false
  return !preview.eligible || preview.targetCount > 0 && preview.blockers.length === 0
}

export function isNoClassReturnReceipt(value: unknown, requestId: string, anchor: string, preview?: NoClassReturnPreview): value is NoClassReturnReceipt {
  if (!record(value) || value.confirmed !== true || value.requestId !== requestId || value.anchorId !== anchor
    || !dateTime(value.recordedAt) || !ids(value.targetSessionIds) || value.targetCount !== value.targetSessionIds.length
    || value.targetSessionIds.length === 0 || value.coachHours !== 0 || !Array.isArray(value.credits)
    || !value.credits.every(credit => isUnit(credit) && record(credit) && typeof credit.creditId === 'string' && noClassReturnUuid.test(credit.creditId))) return false
  const receipt = value as unknown as NoClassReturnReceipt
  if (!unitsCoverMembers(receipt.credits, receipt.targetSessionIds) || new Set(receipt.credits.map(credit => credit.creditId)).size !== receipt.credits.length) return false
  return !preview || sameIds(receipt.targetSessionIds, preview.targetSessionIds)
    && receipt.credits.length === preview.units.length && receipt.credits.every(credit => preview.units.some(unit => (
      unit.unitId === credit.unitId && unit.unit === credit.unit && unit.amount === credit.amount
      && Date.parse(unit.expiresAt) === Date.parse(credit.expiresAt) && sameIds(unit.sessionIds, credit.sessionIds)
      && (unit.expirySource === undefined || unit.expirySource === credit.expirySource)
    )))
}

export function noClassReturnUnitLabel(unit: Pick<NoClassReturnUnit, 'amount' | 'unit'>) {
  return `${unit.amount.toLocaleString('th-TH', { maximumFractionDigits: 3 })} ${unit.unit === 'hour' ? 'ชั่วโมง' : 'ครั้งเรียน'}`
}

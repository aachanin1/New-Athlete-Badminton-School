import { PAYMENT_TRANSFER_DEFAULT_ACCOUNTS } from './payment-transfer-defaults'

export const PAYMENT_TRANSFER_SETTING_KEY = 'payment_transfer_settings'
export const PAYMENT_TRANSFER_VERSION = 2
export const PAYMENT_TRANSFER_INSTRUCTION = 'เลือกโอนยอดทั้งหมดเข้าบัญชีใดบัญชีหนึ่งด้านล่าง แล้วแนบสลิป 1 ใบ'
export const PAYMENT_BANK_NAMES = ['SCB', 'กรุงศรี', 'TTB', 'ธ.กรุงเทพ'] as const

export interface PaymentBranch {
  id: string
  name: string
  slug: string
  is_active: boolean
}

export interface PaymentTransferAccount {
  id: string
  bankName: string
  accountNumber: string
  accountName: string
  branchIds: string[]
}

export interface PaymentTransferSettings {
  version: 2
  accounts: PaymentTransferAccount[]
  source: 'defaults' | 'saved' | 'invalid'
  error: string | null
  // Exact canonical JSON; PATCH rechecks it then compares actual JSONB atomically.
  readToken: string
}

export interface PaymentTransferDisplayCard extends PaymentTransferAccount {
  branches: PaymentBranch[]
}

const LEGACY_FIELDS = ['bankName', 'accountName', 'accountNumber', 'promptPay', 'branchName', 'instructions']
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown, max: number) => typeof value === 'string' && value.trim().length > 0 && value.length <= max

export function paymentTransferReadToken(value: unknown): string {
  function canonical(item: unknown): unknown {
    if (Array.isArray(item)) return item.map(canonical)
    if (record(item)) return Object.fromEntries(Object.keys(item).sort().map(key => [key, canonical(item[key])]))
    return item ?? null
  }
  return JSON.stringify(canonical(value))
}

export function transferAccountNumber(value: string) {
  return value.replace(/[-\s]/g, '')
}

export function transferAccountKey(account: PaymentTransferAccount) {
  return `${account.bankName}:${transferAccountNumber(account.accountNumber)}`
}

export function validateTransferAccounts(value: unknown, branches?: PaymentBranch[]): {
  accounts: PaymentTransferAccount[]; error: string | null
} {
  const invalid = (error: string) => ({ accounts: [], error })
  if (!Array.isArray(value) || value.length > 100) return invalid('รูปแบบชุดบัญชีไม่ถูกต้อง กรุณาโหลดหน้าล่าสุด')
  const branchIds = branches ? new Set(branches.map(branch => branch.id)) : null
  if (branches && (branchIds?.size !== branches.length || branches.some(branch => !branch.id || !branch.name))) {
    return invalid('ข้อมูลสาขาซ้ำหรือไม่สมบูรณ์ กรุณาติดต่อเจ้าหน้าที่')
  }
  const ids = new Set<string>()
  const assigned = new Map<string, string>()
  const recipients = new Map<string, string>()
  const accounts: PaymentTransferAccount[] = []
  for (const raw of value) {
    if (!record(raw) || !text(raw.id, 80) || !/^[a-zA-Z0-9-]+$/.test(raw.id as string)
      || !PAYMENT_BANK_NAMES.includes(raw.bankName as typeof PAYMENT_BANK_NAMES[number])
      || !text(raw.accountName, 200) || !text(raw.accountNumber, 40)
      || !/^[0-9\s-]+$/.test(raw.accountNumber as string)
      || !/^\d{6,20}$/.test(transferAccountNumber(raw.accountNumber as string))
      || !Array.isArray(raw.branchIds) || raw.branchIds.length === 0 || raw.branchIds.length > 200
      || raw.branchIds.some(id => typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
      return invalid('กรุณาระบุธนาคาร เลขบัญชี ชื่อบัญชี และสาขาของทุกบัญชีให้ครบถ้วน')
    }
    const account: PaymentTransferAccount = {
      id: raw.id as string, bankName: raw.bankName as string,
      accountName: (raw.accountName as string).trim(), accountNumber: (raw.accountNumber as string).trim(),
      branchIds: [...raw.branchIds] as string[],
    }
    if (ids.has(account.id)) return invalid('รหัสรายการบัญชีซ้ำ กรุณาโหลดหน้าล่าสุด')
    if (new Set(account.branchIds).size !== account.branchIds.length) return invalid('มีสาขาซ้ำในรายการบัญชี')
    ids.add(account.id)
    const key = transferAccountKey(account)
    const recipient = recipients.get(key)
    if (recipient && recipient !== account.accountName) return invalid('ธนาคารและเลขบัญชีเดียวกันมีชื่อบัญชีไม่ตรงกัน กรุณาตรวจสอบ')
    recipients.set(key, account.accountName)
    for (const branchId of account.branchIds) {
      if (branchIds && !branchIds.has(branchId)) return invalid('มีสาขาที่ไม่พบในระบบ กรุณาโหลดหน้าล่าสุด')
      if (assigned.has(branchId) && assigned.get(branchId) !== key) return invalid('สาขาเดียวกันถูกผูกกับคนละบัญชี กรุณาเลือกบัญชีเดียวต่อสาขา')
      assigned.set(branchId, key)
    }
    accounts.push(account)
  }
  return { accounts, error: null }
}

export function normalizePaymentTransferSettings(value: unknown, branches?: PaymentBranch[]): PaymentTransferSettings {
  const readToken = paymentTransferReadToken(value)
  const invalid = (error: string): PaymentTransferSettings => ({ version: 2, accounts: [], source: 'invalid', error, readToken })
  // Presence, not truthiness: empty/deleted/malformed collections are authoritative.
  const hasCollection = record(value) && ['version', 'accounts', 'revision'].some(key => Object.hasOwn(value, key))
  if (hasCollection) {
    if (value.version !== PAYMENT_TRANSFER_VERSION || !text(value.revision, 100)) return invalid('การตั้งค่าบัญชีรับเงินผิดรูปแบบ กรุณาติดต่อเจ้าหน้าที่')
    const result = validateTransferAccounts(value.accounts, branches)
    if (result.error) return invalid(result.error)
    return { version: 2, accounts: result.accounts, source: 'saved', error: null, readToken }
  }
  if (value != null && (!record(value)
    || (Object.keys(value).length > 0 && !LEGACY_FIELDS.some(key => Object.hasOwn(value, key)))
    || LEGACY_FIELDS.some(key => Object.hasOwn(value, key) && typeof value[key] !== 'string'))) {
    return invalid('ไม่สามารถอ่านการตั้งค่าบัญชีรับเงินได้ กรุณาติดต่อเจ้าหน้าที่')
  }
  const defaults = validateTransferAccounts(PAYMENT_TRANSFER_DEFAULT_ACCOUNTS, branches)
  if (defaults.error) return invalid(defaults.error)
  return { version: 2, accounts: defaults.accounts, source: 'defaults', error: null, readToken }
}

export function hasPaymentTransferSettings(settings: PaymentTransferSettings) {
  return !settings.error && settings.accounts.length > 0
}

interface TransferBooking { id: string; status: string; branch_id: string | null }
interface TransferSession { booking_id: string; branch_id: string | null; status: string; is_makeup?: boolean }

export function resolveBookingTransferAccounts(
  settings: PaymentTransferSettings,
  branches: PaymentBranch[],
  payBookingIds: string[],
  bookings: TransferBooking[],
  bookingSessionsMap: Record<string, TransferSession[]>,
): { cards: PaymentTransferDisplayCard[]; issues: string[] } {
  if (settings.error) return { cards: [], issues: [settings.error] }
  const issues = new Set<string>()
  const relevant = new Set<string>()
  const roster = new Map(branches.map(branch => [branch.id, branch]))
  if (roster.size !== branches.length) return { cards: [], issues: ['ข้อมูลสาขาซ้ำ กรุณาติดต่อเจ้าหน้าที่'] }
  const byId = new Map(bookings.map(booking => [booking.id, booking]))
  const addBranch = (id: string | null) => {
    if (!id || !roster.has(id)) issues.add('ไม่พบข้อมูลสาขาของรายการเรียนบางรายการ กรุณาติดต่อเจ้าหน้าที่ก่อนโอนเงิน')
    else relevant.add(id)
  }
  for (const id of new Set(payBookingIds)) {
    const booking = byId.get(id)
    if (!booking || booking.status !== 'pending_payment') {
      issues.add('สถานะรายการชำระเปลี่ยนหรือข้อมูลไม่ครบ กรุณาตรวจสอบรายการล่าสุดก่อนโอนเงิน')
      continue
    }
    const sessions = bookingSessionsMap[id] || []
    if (sessions.length === 0) {
      // Some Legacy bookings have no dated sessions. Never replace a missing
      // branch on an existing session or old descendants with the header.
      addBranch(booking.branch_id)
    } else {
      const active = sessions.filter(session => session.booking_id === id && !session.is_makeup
        && ['scheduled', 'completed', 'absent'].includes(session.status))
      if (active.length === 0) issues.add('ไม่พบรายการเรียนที่เกี่ยวข้องกับการชำระ กรุณาติดต่อเจ้าหน้าที่ก่อนโอนเงิน')
      active.forEach(session => addBranch(session.branch_id))
    }
  }
  const cards = new Map<string, PaymentTransferDisplayCard>()
  for (const branchId of relevant) {
    const accounts = settings.accounts.filter(account => account.branchIds.includes(branchId))
    const keys = new Set(accounts.map(transferAccountKey))
    const branch = roster.get(branchId)!
    if (keys.size !== 1) {
      issues.add(`${branch.name}: ${keys.size === 0 ? 'ยังไม่มีบัญชีรับเงิน' : 'ข้อมูลบัญชีรับเงินกำกวม'} กรุณาติดต่อเจ้าหน้าที่`)
      continue
    }
    const account = accounts[0]
    const key = transferAccountKey(account)
    const card = cards.get(key) || { ...account, branchIds: [], branches: [] }
    card.branchIds.push(branchId)
    card.branches.push(branch)
    cards.set(key, card)
  }
  if (payBookingIds.length === 0) issues.add('ไม่พบชุดรายการที่กำลังชำระ')
  return { cards: [...cards.values()], issues: [...issues] }
}

export function transferAccountDetails(card: PaymentTransferDisplayCard) {
  return `สาขา: ${card.branches.map(branch => branch.name).join(', ')}\nธนาคาร: ${card.bankName}\nเลขบัญชี: ${transferAccountNumber(card.accountNumber)}\nชื่อบัญชี: ${card.accountName}`
}

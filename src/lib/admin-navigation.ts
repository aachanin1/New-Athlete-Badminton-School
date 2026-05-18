export const ADMIN_MENU_PERMISSION_SETTING_KEY = 'admin_menu_permissions'

export type AdminMenuKey =
  | 'dashboard'
  | 'branches'
  | 'schedules'
  | 'schedule_templates'
  | 'users'
  | 'ranking'
  | 'makeup'
  | 'coaches'
  | 'payments'
  | 'coupons'
  | 'payroll'
  | 'finance'
  | 'coach_checkins'
  | 'teaching_programs'
  | 'complaints'
  | 'notifications'
  | 'logs'
  | 'settings'

export interface AdminMenuItem {
  key: AdminMenuKey
  href: string
  label: string
  description: string
  superAdminOnly?: boolean
  lockedForAdmin?: boolean
}

export const ADMIN_MENU_ITEMS: AdminMenuItem[] = [
  { key: 'dashboard', href: '/admin', label: 'ภาพรวม', description: 'ดู KPI และภาพรวมระบบ', lockedForAdmin: true },
  { key: 'branches', href: '/admin/branches', label: 'จัดการสาขา', description: 'ดูสถานะสาขา โค้ช และยอดจองรายสาขา' },
  { key: 'schedules', href: '/admin/schedules', label: 'ตารางเรียน', description: 'ดูตารางเรียนและรอบที่มีผู้จอง' },
  { key: 'schedule_templates', href: '/admin/schedule-templates', label: 'รอบเรียนประจำ', description: 'ตั้งค่ารอบเรียนหลักของแต่ละสาขา', superAdminOnly: true },
  { key: 'users', href: '/admin/users', label: 'จัดการข้อมูลผู้ใช้', description: 'ดูข้อมูลผู้ใช้งานทั้งหมด' },
  { key: 'ranking', href: '/admin/ranking', label: 'อันดับนักเรียน', description: 'ดู Ranking จาก Level ล่าสุดที่ Coach ประเมิน' },
  { key: 'makeup', href: '/admin/makeup', label: 'วันชดเชย', description: 'ดูแลและจัดการสิทธิ์ชดเชย' },
  { key: 'coaches', href: '/admin/coaches', label: 'จัดการโค้ช', description: 'ดูข้อมูลโค้ชและสาขาที่รับผิดชอบ' },
  { key: 'payments', href: '/admin/payments', label: 'ตรวจสอบการชำระเงิน', description: 'ตรวจ SlipOK หลักฐานโอน และสถานะ payment' },
  { key: 'coupons', href: '/admin/coupons', label: 'คูปองส่วนลด', description: 'ดูคูปองและประวัติการใช้งาน' },
  { key: 'payroll', href: '/admin/payroll', label: 'คำนวณชั่วโมงสอน', description: 'สรุปชั่วโมงสอนรายสัปดาห์และยอดจ่ายโค้ช' },
  { key: 'finance', href: '/admin/finance', label: 'รายรับ-รายจ่าย', description: 'ดูรายได้ รายจ่าย และภาพรวมการเงิน' },
  { key: 'coach_checkins', href: '/admin/coach-checkins', label: 'เช็คอินโค้ช', description: 'ตรวจรูปและสถานะเช็คอินรายรอบสอน' },
  { key: 'teaching_programs', href: '/admin/teaching-programs', label: 'ตรวจโปรแกรมสอน', description: 'ตรวจ อนุมัติ และส่งกลับโปรแกรมสอนที่โค้ชส่งมา' },
  { key: 'complaints', href: '/admin/complaints', label: 'ร้องเรียน', description: 'ติดตามและตอบกลับเรื่องร้องเรียน' },
  { key: 'notifications', href: '/admin/notifications', label: 'แจ้งเตือน', description: 'ส่งและตรวจประวัติการแจ้งเตือน' },
  { key: 'logs', href: '/admin/logs', label: 'Activity Log', description: 'ตรวจประวัติการทำงานของระบบ', superAdminOnly: true },
  { key: 'settings', href: '/admin/settings', label: 'ตั้งค่าระบบ', description: 'ตั้งค่าหลักของระบบ', superAdminOnly: true },
]

export const ADMIN_STANDARD_MENU_KEYS = ADMIN_MENU_ITEMS
  .filter((item) => !item.superAdminOnly)
  .map((item) => item.key)

export function getAllowedAdminMenuKeys(value: unknown): AdminMenuKey[] {
  if (!value || typeof value !== 'object') {
    return ADMIN_STANDARD_MENU_KEYS
  }

  const keys = (value as { adminAllowedMenuKeys?: unknown }).adminAllowedMenuKeys
  if (!Array.isArray(keys)) {
    return ADMIN_STANDARD_MENU_KEYS
  }

  const allowed = keys.filter((key): key is AdminMenuKey => (
    typeof key === 'string' &&
    ADMIN_STANDARD_MENU_KEYS.includes(key as AdminMenuKey)
  ))

  return Array.from(new Set<AdminMenuKey>(['dashboard', ...allowed]))
}

export function getAdminMenuFallbackHref(allowedKeys: AdminMenuKey[]) {
  const firstAllowed = ADMIN_MENU_ITEMS.find((item) => allowedKeys.includes(item.key) && !item.superAdminOnly)
  return firstAllowed?.href || '/admin'
}

export function isAdminMenuPathAllowed(pathname: string, allowedKeys: AdminMenuKey[]) {
  const matchedMenu = ADMIN_MENU_ITEMS
    .filter((item) => pathname === item.href || (item.href !== '/admin' && pathname.startsWith(`${item.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]

  if (!matchedMenu || matchedMenu.superAdminOnly) {
    return false
  }

  return allowedKeys.includes(matchedMenu.key)
}

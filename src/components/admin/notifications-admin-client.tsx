'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  Bell,
  BellRing,
  CheckCheck,
  ChevronRight,
  Clock,
  MailCheck,
  MessageSquare,
  Plus,
  Search,
  Send,
  Sparkles,
  User,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ListPagination } from '@/components/admin/list-pagination'
import type { NotificationType, UserRole } from '@/types/database'

interface NotificationData {
  id: string
  user_id: string
  title: string
  message: string
  type: string
  is_read: boolean
  link_url: string | null
  created_at: string
  recipient_name: string
  recipient_email: string
  recipient_role: UserRole
  is_admin_inbox: boolean
}

interface UserOption {
  id: string
  full_name: string
  email: string
  role: UserRole
}

interface AlertInsight {
  id: string
  title: string
  description: string
  level: 'red' | 'yellow' | 'green'
  userId?: string
  notificationTitle?: string
  notificationMessage?: string
  notificationType?: string
  linkUrl?: string
}

interface AdminActionAlert {
  id: string
  title: string
  description: string
  tone: 'red' | 'amber' | 'blue' | 'green'
  href: string
  actionLabel: string
}

interface NotificationsAdminClientProps {
  currentAdminId: string
  notifications: NotificationData[]
  users: UserOption[]
  actionAlerts: AdminActionAlert[]
  nonRenewalAlerts: AlertInsight[]
  lowEnrollmentAlerts: AlertInsight[]
  customerFollowUpAlerts: AlertInsight[]
}

const TYPE_CONFIG: Record<string, { label: string; className: string; icon: LucideIcon }> = {
  payment: { label: 'ชำระเงิน', className: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: MailCheck },
  schedule: { label: 'ตารางเรียน', className: 'border-blue-200 bg-blue-50 text-blue-700', icon: Clock },
  reminder: { label: 'ติดตาม', className: 'border-amber-200 bg-amber-50 text-amber-700', icon: BellRing },
  complaint: { label: 'ร้องเรียน', className: 'border-rose-200 bg-rose-50 text-rose-700', icon: MessageSquare },
  system: { label: 'ระบบ', className: 'border-slate-200 bg-slate-50 text-slate-700', icon: Sparkles },
}

const ROLE_LABELS: Record<UserRole, string> = {
  user: 'ผู้เรียน',
  coach: 'โค้ช',
  head_coach: 'หัวหน้าโค้ช',
  admin: 'Admin',
  super_admin: 'Super Admin',
}

const ALERT_LEVEL_CONFIG: Record<AlertInsight['level'], string> = {
  red: 'border-rose-200 bg-rose-50 text-rose-800',
  yellow: 'border-amber-200 bg-amber-50 text-amber-800',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
}

const ACTION_TONE_CONFIG: Record<AdminActionAlert['tone'], string> = {
  red: 'border-rose-200 bg-rose-50 text-rose-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  blue: 'border-blue-200 bg-blue-50 text-blue-800',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
}

const TARGET_OPTIONS = [
  { value: 'all_users', label: 'ผู้ใช้ทั้งหมด' },
  { value: 'students', label: 'ผู้เรียนทั้งหมด' },
  { value: 'coaches', label: 'โค้ชทั้งหมด' },
  { value: 'admins', label: 'Admin ทั้งหมด' },
  { value: 'specific', label: 'เลือกผู้ใช้รายคน' },
]

function formatDate(date: string) {
  return new Date(date).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] || TYPE_CONFIG.system
}

export function NotificationsAdminClient({
  currentAdminId,
  notifications,
  users,
  actionAlerts,
  nonRenewalAlerts,
  lowEnrollmentAlerts,
  customerFollowUpAlerts,
}: NotificationsAdminClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterAudience, setFilterAudience] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inboxPage, setInboxPage] = useState(1)
  const [inboxPageSize, setInboxPageSize] = useState(15)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPageSize, setHistoryPageSize] = useState(15)

  const [targetMode, setTargetMode] = useState('students')
  const [formUserId, setFormUserId] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formMessage, setFormMessage] = useState('')
  const [formType, setFormType] = useState<NotificationType>('system')
  const [formLinkUrl, setFormLinkUrl] = useState('')

  const adminInbox = useMemo(
    () => notifications.filter((notification) => notification.user_id === currentAdminId),
    [currentAdminId, notifications]
  )

  const adminUnread = adminInbox.filter((notification) => !notification.is_read)
  const todayCount = notifications.filter((notification) => (
    new Date(notification.created_at).toDateString() === new Date().toDateString()
  )).length

  const filteredNotifications = useMemo(() => {
    const query = search.trim().toLowerCase()

    return notifications.filter((notification) => {
      if (filterType !== 'all' && notification.type !== filterType) return false
      if (filterAudience !== 'all' && notification.recipient_role !== filterAudience) return false
      if (!query) return true

      return [
        notification.title,
        notification.message,
        notification.recipient_name,
        notification.recipient_email,
        ROLE_LABELS[notification.recipient_role],
      ].some((value) => value.toLowerCase().includes(query))
    })
  }, [filterAudience, filterType, notifications, search])

  const safeInboxPage = Math.min(inboxPage, Math.max(1, Math.ceil(adminInbox.length / inboxPageSize)))
  const pagedAdminInbox = adminInbox.slice((safeInboxPage - 1) * inboxPageSize, safeInboxPage * inboxPageSize)
  const safeHistoryPage = Math.min(historyPage, Math.max(1, Math.ceil(filteredNotifications.length / historyPageSize)))
  const pagedHistory = filteredNotifications.slice((safeHistoryPage - 1) * historyPageSize, safeHistoryPage * historyPageSize)

  const openNew = () => {
    setError(null)
    setTargetMode('students')
    setFormUserId('')
    setFormTitle('')
    setFormMessage('')
    setFormType('system')
    setFormLinkUrl('')
    setDialogOpen(true)
  }

  const openSuggestedNotification = (alert: AlertInsight) => {
    setError(null)
    setTargetMode(alert.userId ? 'specific' : 'students')
    setFormUserId(alert.userId || '')
    setFormTitle(alert.notificationTitle || alert.title)
    setFormMessage(alert.notificationMessage || alert.description)
    setFormType((alert.notificationType || 'reminder') as NotificationType)
    setFormLinkUrl(alert.linkUrl || '')
    setDialogOpen(true)
  }

  const sendNotification = async () => {
    if (!formTitle.trim() || !formMessage.trim()) return
    if (targetMode === 'specific' && !formUserId) {
      setError('กรุณาเลือกผู้รับ')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetMode,
          user_id: targetMode === 'specific' ? formUserId : null,
          title: formTitle.trim(),
          message: formMessage.trim(),
          type: formType,
          link_url: formLinkUrl.trim() || null,
        }),
      })

      const result = await response.json().catch(() => null)
      if (!response.ok) {
        setError(result?.error || 'ส่งแจ้งเตือนไม่สำเร็จ')
        return
      }

      setDialogOpen(false)
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  const markAdminNotificationRead = async (notificationId?: string) => {
    setMarkingId(notificationId || 'all')
    setError(null)

    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_read',
          notificationId,
          markAll: !notificationId,
        }),
      })

      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || 'อัปเดตสถานะแจ้งเตือนไม่สำเร็จ')

      router.refresh()
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : 'อัปเดตสถานะแจ้งเตือนไม่สำเร็จ')
    } finally {
      setMarkingId(null)
    }
  }

  const renderNotification = (notification: NotificationData, compact = false) => {
    const typeConfig = getTypeConfig(notification.type)
    const TypeIcon = typeConfig.icon
    const content = (
      <div className={`flex gap-3 rounded-lg border bg-white p-3 shadow-sm ${!notification.is_read ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200'}`}>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${typeConfig.className}`}>
          <TypeIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[#153c85]">{notification.title}</p>
            <Badge variant="outline" className={typeConfig.className}>{typeConfig.label}</Badge>
            {!notification.is_read && <span className="h-2 w-2 rounded-full bg-blue-500" />}
          </div>
          <p className={`mt-1 text-xs text-slate-600 ${compact ? 'line-clamp-2' : ''}`}>{notification.message}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {notification.recipient_name} · {ROLE_LABELS[notification.recipient_role]}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDate(notification.created_at)}
            </span>
          </div>
        </div>
        {notification.is_admin_inbox && !notification.is_read && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 shrink-0 text-xs"
            disabled={markingId === notification.id}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              markAdminNotificationRead(notification.id)
            }}
          >
            อ่านแล้ว
          </Button>
        )}
      </div>
    )

    if (notification.link_url) {
      return (
        <Link key={notification.id} href={notification.link_url} className="block">
          {content}
        </Link>
      )
    }

    return <div key={notification.id}>{content}</div>
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#2748bf]">
            <BellRing className="h-4 w-4" />
            Admin Notification Center
          </div>
          <h1 className="mt-1 text-2xl font-bold text-[#153c85]">แจ้งเตือน</h1>
          <p className="mt-1 text-sm text-slate-500">ศูนย์รวมงานที่ Admin ต้องติดตาม และประวัติแจ้งเตือนที่ส่งในระบบ</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {adminUnread.length > 0 && (
            <Button
              variant="outline"
              className="gap-2"
              disabled={markingId === 'all'}
              onClick={() => markAdminNotificationRead()}
            >
              <CheckCheck className="h-4 w-4" />
              อ่านทั้งหมด
            </Button>
          )}
          <Button className="gap-2 bg-[#2748bf] hover:bg-[#153c85]" onClick={openNew}>
            <Plus className="h-4 w-4" />
            ส่งแจ้งเตือน
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">งานด่วน</p>
            <p className="mt-1 text-2xl font-bold text-[#153c85]">{actionAlerts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">Inbox Admin</p>
            <p className="mt-1 text-2xl font-bold text-blue-600">{adminInbox.length}</p>
          </CardContent>
        </Card>
        <Card className={adminUnread.length > 0 ? 'border-amber-200 bg-amber-50/30' : ''}>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">ยังไม่อ่าน</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">{adminUnread.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">วันนี้</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{todayCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-[#153c85]">งานด่วนที่ต้องดู</p>
              <p className="text-xs text-slate-500">ดึงจาก payment, complaint, coach check-in และรอบเรียนที่ควรติดตาม</p>
            </div>
            <Badge variant="outline" className="w-fit">{actionAlerts.length} รายการ</Badge>
          </div>

          {actionAlerts.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
              ไม่มีงานด่วนในตอนนี้
            </div>
          ) : (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {actionAlerts.map((alert) => (
                <Link
                  key={alert.id}
                  href={alert.href}
                  className={`group rounded-lg border p-4 transition hover:-translate-y-0.5 hover:shadow-sm ${ACTION_TONE_CONFIG[alert.tone]}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{alert.title}</p>
                      <p className="mt-1 text-xs opacity-85">{alert.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" />
                  </div>
                  <p className="mt-3 text-xs font-semibold">{alert.actionLabel}</p>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="inbox" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-[520px]">
          <TabsTrigger value="inbox">Inbox Admin</TabsTrigger>
          <TabsTrigger value="insights">คำแนะนำ</TabsTrigger>
          <TabsTrigger value="history">ประวัติทั้งหมด</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" id="admin-inbox" className="space-y-3">
          {adminInbox.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-slate-400">
                <Bell className="mx-auto mb-3 h-10 w-10 opacity-40" />
                ยังไม่มีแจ้งเตือนที่ส่งถึง Admin นี้
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {pagedAdminInbox.map((notification) => renderNotification(notification, true))}
            </div>
          )}
          {adminInbox.length > 0 && (
            <Card className="overflow-hidden border-slate-200">
              <ListPagination
                page={safeInboxPage}
                pageSize={inboxPageSize}
                total={adminInbox.length}
                onPageChange={setInboxPage}
                onPageSizeChange={setInboxPageSize}
                pageSizeOptions={[10, 15, 25]}
              />
            </Card>
          )}
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <InsightPanel
              title="ผู้เรียนใกล้หมดคอร์ส"
              description="ใช้คอร์สไปมากแล้ว แต่ยังไม่จองเดือนถัดไป"
              emptyText="ยังไม่มีรายการที่ต้องติดตาม"
              alerts={nonRenewalAlerts}
              onSend={openSuggestedNotification}
            />
            <InsightPanel
              title="รอบเรียนคนน้อย"
              description="รอบที่มีผู้เรียน 1-2 คน ควรพิจารณาจัดกลุ่ม"
              emptyText="ยังไม่มีรอบเรียนที่ต้องจับตา"
              alerts={lowEnrollmentAlerts}
            />
            <InsightPanel
              title="ติดตามลูกค้าเก่า"
              description="ผู้เรียนที่เคยเรียน แต่ยังไม่กลับมาจองรอบล่าสุด"
              emptyText="ยังไม่มีลูกค้าที่ต้องติดตามเพิ่ม"
              alerts={customerFollowUpAlerts}
              onSend={openSuggestedNotification}
            />
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          <Card>
            <CardContent className="p-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_180px_180px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value)
                      setHistoryPage(1)
                    }}
                    placeholder="ค้นหาหัวข้อ, ข้อความ, ผู้รับ..."
                    className="pl-10"
                  />
                </div>
                <Select value={filterType} onValueChange={(value) => {
                  setFilterType(value)
                  setHistoryPage(1)
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกประเภท</SelectItem>
                    {Object.entries(TYPE_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterAudience} onValueChange={(value) => {
                  setFilterAudience(value)
                  setHistoryPage(1)
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ผู้รับทั้งหมด</SelectItem>
                    {Object.entries(ROLE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {filteredNotifications.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-slate-400">
                ไม่พบแจ้งเตือนตามตัวกรอง
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {pagedHistory.map((notification) => renderNotification(notification, true))}
            </div>
          )}
          {filteredNotifications.length > 0 && (
            <Card className="overflow-hidden border-slate-200">
              <ListPagination
                page={safeHistoryPage}
                pageSize={historyPageSize}
                total={filteredNotifications.length}
                onPageChange={setHistoryPage}
                onPageSizeChange={setHistoryPageSize}
                pageSizeOptions={[10, 15, 25, 50]}
              />
            </Card>
          )}
          <p className="text-center text-xs text-slate-400">
            แสดง {filteredNotifications.length} จาก {notifications.length} รายการ
          </p>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">ส่งแจ้งเตือน</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>กลุ่มผู้รับ</Label>
                <Select value={targetMode} onValueChange={setTargetMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TARGET_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>ประเภท</Label>
                <Select value={formType} onValueChange={(value) => setFormType(value as NotificationType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {targetMode === 'specific' && (
              <div className="space-y-1.5">
                <Label>ผู้รับ</Label>
                <Select value={formUserId} onValueChange={setFormUserId}>
                  <SelectTrigger><SelectValue placeholder="เลือกผู้รับ" /></SelectTrigger>
                  <SelectContent>
                    {users.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.full_name} ({ROLE_LABELS[option.role]})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>หัวข้อ *</Label>
              <Input
                value={formTitle}
                onChange={(event) => setFormTitle(event.target.value)}
                placeholder="หัวข้อแจ้งเตือน"
              />
            </div>
            <div className="space-y-1.5">
              <Label>ข้อความ *</Label>
              <Textarea
                value={formMessage}
                onChange={(event) => setFormMessage(event.target.value)}
                placeholder="รายละเอียดแจ้งเตือน"
                rows={4}
              />
            </div>
            <div className="space-y-1.5">
              <Label>ลิงก์ปลายทาง</Label>
              <Input
                value={formLinkUrl}
                onChange={(event) => setFormLinkUrl(event.target.value)}
                placeholder="/dashboard/booking หรือ /admin/payments"
              />
            </div>
            <Button
              className="w-full gap-2 bg-[#2748bf] hover:bg-[#153c85]"
              onClick={sendNotification}
              disabled={loading || !formTitle.trim() || !formMessage.trim()}
            >
              <Send className="h-4 w-4" />
              {loading ? 'กำลังส่ง...' : 'ส่งแจ้งเตือน'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InsightPanel({
  title,
  description,
  emptyText,
  alerts,
  onSend,
}: {
  title: string
  description: string
  emptyText: string
  alerts: AlertInsight[]
  onSend?: (alert: AlertInsight) => void
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div>
          <p className="font-semibold text-[#153c85]">{title}</p>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        {alerts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
            {emptyText}
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className={`rounded-lg border px-3 py-2 text-sm ${ALERT_LEVEL_CONFIG[alert.level]}`}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{alert.title}</p>
                    <p className="mt-0.5 text-xs opacity-85">{alert.description}</p>
                    {onSend && alert.userId && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 h-8 gap-1 text-xs"
                        onClick={() => onSend(alert)}
                      >
                        <Users className="h-3.5 w-3.5" />
                        ส่งแจ้งเตือน
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

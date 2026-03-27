'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Search, Bell, BellRing, Send, Plus, User, Clock, CheckCircle2, Circle,
} from 'lucide-react'

interface NotificationData {
  id: string
  user_id: string
  title: string
  message: string
  type: string
  is_read: boolean
  link_url: string | null
  created_at: string
  user_name: string
}

interface UserOption {
  id: string
  full_name: string
  email: string
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
}

interface NotificationsAdminClientProps {
  notifications: NotificationData[]
  users: UserOption[]
  nonRenewalAlerts: AlertInsight[]
  lowEnrollmentAlerts: AlertInsight[]
  customerFollowUpAlerts: AlertInsight[]
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  payment: { label: 'ชำระเงิน', color: 'bg-green-100 text-green-700' },
  schedule: { label: 'ตารางเรียน', color: 'bg-blue-100 text-blue-700' },
  reminder: { label: 'เตือน', color: 'bg-yellow-100 text-yellow-700' },
  complaint: { label: 'ร้องเรียน', color: 'bg-red-100 text-red-700' },
  system: { label: 'ระบบ', color: 'bg-gray-100 text-gray-700' },
}

const ALERT_LEVEL_CONFIG: Record<AlertInsight['level'], string> = {
  red: 'border-red-200 bg-red-50 text-red-700',
  yellow: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  green: 'border-green-200 bg-green-50 text-green-700',
}

export function NotificationsAdminClient({ notifications, users, nonRenewalAlerts, lowEnrollmentAlerts, customerFollowUpAlerts }: NotificationsAdminClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form
  const [formUserId, setFormUserId] = useState<string>('')
  const [formTitle, setFormTitle] = useState('')
  const [formMessage, setFormMessage] = useState('')
  const [formType, setFormType] = useState<string>('system')

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (filterType !== 'all' && n.type !== filterType) return false
      if (!search) return true
      const q = search.toLowerCase()
      return n.title.toLowerCase().includes(q) || n.user_name.toLowerCase().includes(q) || n.message.toLowerCase().includes(q)
    })
  }, [notifications, search, filterType])

  const stats = useMemo(() => ({
    total: notifications.length,
    unread: notifications.filter((n) => !n.is_read).length,
    today: notifications.filter((n) => new Date(n.created_at).toISOString().split('T')[0] === new Date().toISOString().split('T')[0]).length,
  }), [notifications])

  const formatDate = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })

  const openNew = () => {
    setError(null)
    setFormUserId('')
    setFormTitle('')
    setFormMessage('')
    setFormType('system')
    setDialogOpen(true)
  }

  const openSuggestedNotification = (alert: AlertInsight) => {
    setError(null)
    setFormUserId(alert.userId || '')
    setFormTitle(alert.notificationTitle || alert.title)
    setFormMessage(alert.notificationMessage || alert.description)
    setFormType(alert.notificationType || 'reminder')
    setDialogOpen(true)
  }

  const sendNotification = async () => {
    if (!formTitle.trim() || !formMessage.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: formUserId || null,
          title: formTitle.trim(),
          message: formMessage.trim(),
          type: formType,
        }),
      })

      const result = await res.json().catch(() => null)
      if (!res.ok) {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#153c85]">แจ้งเตือน</h1>
          <p className="text-gray-500 text-sm mt-1">ศูนย์แจ้งเตือนทั้งหมดของระบบ</p>
        </div>
        <Button className="bg-[#2748bf] hover:bg-[#153c85]" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" />ส่งแจ้งเตือน
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-[#2748bf]">{stats.total}</p><p className="text-xs text-gray-500">ทั้งหมด</p>
        </CardContent></Card>
        <Card className={stats.unread > 0 ? 'ring-2 ring-orange-300' : ''}><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-orange-500">{stats.unread}</p><p className="text-xs text-gray-500">ยังไม่อ่าน</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.today}</p><p className="text-xs text-gray-500">วันนี้</p>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <p className="font-semibold text-[#153c85]">Notifly: นักเรียนไม่ต่อคอร์ส</p>
              <p className="text-xs text-gray-500">แจ้งเตือนตามเปอร์เซ็นต์การใช้คอร์สและยังไม่จองเดือนถัดไป</p>
            </div>
            {nonRenewalAlerts.length === 0 ? (
              <p className="text-sm text-gray-400">ยังไม่มีรายการที่ต้องติดตาม</p>
            ) : (
              <div className="space-y-2">
                {nonRenewalAlerts.map((alert) => (
                  <div key={alert.id} className={`rounded-md border px-3 py-2 text-sm ${ALERT_LEVEL_CONFIG[alert.level]}`}>
                    <p className="font-medium">{alert.title}</p>
                    <p className="text-xs opacity-90 mt-0.5">{alert.description}</p>
                    {alert.userId && (
                      <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={() => openSuggestedNotification(alert)}>
                        ส่งแจ้งเตือน
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <p className="font-semibold text-[#153c85]">Notifly: คลาสคนน้อย</p>
              <p className="text-xs text-gray-500">ดูคลาสที่มีผู้เรียน 1-2 คน หรือมากกว่า</p>
            </div>
            {lowEnrollmentAlerts.length === 0 ? (
              <p className="text-sm text-gray-400">ยังไม่มีข้อมูลคลาสที่ต้องจับตา</p>
            ) : (
              <div className="space-y-2">
                {lowEnrollmentAlerts.map((alert) => (
                  <div key={alert.id} className={`rounded-md border px-3 py-2 text-sm ${ALERT_LEVEL_CONFIG[alert.level]}`}>
                    <p className="font-medium">{alert.title}</p>
                    <p className="text-xs opacity-90 mt-0.5">{alert.description}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <p className="font-semibold text-[#153c85]">ติดตามลูกค้าเก่า</p>
              <p className="text-xs text-gray-500">ลูกค้าเดือนก่อนไม่ลงเรียน และลูกค้าเก่าที่ควรชวนกลับมา</p>
            </div>
            {customerFollowUpAlerts.length === 0 ? (
              <p className="text-sm text-gray-400">ยังไม่มีรายการติดตามเพิ่มเติม</p>
            ) : (
              <div className="space-y-2">
                {customerFollowUpAlerts.map((alert) => (
                  <div key={alert.id} className={`rounded-md border px-3 py-2 text-sm ${ALERT_LEVEL_CONFIG[alert.level]}`}>
                    <p className="font-medium">{alert.title}</p>
                    <p className="text-xs opacity-90 mt-0.5">{alert.description}</p>
                    {alert.userId && (
                      <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={() => openSuggestedNotification(alert)}>
                        ส่งแจ้งเตือน
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="ค้นหาหัวข้อ, ชื่อผู้ใช้..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกประเภท</SelectItem>
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Notification list */}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">
          <Bell className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">ไม่พบแจ้งเตือน</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((notif) => {
            const typeCfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system
            return (
              <Card key={notif.id} className={`overflow-hidden ${!notif.is_read ? 'border-blue-200 bg-blue-50/30' : ''}`}>
                <CardContent className="p-0">
                  <div className="flex items-start gap-3 p-4">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${!notif.is_read ? 'bg-blue-100' : 'bg-gray-100'}`}>
                      {!notif.is_read ? <BellRing className="h-4 w-4 text-blue-600" /> : <Bell className="h-4 w-4 text-gray-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`font-semibold text-sm ${!notif.is_read ? 'text-[#153c85]' : 'text-gray-700'}`}>{notif.title}</p>
                        <Badge className={`text-[10px] ${typeCfg.color}`}>{typeCfg.label}</Badge>
                        {!notif.is_read && <Circle className="h-2 w-2 fill-blue-500 text-blue-500" />}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{notif.user_name}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(notif.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">แสดง {filtered.length} จาก {notifications.length} รายการ</p>

      {/* Send Notification Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">ส่งแจ้งเตือน</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}
            <div>
              <Label>ส่งถึง</Label>
              <Select value={formUserId} onValueChange={setFormUserId}>
                <SelectTrigger><SelectValue placeholder="เลือกผู้ใช้ (เว้นว่าง = ทุกคน)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ส่งถึงทุกคน</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name} ({u.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ประเภท</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>หัวข้อ *</Label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="หัวข้อแจ้งเตือน" />
            </div>
            <div>
              <Label>ข้อความ *</Label>
              <Textarea value={formMessage} onChange={(e) => setFormMessage(e.target.value)} placeholder="รายละเอียดแจ้งเตือน" rows={3} />
            </div>
            <Button className="w-full bg-[#2748bf] hover:bg-[#153c85]" onClick={sendNotification} disabled={loading || !formTitle.trim() || !formMessage.trim()}>
              <Send className="h-4 w-4 mr-1" />{loading ? 'กำลังส่ง...' : 'ส่งแจ้งเตือน'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

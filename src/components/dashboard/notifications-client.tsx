'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Bell, BellRing, CheckCheck, Clock, Search, Circle } from 'lucide-react'

interface NotificationRow {
  id: string
  title: string
  message: string
  type: string
  is_read: boolean
  link_url: string | null
  created_at: string
}

interface NotificationsClientProps {
  notifications: NotificationRow[]
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  payment: { label: 'ชำระเงิน', color: 'bg-green-100 text-green-700' },
  schedule: { label: 'ตารางเรียน', color: 'bg-blue-100 text-blue-700' },
  reminder: { label: 'เตือน', color: 'bg-yellow-100 text-yellow-700' },
  complaint: { label: 'ร้องเรียน', color: 'bg-red-100 text-red-700' },
  system: { label: 'ระบบ', color: 'bg-gray-100 text-gray-700' },
}

export function NotificationsClient({ notifications }: NotificationsClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localReadIds, setLocalReadIds] = useState<Set<string>>(new Set())

  const mergedNotifications = useMemo(() => {
    return notifications.map((notification) => ({
      ...notification,
      is_read: notification.is_read || localReadIds.has(notification.id),
    }))
  }, [notifications, localReadIds])

  const filtered = useMemo(() => {
    return mergedNotifications.filter((notification) => {
      if (filterType !== 'all' && notification.type !== filterType) return false
      if (!search) return true
      const query = search.toLowerCase()
      return notification.title.toLowerCase().includes(query) || notification.message.toLowerCase().includes(query)
    })
  }, [mergedNotifications, filterType, search])

  const unreadCount = mergedNotifications.filter((notification) => !notification.is_read).length

  const formatDate = (date: string) => new Date(date).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const markAsRead = async (notificationId?: string) => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId, markAll: !notificationId }),
      })

      const result = await res.json().catch(() => null)
      if (!res.ok) {
        setError(result?.error || 'อัปเดตการอ่านไม่สำเร็จ')
        return
      }

      if (notificationId) {
        setLocalReadIds((prev) => new Set(Array.from(prev).concat(notificationId)))
      } else {
        setLocalReadIds(new Set(mergedNotifications.map((notification) => notification.id)))
      }

      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#153c85]">แจ้งเตือนของฉัน</h1>
          <p className="mt-1 text-sm text-gray-500">ติดตามสถานะการจอง การชำระเงิน และข้อความจากระบบ</p>
        </div>
        <Button
          variant="outline"
          onClick={() => markAsRead()}
          disabled={loading || unreadCount === 0}
        >
          <CheckCheck className="mr-2 h-4 w-4" />
          อ่านทั้งหมดแล้ว
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-[#2748bf]">{mergedNotifications.length}</p><p className="text-xs text-gray-500">ทั้งหมด</p></CardContent></Card>
        <Card className={unreadCount > 0 ? 'ring-2 ring-orange-300' : ''}><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-orange-500">{unreadCount}</p><p className="text-xs text-gray-500">ยังไม่อ่าน</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">{mergedNotifications.filter((notification) => new Date(notification.created_at).toISOString().split('T')[0] === new Date().toISOString().split('T')[0]).length}</p><p className="text-xs text-gray-500">วันนี้</p></CardContent></Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาหัวข้อหรือข้อความ..." className="pl-10" />
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

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-gray-400">
            <Bell className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="font-medium">ไม่พบแจ้งเตือน</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((notification) => {
            const typeConfig = TYPE_CONFIG[notification.type] || TYPE_CONFIG.system
            const content = (
              <Card className={`overflow-hidden transition-colors ${!notification.is_read ? 'border-blue-200 bg-blue-50/30' : ''}`}>
                <CardContent className="p-0">
                  <div className="flex items-start gap-3 p-4">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${!notification.is_read ? 'bg-blue-100' : 'bg-gray-100'}`}>
                      {!notification.is_read ? <BellRing className="h-4 w-4 text-blue-600" /> : <Bell className="h-4 w-4 text-gray-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={`text-sm font-semibold ${!notification.is_read ? 'text-[#153c85]' : 'text-gray-700'}`}>{notification.title}</p>
                        <Badge className={`text-[10px] ${typeConfig.color}`}>{typeConfig.label}</Badge>
                        {!notification.is_read && <Circle className="h-2 w-2 fill-blue-500 text-blue-500" />}
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">{notification.message}</p>
                      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-gray-400">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(notification.created_at)}</span>
                      </div>
                    </div>
                    {!notification.is_read && (
                      <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={(e) => { e.preventDefault(); e.stopPropagation(); markAsRead(notification.id) }} disabled={loading}>
                        อ่านแล้ว
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )

            if (notification.link_url) {
              return <Link key={notification.id} href={notification.link_url}>{content}</Link>
            }

            return <div key={notification.id}>{content}</div>
          })}
        </div>
      )}
    </div>
  )
}

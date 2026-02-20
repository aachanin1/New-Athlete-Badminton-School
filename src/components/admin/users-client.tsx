'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  Search, Users, UserCog, Baby, Mail, Phone, Calendar, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Shield,
} from 'lucide-react'
import type { UserRole } from '@/types/database'

interface ChildInfo {
  id: string
  full_name: string
  nickname: string | null
}

interface UserData {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: UserRole
  created_at: string
  children: ChildInfo[]
  booking_count: number
}

interface UsersClientProps {
  users: UserData[]
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  user: { label: 'ผู้ใช้', color: 'bg-gray-100 text-gray-600' },
  coach: { label: 'โค้ช', color: 'bg-blue-100 text-blue-700' },
  head_coach: { label: 'หัวหน้าโค้ช', color: 'bg-purple-100 text-purple-700' },
  admin: { label: 'Admin', color: 'bg-orange-100 text-orange-700' },
  super_admin: { label: 'Super Admin', color: 'bg-red-100 text-red-700' },
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'user', label: 'ผู้ใช้ (User)' },
  { value: 'coach', label: 'โค้ช (Coach)' },
  { value: 'head_coach', label: 'หัวหน้าโค้ช (Head Coach)' },
  { value: 'admin', label: 'Admin' },
  { value: 'super_admin', label: 'Super Admin' },
]

export function UsersClient({ users }: UsersClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState<string>('all')
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [editUser, setEditUser] = useState<UserData | null>(null)
  const [editRole, setEditRole] = useState<UserRole>('user')
  const [editOpen, setEditOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (filterRole !== 'all' && u.role !== filterRole) return false
      if (!search) return true
      const q = search.toLowerCase()
      return u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone && u.phone.includes(q)) ||
        u.children.some((c) => c.full_name.toLowerCase().includes(q) || (c.nickname && c.nickname.toLowerCase().includes(q)))
    })
  }, [users, search, filterRole])

  const stats = useMemo(() => ({
    total: users.length,
    parents: users.filter((u) => u.role === 'user' && u.children.length > 0).length,
    adults: users.filter((u) => u.role === 'user' && u.children.length === 0).length,
    coaches: users.filter((u) => ['coach', 'head_coach'].includes(u.role)).length,
    totalChildren: users.reduce((sum, u) => sum + u.children.length, 0),
  }), [users])

  const openEditRole = (user: UserData) => {
    setEditUser(user)
    setEditRole(user.role)
    setError(null)
    setSuccess(null)
    setEditOpen(true)
  }

  const handleChangeRole = async () => {
    if (!editUser) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: editUser.id, role: editRole }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'เกิดข้อผิดพลาด')
        setLoading(false)
        return
      }
      setSuccess(`เปลี่ยน role เป็น "${ROLE_LABELS[editRole]?.label}" สำเร็จ!`)
      setLoading(false)
      setTimeout(() => {
        setEditOpen(false)
        router.refresh()
      }, 1200)
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">จัดการนักเรียน / ผู้ปกครอง</h1>
        <p className="text-gray-500 text-sm mt-1">ดูข้อมูลผู้ใช้ทั้งหมด, ข้อมูลลูก, เปลี่ยน role</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-[#2748bf]">{stats.total}</p><p className="text-xs text-gray-500">ผู้ใช้ทั้งหมด</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.parents}</p><p className="text-xs text-gray-500">ผู้ปกครอง</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.adults}</p><p className="text-xs text-gray-500">ผู้เรียน (ผู้ใหญ่)</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{stats.coaches}</p><p className="text-xs text-gray-500">โค้ช</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-orange-600">{stats.totalChildren}</p><p className="text-xs text-gray-500">เด็กทั้งหมด</p>
        </CardContent></Card>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="ค้นหาชื่อ, อีเมล, เบอร์โทร, ชื่อลูก..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-48"><SelectValue placeholder="ทุก role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุก role</SelectItem>
            <SelectItem value="user">ผู้ใช้ (User)</SelectItem>
            <SelectItem value="coach">โค้ช</SelectItem>
            <SelectItem value="head_coach">หัวหน้าโค้ช</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="super_admin">Super Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-gray-500">แสดง {filtered.length} จาก {users.length} คน</p>

      {/* User list */}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">ไม่พบผู้ใช้</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((user) => {
            const roleInfo = ROLE_LABELS[user.role] || { label: user.role, color: 'bg-gray-100' }
            const isExpanded = expandedUser === user.id
            return (
              <Card key={user.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedUser(isExpanded ? null : user.id)}>
                    <div className="w-10 h-10 rounded-full bg-[#2748bf]/10 flex items-center justify-center text-[#2748bf] font-bold shrink-0">
                      {user.full_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm truncate">{user.full_name}</p>
                        <Badge className={`text-[10px] ${roleInfo.color}`}>{roleInfo.label}</Badge>
                        {user.children.length > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            <Baby className="h-3 w-3 mr-0.5" />{user.children.length} คน
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    <div className="hidden md:flex items-center gap-4 text-xs text-gray-400 shrink-0">
                      {user.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{user.phone}</span>}
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(user.created_at)}</span>
                      <span>{user.booking_count} จอง</span>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />}
                  </div>

                  {isExpanded && (
                    <div className="border-t px-4 py-3 bg-gray-50/50 space-y-3">
                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                        <span className="flex items-center gap-1.5 text-gray-600"><Mail className="h-3.5 w-3.5" />{user.email}</span>
                        {user.phone && <span className="flex items-center gap-1.5 text-gray-600"><Phone className="h-3.5 w-3.5" />{user.phone}</span>}
                        <span className="flex items-center gap-1.5 text-gray-600"><Calendar className="h-3.5 w-3.5" />สมัคร {formatDate(user.created_at)}</span>
                        <span className="text-gray-600">{user.booking_count} การจอง</span>
                      </div>

                      {user.children.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1.5">ลูก/บุตรหลาน:</p>
                          <div className="flex flex-wrap gap-2">
                            {user.children.map((c) => (
                              <Badge key={c.id} variant="outline" className="text-xs py-1">
                                <Baby className="h-3 w-3 mr-1" />
                                {c.full_name}{c.nickname ? ` (${c.nickname})` : ''}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end">
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openEditRole(user) }}>
                          <Shield className="h-3.5 w-3.5 mr-1.5" />เปลี่ยน Role
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Edit Role Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { if (!loading) setEditOpen(v) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">เปลี่ยน Role</DialogTitle>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
              {success && <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0" />{success}</div>}

              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium">{editUser.full_name}</p>
                <p className="text-sm text-gray-500">{editUser.email}</p>
                <Badge className={`mt-1 text-xs ${ROLE_LABELS[editUser.role]?.color}`}>
                  ปัจจุบัน: {ROLE_LABELS[editUser.role]?.label}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label>เปลี่ยนเป็น</Label>
                <Select value={editRole} onValueChange={(v) => setEditRole(v as UserRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {editRole !== editUser.role && (
                <p className="text-xs text-orange-600 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  จะเปลี่ยนจาก "{ROLE_LABELS[editUser.role]?.label}" → "{ROLE_LABELS[editRole]?.label}"
                </p>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditOpen(false)} disabled={loading}>ยกเลิก</Button>
                <Button onClick={handleChangeRole} disabled={loading || editRole === editUser.role} className="bg-[#2748bf] hover:bg-[#153c85]">
                  {loading ? 'กำลังบันทึก...' : 'บันทึก'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

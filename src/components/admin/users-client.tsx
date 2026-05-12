'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertCircle,
  Baby,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  Search,
  Shield,
  UserCheck,
  UserCog,
  Users,
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
  currentAdminRole: UserRole
}

const ROLE_LABELS: Record<string, { label: string; badge: string; short: string }> = {
  user: { label: 'ผู้ใช้ทั่วไป', short: 'User', badge: 'bg-gray-100 text-gray-700' },
  coach: { label: 'โค้ช', short: 'Coach', badge: 'bg-blue-100 text-blue-700' },
  head_coach: { label: 'หัวหน้าโค้ช', short: 'Head Coach', badge: 'bg-violet-100 text-violet-700' },
  admin: { label: 'Admin', short: 'Admin', badge: 'bg-orange-100 text-orange-700' },
  super_admin: { label: 'Super Admin', short: 'Super Admin', badge: 'bg-rose-100 text-rose-700' },
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'user', label: 'ผู้ใช้ทั่วไป (User)' },
  { value: 'coach', label: 'โค้ช (Coach)' },
  { value: 'head_coach', label: 'หัวหน้าโค้ช (Head Coach)' },
  { value: 'admin', label: 'Admin' },
  { value: 'super_admin', label: 'Super Admin' },
]

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  })
}

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?'
}

export function UsersClient({ users, currentAdminRole }: UsersClientProps) {
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

  const isSuperAdmin = currentAdminRole === 'super_admin'

  const editableRoleOptions = useMemo(() => {
    if (isSuperAdmin) return ROLE_OPTIONS
    return ROLE_OPTIONS.filter((option) => !['admin', 'super_admin'].includes(option.value))
  }, [isSuperAdmin])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    return users.filter((user) => {
      if (filterRole !== 'all' && user.role !== filterRole) return false
      if (!q) return true

      return [
        user.full_name,
        user.email,
        user.phone || '',
        user.role,
        ...user.children.flatMap((child) => [child.full_name, child.nickname || '']),
      ].some((value) => value.toLowerCase().includes(q))
    })
  }, [users, search, filterRole])

  const stats = useMemo(() => {
    const parentUsers = users.filter((user) => user.role === 'user' && user.children.length > 0)
    const adultUsers = users.filter((user) => user.role === 'user' && user.children.length === 0)
    const coaches = users.filter((user) => ['coach', 'head_coach'].includes(user.role))
    const admins = users.filter((user) => ['admin', 'super_admin'].includes(user.role))

    return {
      total: users.length,
      parents: parentUsers.length,
      adults: adultUsers.length,
      coaches: coaches.length,
      admins: admins.length,
      children: users.reduce((sum, user) => sum + user.children.length, 0),
      bookings: users.reduce((sum, user) => sum + user.booking_count, 0),
    }
  }, [users])

  const openEditRole = (user: UserData) => {
    if (!isSuperAdmin && ['admin', 'super_admin'].includes(user.role)) {
      setError('เฉพาะ Super Admin เท่านั้นที่แก้ไข role ของ Admin และ Super Admin ได้')
      setSuccess(null)
      return
    }

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
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: editUser.id, role: editRole }),
      })
      const json = await response.json()

      if (!response.ok) {
        setError(json.error || 'เปลี่ยน role ไม่สำเร็จ')
        setLoading(false)
        return
      }

      setSuccess(`เปลี่ยน role เป็น "${ROLE_LABELS[editRole]?.label || editRole}" สำเร็จ`)
      setLoading(false)
      setTimeout(() => {
        setEditOpen(false)
        router.refresh()
      }, 1000)
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#2748bf]">
            <Users className="h-4 w-4" />
            User Management
          </div>
          <h1 className="mt-1 text-2xl font-bold text-[#153c85]">จัดการนักเรียน / ผู้ปกครอง</h1>
          <p className="mt-1 text-sm text-gray-500">
            ดูข้อมูลผู้ใช้ เด็กในความดูแล ประวัติการจอง และจัดการ role ตามสิทธิ์ของ admin
          </p>
        </div>

        <Badge variant="outline" className="w-fit bg-white px-3 py-2 text-xs text-gray-600">
          สิทธิ์ปัจจุบัน: {ROLE_LABELS[currentAdminRole]?.label || currentAdminRole}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-6">
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">ผู้ใช้ทั้งหมด</p>
              <p className="mt-1 text-xl font-bold text-[#2748bf] sm:text-2xl">{stats.total}</p>
            </div>
            <Users className="h-5 w-5 text-[#2748bf]" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">ผู้ปกครอง</p>
              <p className="mt-1 text-xl font-bold text-emerald-600 sm:text-2xl">{stats.parents}</p>
            </div>
            <UserCheck className="h-5 w-5 text-emerald-500" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">ผู้ใหญ่</p>
              <p className="mt-1 text-xl font-bold text-blue-600 sm:text-2xl">{stats.adults}</p>
            </div>
            <UserCheck className="h-5 w-5 text-blue-500" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">เด็กทั้งหมด</p>
              <p className="mt-1 text-xl font-bold text-orange-500 sm:text-2xl">{stats.children}</p>
            </div>
            <Baby className="h-5 w-5 text-orange-500" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">โค้ช</p>
              <p className="mt-1 text-xl font-bold text-violet-600 sm:text-2xl">{stats.coaches}</p>
            </div>
            <UserCog className="h-5 w-5 text-violet-500" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">การจองรวม</p>
              <p className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">{stats.bookings}</p>
            </div>
            <Calendar className="h-5 w-5 text-gray-500" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-gray-200">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-lg">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="ค้นหาชื่อ, อีเมล, เบอร์โทร, ชื่อลูก..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="w-full sm:w-52">
                  <SelectValue placeholder="ทุก role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุก role</SelectItem>
                  <SelectItem value="user">ผู้ใช้ทั่วไป</SelectItem>
                  <SelectItem value="coach">โค้ช</SelectItem>
                  <SelectItem value="head_coach">หัวหน้าโค้ช</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 sm:min-w-28 sm:text-right">
                แสดง {filtered.length} จาก {users.length} คน
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && !editOpen && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center text-gray-400">
            <Users className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="font-medium">ไม่พบผู้ใช้ตามเงื่อนไขที่เลือก</p>
            <p className="mt-1 text-sm">ลองเปลี่ยนคำค้นหาหรือตัวกรอง role</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <div className="hidden grid-cols-[minmax(260px,1.4fr)_minmax(220px,1fr)_160px_130px_120px] gap-4 border-b bg-gray-50 px-4 py-3 text-xs font-medium text-gray-500 xl:grid">
            <span>ผู้ใช้</span>
            <span>ติดต่อ</span>
            <span>เด็ก/ผู้เรียน</span>
            <span>การจอง</span>
            <span className="text-right">จัดการ</span>
          </div>

          <div className="divide-y">
            {filtered.map((user) => {
              const roleInfo = ROLE_LABELS[user.role] || { label: user.role, short: user.role, badge: 'bg-gray-100 text-gray-700' }
              const isExpanded = expandedUser === user.id
              const canEditRole = isSuperAdmin || !['admin', 'super_admin'].includes(user.role)

              return (
                <div key={user.id} className="transition-colors hover:bg-gray-50">
                  <div className="grid gap-3 px-4 py-4 xl:grid-cols-[minmax(260px,1.4fr)_minmax(220px,1fr)_160px_130px_120px] xl:items-center xl:gap-4">
                    <button
                      type="button"
                      className="flex min-w-0 items-center gap-3 text-left"
                      onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2748bf]/10 font-bold text-[#2748bf]">
                        {getInitial(user.full_name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-gray-900">{user.full_name || 'ไม่ระบุชื่อ'}</p>
                          <Badge className={`text-[10px] ${roleInfo.badge}`}>{roleInfo.short}</Badge>
                        </div>
                        <p className="mt-1 truncate text-xs text-gray-400">สมัคร {formatDate(user.created_at)}</p>
                      </div>
                    </button>

                    <div className="min-w-0 text-sm text-gray-500">
                      <p className="flex min-w-0 items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{user.email || '-'}</span>
                      </p>
                      <p className="mt-1 flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        {user.phone || 'ยังไม่มีเบอร์โทร'}
                      </p>
                    </div>

                    <div className="text-sm">
                      <p className="font-medium text-gray-900">{user.children.length} คน</p>
                      <p className="mt-1 truncate text-xs text-gray-500">
                        {user.children.length > 0
                          ? user.children.map((child) => child.nickname || child.full_name).join(', ')
                          : user.role === 'user' ? 'ผู้เรียนผู้ใหญ่/ยังไม่มีข้อมูลเด็ก' : '-'}
                      </p>
                    </div>

                    <div className="text-sm">
                      <p className="font-semibold text-[#153c85]">{user.booking_count}</p>
                      <p className="text-xs text-gray-500">รายการ</p>
                    </div>

                    <div className="flex gap-2 xl:justify-end">
                      <Button variant="outline" size="sm" onClick={() => setExpandedUser(isExpanded ? null : user.id)}>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditRole(user)}
                        disabled={!canEditRole}
                        title={canEditRole ? 'เปลี่ยน role' : 'เฉพาะ Super Admin เท่านั้น'}
                      >
                        <Shield className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t bg-gray-50/60 px-4 py-4">
                      <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
                        <div className="space-y-3">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="rounded-lg bg-white p-3">
                              <p className="text-xs text-gray-400">ชื่อผู้ใช้</p>
                              <p className="mt-1 font-medium">{user.full_name || '-'}</p>
                            </div>
                            <div className="rounded-lg bg-white p-3">
                              <p className="text-xs text-gray-400">Role</p>
                              <Badge className={`mt-1 ${roleInfo.badge}`}>{roleInfo.label}</Badge>
                            </div>
                            <div className="rounded-lg bg-white p-3">
                              <p className="text-xs text-gray-400">อีเมล</p>
                              <p className="mt-1 break-all text-sm">{user.email || '-'}</p>
                            </div>
                            <div className="rounded-lg bg-white p-3">
                              <p className="text-xs text-gray-400">เบอร์โทร</p>
                              <p className="mt-1 text-sm">{user.phone || '-'}</p>
                            </div>
                          </div>

                          <div className="rounded-lg bg-white p-3">
                            <p className="mb-2 text-xs font-medium text-gray-500">เด็ก/ผู้เรียนในความดูแล</p>
                            {user.children.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {user.children.map((child) => (
                                  <Badge key={child.id} variant="outline" className="py-1 text-xs">
                                    <Baby className="mr-1 h-3 w-3" />
                                    {child.full_name}{child.nickname ? ` (${child.nickname})` : ''}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-400">ยังไม่มีข้อมูลเด็ก หรือเป็นผู้เรียนผู้ใหญ่</p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="rounded-lg bg-white p-3">
                            <p className="text-xs text-gray-400">ข้อมูลระบบ</p>
                            <div className="mt-2 space-y-2 text-sm text-gray-600">
                              <p className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                สมัครเมื่อ {formatDate(user.created_at)}
                              </p>
                              <p className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                การจองทั้งหมด {user.booking_count} รายการ
                              </p>
                            </div>
                          </div>

                          <Button
                            className="w-full bg-[#2748bf] hover:bg-[#153c85]"
                            onClick={() => openEditRole(user)}
                            disabled={!canEditRole}
                          >
                            <Shield className="mr-2 h-4 w-4" />
                            เปลี่ยน Role
                          </Button>
                          {!canEditRole && (
                            <p className="text-xs text-gray-500">เฉพาะ Super Admin เท่านั้นที่จัดการ role ระดับ Admin ได้</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={(value) => { if (!loading) setEditOpen(value) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">เปลี่ยน Role</DialogTitle>
          </DialogHeader>

          {editUser && (
            <div className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-600">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-600">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {success}
                </div>
              )}

              <div className="rounded-lg bg-gray-50 p-3">
                <p className="font-medium">{editUser.full_name}</p>
                <p className="text-sm text-gray-500">{editUser.email}</p>
                <Badge className={`mt-2 text-xs ${ROLE_LABELS[editUser.role]?.badge}`}>
                  ปัจจุบัน: {ROLE_LABELS[editUser.role]?.label || editUser.role}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label>เปลี่ยนเป็น</Label>
                <Select value={editRole} onValueChange={(value) => setEditRole(value as UserRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {editableRoleOptions.map((role) => (
                      <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!isSuperAdmin && (
                <p className="text-xs text-gray-500">Admin จัดการได้เฉพาะ User, Coach และ Head Coach เท่านั้น</p>
              )}

              {editRole !== editUser.role && (
                <p className="flex items-center gap-1 text-xs text-orange-600">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>
                    จะเปลี่ยนจาก {ROLE_LABELS[editUser.role]?.label} เป็น {ROLE_LABELS[editRole]?.label}
                  </span>
                </p>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditOpen(false)} disabled={loading}>
                  ยกเลิก
                </Button>
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

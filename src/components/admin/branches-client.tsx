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
import { Switch } from '@/components/ui/switch'
import { ListPagination } from '@/components/admin/list-pagination'
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Edit2,
  MapPin,
  Plus,
  Search,
  UserCog,
  Users,
  XCircle,
} from 'lucide-react'

interface BranchData {
  id: string
  name: string
  slug: string
  address: string | null
  is_active: boolean
  created_at: string
  coach_count: number
  booking_count: number
}

interface BranchesClientProps {
  branches: BranchData[]
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  }).format(new Date(value))
}

export function BranchesClient({ branches }: BranchesClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState('all')
  const [editOpen, setEditOpen] = useState(false)
  const [editBranch, setEditBranch] = useState<BranchData | null>(null)
  const [formName, setFormName] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formActive, setFormActive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  const stats = useMemo(() => {
    const activeBranches = branches.filter((branch) => branch.is_active)
    const branchesWithCoach = branches.filter((branch) => branch.coach_count > 0)
    const activeWithoutCoach = activeBranches.filter((branch) => branch.coach_count === 0)
    const totalBookings = branches.reduce((sum, branch) => sum + branch.booking_count, 0)

    return {
      total: branches.length,
      active: activeBranches.length,
      inactive: branches.length - activeBranches.length,
      branchesWithCoach: branchesWithCoach.length,
      activeWithoutCoach: activeWithoutCoach.length,
      totalBookings,
    }
  }, [branches])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    return branches.filter((branch) => {
      if (filterActive === 'active' && !branch.is_active) return false
      if (filterActive === 'inactive' && branch.is_active) return false
      if (filterActive === 'no-coach' && (!branch.is_active || branch.coach_count > 0)) return false
      if (!q) return true

      return [
        branch.name,
        branch.slug,
        branch.address || '',
        String(branch.coach_count),
        String(branch.booking_count),
      ].some((value) => value.toLowerCase().includes(q))
    })
  }, [branches, filterActive, search])

  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)))
  const pagedBranches = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const openEdit = (branch: BranchData) => {
    setError(null)
    setEditBranch(branch)
    setFormName(branch.name)
    setFormAddress(branch.address || '')
    setFormActive(branch.is_active)
    setIsNew(false)
    setEditOpen(true)
  }

  const openNew = () => {
    setError(null)
    setEditBranch(null)
    setFormName('')
    setFormAddress('')
    setFormActive(true)
    setIsNew(true)
    setEditOpen(true)
  }

  const saveBranch = async () => {
    if (!formName.trim()) {
      setError('กรุณากรอกชื่อสาขา')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/branches', {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editBranch?.id,
          name: formName.trim(),
          address: formAddress.trim() || null,
          is_active: formActive,
        }),
      })

      const result = await response.json().catch(() => null)

      if (!response.ok) {
        setError(result?.error || 'บันทึกข้อมูลสาขาไม่สำเร็จ')
        return
      }

      setEditOpen(false)
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#2748bf]">
            <Building2 className="h-4 w-4" />
            Branch Operations
          </div>
          <h1 className="text-2xl font-bold text-[#153c85]">จัดการสาขา</h1>
          <p className="mt-1 text-sm text-gray-500">ดูสถานะสาขา จำนวนโค้ช และยอดจองที่ผูกกับแต่ละสาขา</p>
        </div>
        <Button className="h-10 bg-[#2748bf] hover:bg-[#153c85]" onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          เพิ่มสาขา
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="border-gray-200">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">ทั้งหมด</p>
              <Building2 className="h-4 w-4 text-[#2748bf]" />
            </div>
            <p className="mt-1 text-xl font-bold sm:text-2xl">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">เปิดใช้งาน</p>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="mt-1 text-xl font-bold text-emerald-600 sm:text-2xl">{stats.active}</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">ปิดใช้งาน</p>
              <XCircle className="h-4 w-4 text-gray-400" />
            </div>
            <p className="mt-1 text-xl font-bold text-gray-500 sm:text-2xl">{stats.inactive}</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">มีโค้ชแล้ว</p>
              <UserCog className="h-4 w-4 text-blue-500" />
            </div>
            <p className="mt-1 text-xl font-bold text-blue-600 sm:text-2xl">{stats.branchesWithCoach}</p>
          </CardContent>
        </Card>
        <Card className={stats.activeWithoutCoach > 0 ? 'border-amber-300 bg-amber-50/50' : 'border-gray-200'}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">ยังไม่มีโค้ช</p>
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </div>
            <p className="mt-1 text-xl font-bold text-amber-600 sm:text-2xl">{stats.activeWithoutCoach}</p>
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">ยอดจองรวม</p>
              <Users className="h-4 w-4 text-orange-500" />
            </div>
            <p className="mt-1 text-xl font-bold text-orange-500 sm:text-2xl">{stats.totalBookings}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-gray-200">
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-lg">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              className="h-10 pl-10"
              placeholder="ค้นหาชื่อสาขา, slug, ที่อยู่..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select
              value={filterActive}
              onValueChange={(value) => {
                setFilterActive(value)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-10 w-full sm:w-[190px]">
                <SelectValue placeholder="สถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสถานะ</SelectItem>
                <SelectItem value="active">เปิดใช้งาน</SelectItem>
                <SelectItem value="inactive">ปิดใช้งาน</SelectItem>
                <SelectItem value="no-coach">เปิดแต่ยังไม่มีโค้ช</SelectItem>
              </SelectContent>
            </Select>
            <p className="whitespace-nowrap text-sm text-gray-500">แสดง {filtered.length} จาก {branches.length} สาขา</p>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500">
              <tr>
                <th className="px-4 py-3">สาขา</th>
                <th className="px-4 py-3">สถานะ</th>
                <th className="px-4 py-3">ทีมโค้ช</th>
                <th className="px-4 py-3">ยอดจอง</th>
                <th className="px-4 py-3">วันที่สร้าง</th>
                <th className="px-4 py-3 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center text-gray-400">
                    <Building2 className="mx-auto mb-3 h-10 w-10 opacity-40" />
                    ไม่พบสาขาตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              ) : (
                pagedBranches.map((branch) => (
                  <tr key={branch.id} className="bg-white align-top hover:bg-gray-50/70">
                    <td className="px-4 py-4">
                      <div className="flex items-start gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${branch.is_active ? 'bg-blue-50' : 'bg-gray-100'}`}>
                          <Building2 className={`h-5 w-5 ${branch.is_active ? 'text-[#2748bf]' : 'text-gray-400'}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-950">{branch.name}</p>
                          <p className="mt-0.5 text-xs text-gray-400">/{branch.slug}</p>
                          {branch.address ? (
                            <p className="mt-2 flex max-w-md items-start gap-1.5 text-xs text-gray-500">
                              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span>{branch.address}</span>
                            </p>
                          ) : (
                            <p className="mt-2 text-xs text-amber-600">ยังไม่ได้ระบุที่อยู่</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {branch.is_active ? (
                        <Badge className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          เปิดใช้งาน
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 border-gray-200 bg-gray-50 text-gray-500">
                          <XCircle className="h-3.5 w-3.5" />
                          ปิดใช้งาน
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-gray-950">{branch.coach_count} คน</div>
                      {branch.is_active && branch.coach_count === 0 ? (
                        <p className="mt-1 text-xs text-amber-600">ควรมอบหมายโค้ชก่อนเปิดรอบเรียน</p>
                      ) : (
                        <p className="mt-1 text-xs text-gray-400">พร้อมสำหรับการจัดตาราง</p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-gray-950">{branch.booking_count} รายการ</div>
                      <p className="mt-1 text-xs text-gray-400">นับเฉพาะ paid/verified</p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 text-gray-600">
                        <CalendarDays className="h-4 w-4 text-gray-400" />
                        {formatDate(branch.created_at)}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Button variant="outline" size="sm" className="h-9" onClick={() => openEdit(branch)}>
                        <Edit2 className="mr-2 h-4 w-4" />
                        แก้ไข
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <ListPagination
            page={safePage}
            pageSize={pageSize}
            total={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize)
              setPage(1)
            }}
          />
        )}
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">{isNew ? 'เพิ่มสาขาใหม่' : 'แก้ไขสาขา'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label>ชื่อสาขา</Label>
              <Input
                value={formName}
                onChange={(event) => setFormName(event.target.value)}
                placeholder="เช่น สาขาเมืองทองธานี"
              />
            </div>
            <div className="space-y-2">
              <Label>ที่อยู่</Label>
              <Input
                value={formAddress}
                onChange={(event) => setFormAddress(event.target.value)}
                placeholder="ที่อยู่สาขา"
              />
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label>เปิดใช้งาน</Label>
                  <p className="mt-1 text-xs text-gray-500">สาขาที่เปิดใช้งานจะถูกใช้ในรอบเรียนและการจอง</p>
                </div>
                <Switch checked={formActive} onCheckedChange={setFormActive} />
              </div>
            </div>
            <Button className="h-10 w-full bg-[#2748bf] hover:bg-[#153c85]" onClick={saveBranch} disabled={loading || !formName.trim()}>
              {loading ? 'กำลังบันทึก...' : isNew ? 'เพิ่มสาขา' : 'บันทึกการแก้ไข'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

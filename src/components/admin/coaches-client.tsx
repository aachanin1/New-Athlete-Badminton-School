'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertCircle,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Edit2,
  Mail,
  MapPin,
  Phone,
  Search,
  Shield,
  UserCog,
  UserPlus,
} from 'lucide-react'
import type { Branch, CoachEmploymentType } from '@/types/database'
import { COACH_EMPLOYMENT_OPTIONS, normalizeCoachEmploymentType } from '@/lib/coach-teaching-rules'

interface CoachData {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: string
  employment_type: string | null
  created_at: string
  branches: { branch_id: string; is_head_coach: boolean; branch_name: string }[]
}

interface CoachesClientProps {
  coaches: CoachData[]
  branches: Branch[]
}

const ROLE_LABELS: Record<string, { label: string; badge: string; description: string }> = {
  coach: {
    label: 'โค้ชผู้สอน',
    badge: 'bg-blue-100 text-blue-700',
    description: 'รับผิดชอบรอบเรียนที่ได้รับมอบหมาย',
  },
  head_coach: {
    label: 'หัวหน้าโค้ช',
    badge: 'bg-violet-100 text-violet-700',
    description: 'จัดกลุ่ม/มอบหมายโค้ช และสามารถสอนเองได้',
  },
}

const EMPLOYMENT_LABELS: Record<CoachEmploymentType, { label: string; badge: string }> = {
  full_time: { label: 'Full-Time', badge: 'bg-emerald-100 text-emerald-700' },
  half_time: { label: 'Half-Time', badge: 'bg-blue-100 text-blue-700' },
  part_time: { label: 'Part-Time', badge: 'bg-orange-100 text-orange-700' },
}

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?'
}

export function CoachesClient({ coaches: initialCoaches, branches }: CoachesClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editCoach, setEditCoach] = useState<CoachData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formRole, setFormRole] = useState<string>('coach')
  const [formEmploymentType, setFormEmploymentType] = useState<string>('unset')
  const [formBranches, setFormBranches] = useState<string[]>([])

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmTitle, setConfirmTitle] = useState('')
  const [confirmDesc, setConfirmDesc] = useState('')
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null)

  const stats = useMemo(() => {
    const headCoaches = initialCoaches.filter((coach) => coach.role === 'head_coach')
    const regularCoaches = initialCoaches.filter((coach) => coach.role === 'coach')
    const missingEmploymentType = initialCoaches.filter((coach) => !normalizeCoachEmploymentType(coach.employment_type)).length
    const assignedBranchIds = new Set(initialCoaches.flatMap((coach) => coach.branches.map((branch) => branch.branch_id)))
    const headCoachBranchIds = new Set(headCoaches.flatMap((coach) => coach.branches.map((branch) => branch.branch_id)))

    return {
      total: initialCoaches.length,
      regular: regularCoaches.length,
      head: headCoaches.length,
      activeBranches: branches.length,
      branchesWithCoach: assignedBranchIds.size,
      branchesWithoutHeadCoach: branches.filter((branch) => !headCoachBranchIds.has(branch.id)).length,
      missingEmploymentType,
    }
  }, [initialCoaches, branches])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    return initialCoaches.filter((coach) => {
      if (filterRole !== 'all' && coach.role !== filterRole) return false
      if (!q) return true

      return [
        coach.full_name,
        coach.email,
        coach.phone || '',
        coach.role,
        ...coach.branches.map((branch) => branch.branch_name),
      ].some((value) => value.toLowerCase().includes(q))
    })
  }, [initialCoaches, search, filterRole])

  const resetForm = () => {
    setFormName('')
    setFormEmail('')
    setFormPassword('')
    setFormPhone('')
    setFormRole('coach')
    setFormEmploymentType('unset')
    setFormBranches([])
    setError(null)
    setSuccess(null)
  }

  const toggleBranch = (branchId: string) => {
    setFormBranches((previous) =>
      previous.includes(branchId) ? previous.filter((id) => id !== branchId) : [...previous, branchId]
    )
  }

  const handleAdd = async () => {
    if (!formName.trim() || !formEmail.trim() || !formPassword.trim()) {
      setError('กรุณากรอกชื่อ อีเมล และรหัสผ่าน')
      return
    }
    if (formPassword.length < 6) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/coaches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formEmail.trim(),
          password: formPassword,
          full_name: formName.trim(),
          phone: formPhone.trim() || null,
          role: formRole,
          employmentType: formEmploymentType === 'unset' ? null : formEmploymentType,
          branchIds: formBranches,
        }),
      })
      const json = await response.json()

      if (!response.ok) {
        setError(json.error || 'สร้างบัญชีโค้ชไม่สำเร็จ')
        setLoading(false)
        return
      }

      setSuccess(`สร้างบัญชี "${formName}" สำเร็จ`)
      setLoading(false)
      setTimeout(() => {
        setAddOpen(false)
        resetForm()
        router.refresh()
      }, 1000)
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
      setLoading(false)
    }
  }

  const openEdit = (coach: CoachData) => {
    setEditCoach(coach)
    setFormName(coach.full_name)
    setFormEmail(coach.email)
    setFormPhone(coach.phone || '')
    setFormRole(coach.role)
    setFormEmploymentType(normalizeCoachEmploymentType(coach.employment_type) || 'unset')
    setFormBranches(coach.branches.map((branch) => branch.branch_id))
    setFormPassword('')
    setError(null)
    setSuccess(null)
    setEditOpen(true)
  }

  const handleEdit = async () => {
    if (!editCoach) return
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/coaches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId: editCoach.id,
          role: formRole,
          phone: formPhone.trim() || null,
          employmentType: formEmploymentType === 'unset' ? null : formEmploymentType,
          branchIds: formBranches,
        }),
      })
      const json = await response.json()

      if (!response.ok) {
        setError(json.error || 'อัปเดตข้อมูลโค้ชไม่สำเร็จ')
        setLoading(false)
        return
      }

      setSuccess('อัปเดตข้อมูลโค้ชสำเร็จ')
      setLoading(false)
      setTimeout(() => {
        setEditOpen(false)
        resetForm()
        setEditCoach(null)
        router.refresh()
      }, 1000)
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
      setLoading(false)
    }
  }

  const handleDemote = (coach: CoachData) => {
    setConfirmTitle('ปลดจากโค้ช')
    setConfirmDesc(`ต้องการเปลี่ยน "${coach.full_name}" กลับเป็น User และลบสาขาที่ผูกไว้ทั้งหมดหรือไม่?`)
    setConfirmAction(() => async () => {
      setLoading(true)
      setError(null)
      setSuccess(null)

      try {
        const response = await fetch('/api/admin/coaches', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coachId: coach.id, role: 'user', branchIds: [] }),
        })

        const result = await response.json().catch(() => null)
        if (!response.ok) {
          setError(result?.error || 'ปลดจากโค้ชไม่สำเร็จ')
          setLoading(false)
          return
        }

        setSuccess(`เปลี่ยน "${coach.full_name}" กลับเป็น User แล้ว`)
        setLoading(false)
        router.refresh()
      } catch {
        setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
        setLoading(false)
      }
    })
    setConfirmOpen(true)
  }

  const renderBranchPicker = () => (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {branches.map((branch) => (
        <label key={branch.id} className="flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 transition-colors hover:bg-gray-50">
          <Checkbox checked={formBranches.includes(branch.id)} onCheckedChange={() => toggleBranch(branch.id)} />
          <span className="text-sm">{branch.name}</span>
        </label>
      ))}
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#2748bf]">
            <UserCog className="h-4 w-4" />
            Coach Management
          </div>
          <h1 className="mt-1 text-2xl font-bold text-[#153c85]">จัดการโค้ช</h1>
          <p className="mt-1 text-sm text-gray-500">
            เพิ่ม/แก้ไขโค้ช ผูกสาขา และกำหนดหัวหน้าโค้ช โดยหัวหน้าโค้ชสามารถสอนเองและมอบหมายรอบเรียนให้โค้ชคนอื่นได้
          </p>
        </div>

        <Button onClick={() => { resetForm(); setAddOpen(true) }} className="bg-[#2748bf] hover:bg-[#153c85]">
          <UserPlus className="mr-2 h-4 w-4" />
          เพิ่มโค้ชใหม่
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-6">
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">โค้ชทั้งหมด</p>
              <p className="mt-1 text-xl font-bold text-[#2748bf] sm:text-2xl">{stats.total}</p>
            </div>
            <UserCog className="h-5 w-5 text-[#2748bf]" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">โค้ชผู้สอน</p>
              <p className="mt-1 text-xl font-bold text-blue-600 sm:text-2xl">{stats.regular}</p>
            </div>
            <UserCog className="h-5 w-5 text-blue-500" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">หัวหน้าโค้ช</p>
              <p className="mt-1 text-xl font-bold text-violet-600 sm:text-2xl">{stats.head}</p>
            </div>
            <Shield className="h-5 w-5 text-violet-500" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">สาขาเปิดสอน</p>
              <p className="mt-1 text-xl font-bold text-emerald-600 sm:text-2xl">{stats.activeBranches}</p>
            </div>
            <Building2 className="h-5 w-5 text-emerald-500" />
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">สาขามีโค้ช</p>
              <p className="mt-1 text-xl font-bold text-orange-500 sm:text-2xl">{stats.branchesWithCoach}</p>
            </div>
            <MapPin className="h-5 w-5 text-orange-500" />
          </CardContent>
        </Card>
        <Card className={stats.branchesWithoutHeadCoach > 0 ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200'}>
          <CardContent className="flex items-center justify-between p-3 sm:p-4">
            <div>
              <p className="text-xs text-gray-500">ไม่มีหัวหน้า</p>
              <p className="mt-1 text-xl font-bold text-amber-600 sm:text-2xl">{stats.branchesWithoutHeadCoach}</p>
            </div>
            <AlertCircle className="h-5 w-5 text-amber-500" />
          </CardContent>
        </Card>
      </div>

      <Card className="border-gray-200">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-lg">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="ค้นหาชื่อ, อีเมล, เบอร์โทร, สาขา..."
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
                  <SelectItem value="coach">โค้ชผู้สอน</SelectItem>
                  <SelectItem value="head_coach">หัวหน้าโค้ช</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 sm:min-w-28 sm:text-right">
                แสดง {filtered.length} จาก {initialCoaches.length} คน
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {(error || success) && !addOpen && !editOpen && (
        <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {error ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {error || success}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center text-gray-400">
            <UserCog className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="font-medium">{search || filterRole !== 'all' ? 'ไม่พบโค้ชตามเงื่อนไขที่เลือก' : 'ยังไม่มีโค้ชในระบบ'}</p>
            <p className="mt-1 text-sm">เพิ่มโค้ชใหม่เพื่อเริ่มผูกสาขาและมอบหมายรอบเรียน</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-white">
          <div className="hidden grid-cols-[minmax(240px,1.1fr)_minmax(190px,0.9fr)_minmax(220px,1fr)_130px_130px_110px] gap-4 border-b bg-gray-50 px-4 py-3 text-xs font-medium text-gray-500 2xl:grid">
            <span>โค้ช</span>
            <span>ติดต่อ</span>
            <span>สาขาที่สอน</span>
            <span>บทบาท</span>
            <span>ประเภทโค้ช</span>
            <span className="text-right">จัดการ</span>
          </div>

          <div className="divide-y">
            {filtered.map((coach) => {
              const roleInfo = ROLE_LABELS[coach.role] || { label: coach.role, badge: 'bg-gray-100 text-gray-700', description: '' }
              const employmentType = normalizeCoachEmploymentType(coach.employment_type)
              const employmentInfo = employmentType ? EMPLOYMENT_LABELS[employmentType] : null

              return (
                <div key={coach.id} className="grid gap-3 px-4 py-4 transition-colors hover:bg-gray-50 2xl:grid-cols-[minmax(240px,1.1fr)_minmax(190px,0.9fr)_minmax(220px,1fr)_130px_130px_110px] 2xl:items-center 2xl:gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2748bf]/10 font-bold text-[#2748bf]">
                      {getInitial(coach.full_name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900">{coach.full_name}</p>
                      <p className="mt-1 text-xs text-gray-500">{roleInfo.description}</p>
                    </div>
                  </div>

                  <div className="min-w-0 text-sm text-gray-500">
                    <p className="flex min-w-0 items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{coach.email}</span>
                    </p>
                    <p className="mt-1 flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      {coach.phone || 'ยังไม่มีเบอร์โทร'}
                    </p>
                  </div>

                  <div>
                    {coach.branches.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {coach.branches.map((branch) => (
                          <Badge key={branch.branch_id} variant="outline" className="text-xs">
                            <MapPin className="mr-1 h-3 w-3" />
                            {branch.branch_name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="flex items-center gap-1 text-xs text-amber-600">
                        <AlertCircle className="h-3.5 w-3.5" />
                        ยังไม่ได้กำหนดสาขา
                      </p>
                    )}
                  </div>

                  <div>
                    <Badge className={`text-xs ${roleInfo.badge}`}>{roleInfo.label}</Badge>
                  </div>

                  <div>
                    {employmentInfo ? (
                      <Badge className={`text-xs ${employmentInfo.badge}`}>
                        <BriefcaseBusiness className="mr-1 h-3 w-3" />
                        {employmentInfo.label}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-xs text-amber-700">
                        <AlertCircle className="mr-1 h-3 w-3" />
                        ยังไม่ตั้งประเภท
                      </Badge>
                    )}
                  </div>

                  <div className="flex gap-2 xl:justify-end">
                    <Button variant="outline" size="sm" onClick={() => openEdit(coach)}>
                      <Edit2 className="mr-1.5 h-4 w-4" />
                      แก้ไข
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={(value) => { if (!loading) { setAddOpen(value); if (!value) resetForm() } }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">เพิ่มโค้ชใหม่</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error && <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-600"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
            {success && <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4 shrink-0" />{success}</div>}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>ชื่อ-นามสกุล *</Label>
                <Input placeholder="ชื่อโค้ช" value={formName} onChange={(event) => setFormName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>เบอร์โทร</Label>
                <Input placeholder="08x-xxx-xxxx" value={formPhone} onChange={(event) => setFormPhone(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>อีเมล *</Label>
                <Input type="email" placeholder="coach@email.com" value={formEmail} onChange={(event) => setFormEmail(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>รหัสผ่าน *</Label>
                <Input type="password" placeholder="อย่างน้อย 6 ตัวอักษร" value={formPassword} onChange={(event) => setFormPassword(event.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="coach">โค้ชผู้สอน</SelectItem>
                  <SelectItem value="head_coach">หัวหน้าโค้ช</SelectItem>
                </SelectContent>
              </Select>
              {formRole === 'head_coach' && (
                <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700">
                  หัวหน้าโค้ชสามารถมอบหมายรอบเรียนให้โค้ชคนอื่น และเลือกสอนด้วยตนเองได้
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>ประเภทโค้ชสำหรับคำนวณชั่วโมงสอน</Label>
              <Select value={formEmploymentType} onValueChange={setFormEmploymentType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">ยังไม่กำหนด</SelectItem>
                  {COACH_EMPLOYMENT_OPTIONS.map((option) => (
                    <SelectItem key={option.employmentType} value={option.employmentType}>
                      {option.label} - เกณฑ์ {option.thresholdHours} ชม./สัปดาห์
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                ประเภทนี้ใช้เฉพาะการคำนวณชั่วโมงสอน/OT ไม่เกี่ยวกับสิทธิ์ Head Coach หรือ Coach
              </p>
            </div>

            <div className="space-y-2">
              <Label>สาขาที่สอน</Label>
              {renderBranchPicker()}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setAddOpen(false); resetForm() }} disabled={loading}>ยกเลิก</Button>
              <Button onClick={handleAdd} disabled={loading} className="bg-[#2748bf] hover:bg-[#153c85]">
                {loading ? 'กำลังสร้าง...' : 'สร้างบัญชีโค้ช'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(value) => { if (!loading) { setEditOpen(value); if (!value) { resetForm(); setEditCoach(null) } } }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">แก้ไขข้อมูลโค้ช</DialogTitle>
          </DialogHeader>
          {editCoach && (
            <div className="space-y-4">
              {error && <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-600"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
              {success && <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4 shrink-0" />{success}</div>}

              <div className="rounded-lg bg-gray-50 p-3">
                <p className="font-medium">{editCoach.full_name}</p>
                <p className="text-sm text-gray-500">{editCoach.email}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>เบอร์โทร</Label>
                  <Input placeholder="08x-xxx-xxxx" value={formPhone} onChange={(event) => setFormPhone(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={formRole} onValueChange={setFormRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="coach">โค้ชผู้สอน</SelectItem>
                      <SelectItem value="head_coach">หัวหน้าโค้ช</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formRole === 'head_coach' && (
                <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700">
                  หัวหน้าโค้ชยังคงเป็นผู้สอนได้ และจะปรากฏเป็นตัวเลือกในหน้ามอบหมายรอบเรียนของสาขาที่ผูกไว้
                </p>
              )}

              <div className="space-y-2">
                <Label>ประเภทโค้ชสำหรับคำนวณชั่วโมงสอน</Label>
                <Select value={formEmploymentType} onValueChange={setFormEmploymentType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unset">ยังไม่กำหนด</SelectItem>
                    {COACH_EMPLOYMENT_OPTIONS.map((option) => (
                      <SelectItem key={option.employmentType} value={option.employmentType}>
                        {option.label} - เกณฑ์ {option.thresholdHours} ชม./สัปดาห์
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  ประเภทนี้ใช้เฉพาะการคำนวณชั่วโมงสอน/OT ไม่เกี่ยวกับสิทธิ์ Head Coach หรือ Coach
                </p>
              </div>

              <div className="space-y-2">
                <Label>สาขาที่สอน</Label>
                {renderBranchPicker()}
              </div>

              <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <Button variant="outline" className="border-rose-200 text-rose-500 hover:bg-rose-50" onClick={() => handleDemote(editCoach)}>
                  ปลดจากโค้ช
                </Button>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setEditOpen(false); resetForm(); setEditCoach(null) }} disabled={loading}>ยกเลิก</Button>
                  <Button onClick={handleEdit} disabled={loading} className="bg-[#2748bf] hover:bg-[#153c85]">
                    {loading ? 'กำลังบันทึก...' : 'บันทึก'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-500 hover:bg-rose-600"
              disabled={loading}
              onClick={() => {
                confirmAction?.()
                setConfirmOpen(false)
                setEditOpen(false)
                resetForm()
                setEditCoach(null)
              }}
            >
              ยืนยัน
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

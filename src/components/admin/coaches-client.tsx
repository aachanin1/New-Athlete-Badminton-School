'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import {
  UserPlus, UserCog, MapPin, Phone, Mail, Shield, Building2, Search, Edit2, AlertCircle, CheckCircle2,
} from 'lucide-react'
import type { Branch } from '@/types/database'

interface CoachData {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: string
  created_at: string
  branches: { branch_id: string; is_head_coach: boolean; branch_name: string }[]
}

interface CoachesClientProps {
  coaches: CoachData[]
  branches: Branch[]
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  coach: { label: 'โค้ช', color: 'bg-blue-100 text-blue-700' },
  head_coach: { label: 'หัวหน้าโค้ช', color: 'bg-purple-100 text-purple-700' },
}

export function CoachesClient({ coaches: initialCoaches, branches }: CoachesClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editCoach, setEditCoach] = useState<CoachData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Add form state
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formRole, setFormRole] = useState<string>('coach')
  const [formBranches, setFormBranches] = useState<string[]>([])

  // Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmTitle, setConfirmTitle] = useState('')
  const [confirmDesc, setConfirmDesc] = useState('')
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null)

  const resetForm = useCallback(() => {
    setFormName('')
    setFormEmail('')
    setFormPassword('')
    setFormPhone('')
    setFormRole('coach')
    setFormBranches([])
    setError(null)
    setSuccess(null)
  }, [])

  const filtered = initialCoaches.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return c.full_name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) ||
      c.branches.some((b) => b.branch_name.toLowerCase().includes(q))
  })

  const toggleBranch = (branchId: string) => {
    setFormBranches((prev) =>
      prev.includes(branchId) ? prev.filter((id) => id !== branchId) : [...prev, branchId]
    )
  }

  const handleAdd = async () => {
    if (!formName.trim() || !formEmail.trim() || !formPassword.trim()) {
      setError('กรุณากรอกชื่อ, อีเมล และรหัสผ่าน')
      return
    }
    if (formPassword.length < 6) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/coaches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formEmail.trim(),
          password: formPassword,
          full_name: formName.trim(),
          phone: formPhone.trim() || null,
          role: formRole,
          branchIds: formBranches,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'เกิดข้อผิดพลาด')
        setLoading(false)
        return
      }

      setSuccess(`สร้างบัญชีโค้ช "${formName}" สำเร็จ!`)
      setLoading(false)
      setTimeout(() => {
        setAddOpen(false)
        resetForm()
        router.refresh()
      }, 1500)
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
    setFormBranches(coach.branches.map((b) => b.branch_id))
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
      const res = await fetch('/api/admin/coaches', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId: editCoach.id,
          role: formRole,
          phone: formPhone.trim() || null,
          branchIds: formBranches,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'เกิดข้อผิดพลาด')
        setLoading(false)
        return
      }

      setSuccess('อัปเดตข้อมูลสำเร็จ!')
      setLoading(false)
      setTimeout(() => {
        setEditOpen(false)
        resetForm()
        setEditCoach(null)
        router.refresh()
      }, 1500)
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
      setLoading(false)
    }
  }

  const handleDemote = (coach: CoachData) => {
    setConfirmTitle('ปลดจากโค้ช')
    setConfirmDesc(`ต้องการเปลี่ยน "${coach.full_name}" กลับเป็น User ธรรมดาหรือไม่? จะลบสาขาที่ผูกไว้ทั้งหมด`)
    setConfirmAction(() => async () => {
      setLoading(true)
      setError(null)
      setSuccess(null)

      try {
        const res = await fetch('/api/admin/coaches', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coachId: coach.id, role: 'user', branchIds: [] }),
        })

        const result = await res.json().catch(() => null)
        if (!res.ok) {
          setError(result?.error || 'ปลดจากโค้ชไม่สำเร็จ')
          setLoading(false)
          return
        }

        setSuccess(`เปลี่ยน "${coach.full_name}" กลับเป็น User แล้ว`)
        setLoading(false)
        router.refresh()
      } catch {
        setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
        setLoading(false)
      }
    })
    setConfirmOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#153c85]">จัดการโค้ช</h1>
          <p className="text-gray-500 text-sm mt-1">เพิ่ม แก้ไข กำหนด role และสาขาให้โค้ช</p>
        </div>
        <Button onClick={() => { resetForm(); setAddOpen(true) }} className="bg-[#2748bf] hover:bg-[#153c85]">
          <UserPlus className="h-4 w-4 mr-2" /> เพิ่มโค้ชใหม่
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input placeholder="ค้นหาชื่อ, อีเมล, สาขา..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center"><UserCog className="h-5 w-5 text-blue-600" /></div>
            <div><p className="text-2xl font-bold">{initialCoaches.length}</p><p className="text-xs text-gray-500">โค้ชทั้งหมด</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center"><Shield className="h-5 w-5 text-purple-600" /></div>
            <div><p className="text-2xl font-bold">{initialCoaches.filter((c) => c.role === 'head_coach').length}</p><p className="text-xs text-gray-500">หัวหน้าโค้ช</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center"><Building2 className="h-5 w-5 text-green-600" /></div>
            <div><p className="text-2xl font-bold">{branches.length}</p><p className="text-xs text-gray-500">สาขาทั้งหมด</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center"><MapPin className="h-5 w-5 text-orange-600" /></div>
            <div>
              <p className="text-2xl font-bold">
                {branches.filter((b) => !initialCoaches.some((c) => c.branches.some((cb) => cb.branch_id === b.id && c.role === 'head_coach'))).length}
              </p>
              <p className="text-xs text-gray-500">สาขายังไม่มีหัวหน้า</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Coach list */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <UserCog className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">{search ? 'ไม่พบโค้ชที่ค้นหา' : 'ยังไม่มีโค้ชในระบบ'}</p>
            <p className="text-sm mt-1">กดปุ่ม "เพิ่มโค้ชใหม่" เพื่อสร้างบัญชีโค้ช</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((coach) => {
            const roleInfo = ROLE_LABELS[coach.role] || { label: coach.role, color: 'bg-gray-100 text-gray-600' }
            return (
              <Card key={coach.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-[#2748bf]/10 flex items-center justify-center text-[#2748bf] font-bold text-lg">
                        {coach.full_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-[#153c85]">{coach.full_name}</p>
                        <Badge className={`text-xs mt-0.5 ${roleInfo.color}`}>{roleInfo.label}</Badge>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(coach)}>
                      <Edit2 className="h-4 w-4 text-gray-400" />
                    </Button>
                  </div>

                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center gap-2 text-gray-500">
                      <Mail className="h-3.5 w-3.5" /><span>{coach.email}</span>
                    </div>
                    {coach.phone && (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Phone className="h-3.5 w-3.5" /><span>{coach.phone}</span>
                      </div>
                    )}
                  </div>

                  {coach.branches.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {coach.branches.map((b) => (
                        <Badge key={b.branch_id} variant="outline" className="text-xs">
                          <MapPin className="h-3 w-3 mr-1" />{b.branch_name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-orange-500 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" /> ยังไม่ได้กำหนดสาขา
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ===== Add Coach Dialog ===== */}
      <Dialog open={addOpen} onOpenChange={(v) => { if (!loading) { setAddOpen(v); if (!v) resetForm() } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">เพิ่มโค้ชใหม่</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
            {success && <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0" />{success}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ชื่อ-นามสกุล *</Label>
                <Input placeholder="ชื่อโค้ช" value={formName} onChange={(e) => setFormName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>เบอร์โทร</Label>
                <Input placeholder="08x-xxx-xxxx" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>อีเมล *</Label>
                <Input type="email" placeholder="coach@email.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>รหัสผ่าน *</Label>
                <Input type="password" placeholder="อย่างน้อย 6 ตัวอักษร" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="coach">โค้ช (ผู้ฝึกสอน)</SelectItem>
                  <SelectItem value="head_coach">หัวหน้าโค้ช (ประจำสาขา)</SelectItem>
                </SelectContent>
              </Select>
              {formRole === 'head_coach' && (
                <p className="text-xs text-purple-600">หัวหน้าโค้ชสามารถแบ่งกลุ่มนักเรียนให้โค้ชในสาขาได้</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>สาขาที่สอน (เลือกได้หลายสาขา)</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {branches.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors">
                    <Checkbox checked={formBranches.includes(b.id)} onCheckedChange={() => toggleBranch(b.id)} />
                    <span className="text-sm">{b.name}</span>
                  </label>
                ))}
              </div>
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

      {/* ===== Edit Coach Dialog ===== */}
      <Dialog open={editOpen} onOpenChange={(v) => { if (!loading) { setEditOpen(v); if (!v) { resetForm(); setEditCoach(null) } } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">แก้ไขข้อมูลโค้ช</DialogTitle>
          </DialogHeader>
          {editCoach && (
            <div className="space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
              {success && <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0" />{success}</div>}

              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium">{editCoach.full_name}</p>
                <p className="text-sm text-gray-500">{editCoach.email}</p>
              </div>

              <div className="space-y-2">
                <Label>เบอร์โทร</Label>
                <Input placeholder="08x-xxx-xxxx" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={formRole} onValueChange={setFormRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="coach">โค้ช (ผู้ฝึกสอน)</SelectItem>
                    <SelectItem value="head_coach">หัวหน้าโค้ช (ประจำสาขา)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>สาขาที่สอน</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {branches.map((b) => (
                    <label key={b.id} className="flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors">
                      <Checkbox checked={formBranches.includes(b.id)} onCheckedChange={() => toggleBranch(b.id)} />
                      <span className="text-sm">{b.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" className="text-red-500 border-red-200 hover:bg-red-50" onClick={() => handleDemote(editCoach)}>
                  ปลดจากโค้ช
                </Button>
                <div className="flex gap-2">
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

      {/* Confirm Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
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

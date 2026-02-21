'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Search, Building2, MapPin, Plus, Pencil, CheckCircle2, XCircle,
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

export function BranchesClient({ branches }: BranchesClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<string>('all')
  const [editOpen, setEditOpen] = useState(false)
  const [editBranch, setEditBranch] = useState<BranchData | null>(null)
  const [formName, setFormName] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formActive, setFormActive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [isNew, setIsNew] = useState(false)

  const filtered = useMemo(() => {
    return branches.filter((b) => {
      if (filterActive === 'active' && !b.is_active) return false
      if (filterActive === 'inactive' && b.is_active) return false
      if (!search) return true
      const q = search.toLowerCase()
      return b.name.toLowerCase().includes(q) || (b.address || '').toLowerCase().includes(q)
    })
  }, [branches, search, filterActive])

  const stats = useMemo(() => ({
    total: branches.length,
    active: branches.filter((b) => b.is_active).length,
    inactive: branches.filter((b) => !b.is_active).length,
  }), [branches])

  const openEdit = (branch: BranchData) => {
    setEditBranch(branch)
    setFormName(branch.name)
    setFormAddress(branch.address || '')
    setFormActive(branch.is_active)
    setIsNew(false)
    setEditOpen(true)
  }

  const openNew = () => {
    setEditBranch(null)
    setFormName('')
    setFormAddress('')
    setFormActive(true)
    setIsNew(true)
    setEditOpen(true)
  }

  const saveBranch = async () => {
    if (!formName.trim()) return
    setLoading(true)
    try {
      await fetch('/api/admin/branches', {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editBranch?.id,
          name: formName.trim(),
          address: formAddress.trim() || null,
          is_active: formActive,
        }),
      })
      setEditOpen(false)
      router.refresh()
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#153c85]">จัดการสาขา</h1>
          <p className="text-gray-500 text-sm mt-1">ดูและแก้ไขข้อมูลสาขาทั้งหมด</p>
        </div>
        <Button className="bg-[#2748bf] hover:bg-[#153c85]" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" />เพิ่มสาขา
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-[#2748bf]">{stats.total}</p><p className="text-xs text-gray-500">ทั้งหมด</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.active}</p><p className="text-xs text-gray-500">เปิดใช้งาน</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-400">{stats.inactive}</p><p className="text-xs text-gray-500">ปิดใช้งาน</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="ค้นหาชื่อสาขา, ที่อยู่..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2">
          {['all', 'active', 'inactive'].map((v) => (
            <Button key={v} size="sm" variant={filterActive === v ? 'default' : 'outline'}
              className={filterActive === v ? 'bg-[#2748bf]' : ''} onClick={() => setFilterActive(v)}>
              {v === 'all' ? 'ทั้งหมด' : v === 'active' ? 'เปิด' : 'ปิด'}
            </Button>
          ))}
        </div>
      </div>

      {/* Branch list */}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">
          <Building2 className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">ไม่พบสาขา</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((branch) => (
            <Card key={branch.id} className={`overflow-hidden ${!branch.is_active ? 'opacity-60' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${branch.is_active ? 'bg-blue-100' : 'bg-gray-100'}`}>
                      <Building2 className={`h-5 w-5 ${branch.is_active ? 'text-[#2748bf]' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{branch.name}</p>
                        {branch.is_active ? (
                          <Badge className="text-[10px] bg-green-100 text-green-700"><CheckCircle2 className="h-3 w-3 mr-0.5" />เปิด</Badge>
                        ) : (
                          <Badge className="text-[10px] bg-gray-100 text-gray-500"><XCircle className="h-3 w-3 mr-0.5" />ปิด</Badge>
                        )}
                      </div>
                      {branch.address && (
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><MapPin className="h-3 w-3" />{branch.address}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
                        <span>slug: {branch.slug}</span>
                        <span>โค้ช: {branch.coach_count}</span>
                        <span>จอง: {branch.booking_count}</span>
                      </div>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(branch)}>
                    <Pencil className="h-4 w-4 text-gray-400" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">{isNew ? 'เพิ่มสาขาใหม่' : 'แก้ไขสาขา'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ชื่อสาขา</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="เช่น สาขาเมืองทองธานี" />
            </div>
            <div>
              <Label>ที่อยู่</Label>
              <Input value={formAddress} onChange={(e) => setFormAddress(e.target.value)} placeholder="ที่อยู่สาขา (ไม่บังคับ)" />
            </div>
            <div className="flex items-center justify-between">
              <Label>เปิดใช้งาน</Label>
              <Switch checked={formActive} onCheckedChange={setFormActive} />
            </div>
            <Button className="w-full bg-[#2748bf] hover:bg-[#153c85]" onClick={saveBranch} disabled={loading || !formName.trim()}>
              {loading ? 'กำลังบันทึก...' : isNew ? 'เพิ่มสาขา' : 'บันทึก'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

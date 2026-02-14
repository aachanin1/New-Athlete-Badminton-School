'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Child, Gender } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  UserPlus,
  Pencil,
  Trash2,
  User,
  Loader2,
  Calendar,
  Baby,
  Camera,
} from 'lucide-react'

interface ChildrenClientProps {
  initialChildren: Child[]
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
}

function calculateAge(dateStr: string | null) {
  if (!dateStr) return null
  const today = new Date()
  const birth = new Date(dateStr)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function genderLabel(g: Gender | null) {
  if (g === 'male') return 'ชาย'
  if (g === 'female') return 'หญิง'
  if (g === 'other') return 'อื่นๆ'
  return '-'
}

export function ChildrenClient({ initialChildren }: ChildrenClientProps) {
  const router = useRouter()
  const [children, setChildren] = useState<Child[]>(initialChildren)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingChild, setEditingChild] = useState<Child | null>(null)
  const [deletingChild, setDeletingChild] = useState<Child | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [fullName, setFullName] = useState('')
  const [nickname, setNickname] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState<Gender | ''>('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  const resetForm = () => {
    setFullName('')
    setNickname('')
    setDateOfBirth('')
    setGender('')
    setAvatarFile(null)
    setAvatarPreview(null)
    setError(null)
    setEditingChild(null)
  }

  const openAddDialog = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEditDialog = (child: Child) => {
    setEditingChild(child)
    setFullName(child.full_name)
    setNickname(child.nickname || '')
    setDateOfBirth(child.date_of_birth || '')
    setGender((child.gender as Gender) || '')
    setAvatarFile(null)
    setAvatarPreview(child.avatar_url || null)
    setError(null)
    setDialogOpen(true)
  }

  const openDeleteDialog = (child: Child) => {
    setDeletingChild(child)
    setDeleteDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!fullName.trim()) {
      setError('กรุณากรอกชื่อ-นามสกุล')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('กรุณาเข้าสู่ระบบใหม่')
      setLoading(false)
      return
    }

    // Upload avatar if selected
    let avatarUrl: string | null = editingChild?.avatar_url || null
    if (avatarFile) {
      const fileExt = avatarFile.name.split('.').pop() || 'jpg'
      const fileName = `children/${user.id}/${Date.now()}.${fileExt}`
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(fileName, avatarFile, { contentType: avatarFile.type, upsert: true })

      if (uploadErr) {
        setError(`อัปโหลดรูปไม่สำเร็จ: ${uploadErr.message}`)
        setLoading(false)
        return
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName)
      avatarUrl = urlData.publicUrl
    }

    const payload = {
      full_name: fullName.trim(),
      nickname: nickname.trim() || null,
      date_of_birth: dateOfBirth || null,
      gender: (gender as Gender) || null,
      avatar_url: avatarUrl,
    }

    if (editingChild) {
      // Update
      const { error: err } = await (supabase
        .from('children') as any)
        .update(payload)
        .eq('id', editingChild.id)

      if (err) {
        setError('เกิดข้อผิดพลาดในการแก้ไข กรุณาลองใหม่')
        setLoading(false)
        return
      }

      setChildren(prev =>
        prev.map(c => c.id === editingChild.id ? { ...c, ...payload, updated_at: new Date().toISOString() } : c)
      )
    } else {
      // Insert
      const { data, error: err } = await (supabase
        .from('children') as any)
        .insert({ ...payload, parent_id: user.id })
        .select()
        .single()

      if (err) {
        setError('เกิดข้อผิดพลาดในการเพิ่ม กรุณาลองใหม่')
        setLoading(false)
        return
      }

      if (data) {
        setChildren(prev => [data, ...prev])
      }
    }

    setDialogOpen(false)
    resetForm()
    setLoading(false)
    router.refresh()
  }

  const handleDelete = async () => {
    if (!deletingChild) return
    setLoading(true)

    const supabase = createClient()
    const { error: err } = await supabase
      .from('children')
      .delete()
      .eq('id', deletingChild.id)

    if (err) {
      setError('เกิดข้อผิดพลาดในการลบ กรุณาลองใหม่')
      setLoading(false)
      return
    }

    setChildren(prev => prev.filter(c => c.id !== deletingChild.id))
    setDeleteDialogOpen(false)
    setDeletingChild(null)
    setLoading(false)
    router.refresh()
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={openAddDialog} className="bg-[#2748bf] hover:bg-[#153c85]">
          <UserPlus className="h-4 w-4 mr-2" />
          เพิ่มข้อมูลลูก
        </Button>
      </div>

      {children.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="text-center text-gray-400">
              <Baby className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">ยังไม่มีข้อมูลลูก</p>
              <p className="text-sm mt-1">กดปุ่ม &quot;เพิ่มข้อมูลลูก&quot; เพื่อเริ่มต้น</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {children.map((child) => {
            const age = calculateAge(child.date_of_birth)
            return (
              <Card key={child.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden bg-[#2748bf]/10">
                        {child.avatar_url ? (
                          <img src={child.avatar_url} alt={child.full_name} className="w-full h-full object-cover" />
                        ) : (
                          <User className="h-6 w-6 text-[#2748bf]" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{child.full_name}</h3>
                        {child.nickname && (
                          <p className="text-sm text-gray-500">ชื่อเล่น: {child.nickname}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-gray-400" />
                      <span>วันเกิด: {formatDate(child.date_of_birth)}</span>
                      {age !== null && (
                        <span className="text-[#2748bf] font-medium">({age} ปี)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-gray-400" />
                      <span>เพศ: {genderLabel(child.gender)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-[#2748bf] border-[#2748bf]/30 hover:bg-[#2748bf]/5"
                      onClick={() => openEditDialog(child)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      แก้ไข
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-500 border-red-200 hover:bg-red-50"
                      onClick={() => openDeleteDialog(child)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) resetForm(); setDialogOpen(v) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">
              {editingChild ? 'แก้ไขข้อมูลลูก' : 'เพิ่มข้อมูลลูก'}
            </DialogTitle>
            <DialogDescription>
              {editingChild ? 'แก้ไขข้อมูลของลูกคุณ' : 'กรอกข้อมูลลูกของคุณ'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md border border-red-200">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="child-fullName">ชื่อ-นามสกุล *</Label>
              <Input
                id="child-fullName"
                placeholder="ชื่อ นามสกุล"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="child-nickname">ชื่อเล่น</Label>
              <Input
                id="child-nickname"
                placeholder="ชื่อเล่น (ถ้ามี)"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="child-dob">วันเกิด</Label>
              <Input
                id="child-dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>รูปโปรไฟล์</Label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="h-6 w-6 text-gray-400" />
                  )}
                </div>
                <div>
                  <Input
                    type="file"
                    accept="image/*"
                    className="text-sm"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (file.size > 2 * 1024 * 1024) {
                        setError('ไฟล์ต้องมีขนาดไม่เกิน 2MB')
                        return
                      }
                      setAvatarFile(file)
                      const reader = new FileReader()
                      reader.onload = (ev) => setAvatarPreview(ev.target?.result as string)
                      reader.readAsDataURL(file)
                    }}
                  />
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG ไม่เกิน 2MB</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="child-gender">เพศ</Label>
              <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกเพศ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">ชาย</SelectItem>
                  <SelectItem value="female">หญิง</SelectItem>
                  <SelectItem value="other">อื่นๆ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => { resetForm(); setDialogOpen(false) }}
                disabled={loading}
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-[#2748bf] hover:bg-[#153c85]"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  editingChild ? 'บันทึกการแก้ไข' : 'เพิ่มข้อมูล'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">ยืนยันการลบ</DialogTitle>
            <DialogDescription>
              คุณต้องการลบข้อมูลของ <strong>{deletingChild?.full_name}</strong> ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={loading}
            >
              ยกเลิก
            </Button>
            <Button
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  กำลังลบ...
                </>
              ) : (
                'ลบข้อมูล'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

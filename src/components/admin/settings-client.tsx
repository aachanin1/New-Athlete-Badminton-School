'use client'

/* eslint-disable react/no-unescaped-entities */

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BarChart3, Clock, Key, Pencil, Plus, Save, Settings, ShieldCheck, Tags, Wallet } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface SettingData {
  id: string
  key: string
  value: unknown
  updated_by: string | null
  updated_at: string
  updated_by_name: string | null
}

interface SettingsClientProps {
  settings: SettingData[]
}

export function SettingsClient({ settings }: SettingsClientProps) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isNew, setIsNew] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formId, setFormId] = useState('')
  const [formKey, setFormKey] = useState('')
  const [formValue, setFormValue] = useState('')

  const formatDate = (date: string) => new Date(date).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  const openEdit = (setting: SettingData) => {
    setError(null)
    setFormId(setting.id)
    setFormKey(setting.key)
    setFormValue(JSON.stringify(setting.value, null, 2))
    setIsNew(false)
    setEditOpen(true)
  }

  const openNew = () => {
    setError(null)
    setFormId('')
    setFormKey('')
    setFormValue('{}')
    setIsNew(true)
    setEditOpen(true)
  }

  const saveSetting = async () => {
    if (!formKey.trim()) return

    let parsedValue: unknown
    try {
      parsedValue = JSON.parse(formValue)
    } catch {
      parsedValue = formValue
    }

    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/settings', {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: formId || undefined,
          key: formKey.trim(),
          value: parsedValue,
        }),
      })

      const result = await response.json().catch(() => null)
      if (!response.ok) {
        setError(result?.error || 'บันทึกการตั้งค่าไม่สำเร็จ')
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
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#153c85]">ตั้งค่าระบบ</h1>
          <p className="mt-1 text-sm text-gray-500">System Settings สำหรับ Super Admin เท่านั้น</p>
        </div>
        <Button className="bg-[#2748bf] hover:bg-[#153c85]" onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" />
          เพิ่มการตั้งค่า
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Link href="/admin/settings/admin-menus" className="group rounded-lg border bg-white p-4 shadow-sm transition hover:border-[#2748bf]/40 hover:shadow-md">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#2748bf]/10 text-[#2748bf]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <p className="font-semibold text-[#153c85]">สิทธิ์เมนู Admin</p>
          <p className="mt-1 text-xs text-gray-500">กำหนดว่า Admin ธรรมดาเห็นเมนูใดได้บ้าง</p>
        </Link>
        <Link href="/admin/settings/levels" className="group rounded-lg border bg-white p-4 shadow-sm transition hover:border-[#2748bf]/40 hover:shadow-md">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#2748bf]/10 text-[#2748bf]">
            <BarChart3 className="h-5 w-5" />
          </div>
          <p className="font-semibold text-[#153c85]">ตั้งค่า Level</p>
          <p className="mt-1 text-xs text-gray-500">แก้ LV 1-70, เงื่อนไขทดสอบ และสถานะใช้งาน</p>
        </Link>
        <div className="rounded-lg border border-dashed bg-white p-4 text-gray-400">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
            <Tags className="h-5 w-5" />
          </div>
          <p className="font-semibold text-gray-600">ราคาค่าเรียน</p>
          <p className="mt-1 text-xs">ขั้นถัดไป: แก้ pricing tiers ผ่านระบบ</p>
        </div>
        <div className="rounded-lg border border-dashed bg-white p-4 text-gray-400">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
            <Wallet className="h-5 w-5" />
          </div>
          <p className="font-semibold text-gray-600">เรทโค้ช/OT</p>
          <p className="mt-1 text-xs">ขั้นถัดไป: ตั้งค่า 25 ชม. และเรท OT</p>
        </div>
      </div>

      {settings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            <Settings className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="font-medium">ยังไม่มีการตั้งค่า</p>
            <p className="mt-1 text-xs">กดปุ่ม "เพิ่มการตั้งค่า" เพื่อเริ่มต้น</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {settings.map((setting) => (
            <Card key={setting.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Key className="h-4 w-4 text-[#2748bf]" />
                      <p className="font-mono text-sm font-semibold text-[#153c85]">{setting.key}</p>
                    </div>
                    <pre className="mt-2 max-h-32 overflow-auto rounded bg-gray-50 p-2 text-xs text-gray-700">
                      {JSON.stringify(setting.value, null, 2)}
                    </pre>
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-400">
                      {setting.updated_by_name && <span>แก้ไขโดย: {setting.updated_by_name}</span>}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(setting.updated_at)}
                      </span>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-8 w-8 shrink-0 p-0" onClick={() => openEdit(setting)}>
                    <Pencil className="h-4 w-4 text-gray-400" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">{isNew ? 'เพิ่มการตั้งค่า' : 'แก้ไขการตั้งค่า'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}
            <div>
              <Label>Key</Label>
              <Input value={formKey} onChange={(event) => setFormKey(event.target.value)} placeholder="setting_key" disabled={!isNew} className="font-mono" />
            </div>
            <div>
              <Label>Value (JSON)</Label>
              <Textarea value={formValue} onChange={(event) => setFormValue(event.target.value)} rows={6} className="font-mono text-sm" placeholder='{"key": "value"}' />
            </div>
            <Button className="w-full bg-[#2748bf] hover:bg-[#153c85]" onClick={saveSetting} disabled={loading || !formKey.trim()}>
              <Save className="mr-1 h-4 w-4" />
              {loading ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

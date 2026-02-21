'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Settings, Plus, Pencil, Save, Key, Clock,
} from 'lucide-react'

interface SettingData {
  id: string
  key: string
  value: any
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

  const [formId, setFormId] = useState<string>('')
  const [formKey, setFormKey] = useState('')
  const [formValue, setFormValue] = useState('')

  const formatDate = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })

  const openEdit = (setting: SettingData) => {
    setFormId(setting.id)
    setFormKey(setting.key)
    setFormValue(JSON.stringify(setting.value, null, 2))
    setIsNew(false)
    setEditOpen(true)
  }

  const openNew = () => {
    setFormId('')
    setFormKey('')
    setFormValue('{}')
    setIsNew(true)
    setEditOpen(true)
  }

  const saveSetting = async () => {
    if (!formKey.trim()) return
    let parsedValue: any
    try {
      parsedValue = JSON.parse(formValue)
    } catch {
      parsedValue = formValue
    }

    setLoading(true)
    try {
      await fetch('/api/admin/settings', {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: formId || undefined,
          key: formKey.trim(),
          value: parsedValue,
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
          <h1 className="text-2xl font-bold text-[#153c85]">ตั้งค่าระบบ</h1>
          <p className="text-gray-500 text-sm mt-1">System Settings (Super Admin เท่านั้น)</p>
        </div>
        <Button className="bg-[#2748bf] hover:bg-[#153c85]" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" />เพิ่มการตั้งค่า
        </Button>
      </div>

      {/* Settings list */}
      {settings.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">
          <Settings className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">ยังไม่มีการตั้งค่า</p>
          <p className="text-xs mt-1">กดปุ่ม "เพิ่มการตั้งค่า" เพื่อเริ่มต้น</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {settings.map((setting) => (
            <Card key={setting.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Key className="h-4 w-4 text-[#2748bf]" />
                      <p className="font-semibold text-sm font-mono text-[#153c85]">{setting.key}</p>
                    </div>
                    <pre className="text-xs bg-gray-50 p-2 rounded mt-2 overflow-auto max-h-32 text-gray-700">
                      {JSON.stringify(setting.value, null, 2)}
                    </pre>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400">
                      {setting.updated_by_name && <span>แก้ไขโดย: {setting.updated_by_name}</span>}
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(setting.updated_at)}</span>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={() => openEdit(setting)}>
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
            <DialogTitle className="text-[#153c85]">{isNew ? 'เพิ่มการตั้งค่า' : 'แก้ไขการตั้งค่า'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Key</Label>
              <Input value={formKey} onChange={(e) => setFormKey(e.target.value)} placeholder="setting_key" disabled={!isNew} className="font-mono" />
            </div>
            <div>
              <Label>Value (JSON)</Label>
              <Textarea value={formValue} onChange={(e) => setFormValue(e.target.value)} rows={6} className="font-mono text-sm" placeholder='{"key": "value"}' />
            </div>
            <Button className="w-full bg-[#2748bf] hover:bg-[#153c85]" onClick={saveSetting} disabled={loading || !formKey.trim()}>
              <Save className="h-4 w-4 mr-1" />{loading ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

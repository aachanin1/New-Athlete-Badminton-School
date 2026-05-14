'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { ADMIN_MENU_PERMISSION_SETTING_KEY, type AdminMenuItem, type AdminMenuKey } from '@/lib/admin-navigation'

interface AdminMenuPermissionsClientProps {
  menuItems: AdminMenuItem[]
  initialAllowedMenuKeys: AdminMenuKey[]
  hasSetting: boolean
}

export function AdminMenuPermissionsClient({
  menuItems,
  initialAllowedMenuKeys,
  hasSetting,
}: AdminMenuPermissionsClientProps) {
  const router = useRouter()
  const [allowedKeys, setAllowedKeys] = useState<AdminMenuKey[]>(initialAllowedMenuKeys)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const editableItems = useMemo(() => menuItems.filter((item) => !item.superAdminOnly), [menuItems])
  const enabledCount = editableItems.filter((item) => allowedKeys.includes(item.key)).length

  const toggleMenu = (key: AdminMenuKey, checked: boolean) => {
    if (key === 'dashboard') return

    setAllowedKeys((current) => {
      if (checked) {
        return Array.from(new Set([...current, key]))
      }

      return current.filter((item) => item !== key)
    })
  }

  const savePermissions = async () => {
    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      const normalizedKeys = Array.from(new Set<AdminMenuKey>(['dashboard', ...allowedKeys]))
      const response = await fetch('/api/admin/settings', {
        method: hasSetting ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: ADMIN_MENU_PERMISSION_SETTING_KEY,
          value: {
            adminAllowedMenuKeys: normalizedKeys,
            updatedAt: new Date().toISOString(),
          },
        }),
      })

      const result = await response.json().catch(() => null)
      if (!response.ok) {
        setError(result?.error || 'บันทึกสิทธิ์เมนูไม่สำเร็จ')
        return
      }

      setAllowedKeys(normalizedKeys)
      setMessage('บันทึกสิทธิ์เมนู Admin แล้ว')
      router.refresh()
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-[#2748bf]">
            <ShieldCheck className="h-4 w-4" />
            Super Admin Settings
          </p>
          <h1 className="text-2xl font-bold text-[#153c85]">สิทธิ์เมนู Admin</h1>
          <p className="mt-1 text-sm text-gray-500">
            เลือกเมนูที่ Admin ธรรมดาสามารถเห็นและเข้าใช้งานได้ ส่วนเมนูตั้งค่าหลักยังเป็นของ Super Admin เท่านั้น
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="rounded-lg border bg-white px-3 py-2 text-sm text-gray-500">
            เปิดใช้งาน <span className="font-bold text-[#153c85]">{enabledCount}</span>/<span>{editableItems.length}</span> เมนู
          </div>
          <Button className="bg-[#2748bf] hover:bg-[#153c85]" onClick={savePermissions} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'กำลังบันทึก...' : 'บันทึกสิทธิ์'}
          </Button>
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {editableItems.map((item) => {
          const checked = allowedKeys.includes(item.key)
          const locked = item.lockedForAdmin

          return (
            <Card key={item.key} className={checked ? 'border-[#2748bf]/30 bg-[#2748bf]/[0.02]' : 'border-gray-200'}>
              <CardContent className="flex items-center gap-3 p-3">
                <Checkbox
                  id={`menu-${item.key}`}
                  checked={checked}
                  disabled={locked}
                  onCheckedChange={(value) => toggleMenu(item.key, value === true)}
                />
                <label
                  htmlFor={`menu-${item.key}`}
                  className="grid min-w-0 flex-1 cursor-pointer gap-0.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#153c85]">{item.label}</p>
                    <p className="truncate text-sm text-gray-500">{item.description}</p>
                  </div>
                  <span className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-medium ${locked ? 'bg-gray-100 text-gray-500' : checked ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-400'}`}>
                    {locked ? 'บังคับเปิด' : checked ? 'เปิด' : 'ปิด'}
                  </span>
                </label>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

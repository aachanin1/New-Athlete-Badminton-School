'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { BarChart3, ShieldCheck, Tags, Wallet } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

export type SettingsSection = 'admin-menus' | 'levels' | 'pricing' | 'coach-ot'

interface SettingsClientProps {
  activeSection: SettingsSection
  children: ReactNode
}

const SECTIONS: Array<{
  key: SettingsSection
  title: string
  description: string
  href: string
  icon: typeof ShieldCheck
}> = [
  {
    key: 'admin-menus',
    title: 'สิทธิ์เมนู Admin',
    description: 'กำหนดว่า Admin ธรรมดาเห็นเมนูใดได้บ้าง',
    href: '/admin/settings?section=admin-menus',
    icon: ShieldCheck,
  },
  {
    key: 'levels',
    title: 'ตั้งค่า Level',
    description: 'แก้ LV 0-70, เงื่อนไขประเมิน และสถานะใช้งาน',
    href: '/admin/settings?section=levels',
    icon: BarChart3,
  },
  {
    key: 'pricing',
    title: 'ราคาค่าเรียน',
    description: 'แก้ pricing tiers ที่ใช้คำนวณราคาจองจริง',
    href: '/admin/settings?section=pricing',
    icon: Tags,
  },
  {
    key: 'coach-ot',
    title: 'เรทโค้ช/OT',
    description: 'ตั้งค่าเกณฑ์ชั่วโมงต่อสัปดาห์และเรท OT',
    href: '/admin/settings?section=coach-ot',
    icon: Wallet,
  },
]

export function SettingsClient({ activeSection, children }: SettingsClientProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">ตั้งค่าระบบ</h1>
        <p className="mt-1 text-sm text-gray-500">พื้นที่ตั้งค่าสำหรับ Super Admin โดยไม่ต้องแก้ Key / Value JSON เอง</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {SECTIONS.map((section) => {
          const Icon = section.icon
          const active = section.key === activeSection

          return (
            <Link key={section.key} href={section.href} className="block">
              <Card className={`h-full transition hover:border-[#2748bf]/40 hover:shadow-md ${active ? 'border-[#2748bf] bg-[#2748bf]/[0.03] shadow-sm' : 'border-gray-200 bg-white'}`}>
                <CardContent className="p-4">
                  <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${active ? 'bg-[#2748bf] text-white' : 'bg-[#2748bf]/10 text-[#2748bf]'}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="font-semibold text-[#153c85]">{section.title}</p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">{section.description}</p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <div>{children}</div>
    </div>
  )
}

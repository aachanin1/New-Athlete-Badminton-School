'use client'

import { useState } from 'react'
import { BookOpenText, Eye } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { ProgramStatus } from '@/types/database'

export interface CoachTodayProgram {
  id: string
  programContent: string
  status: ProgramStatus
  updatedAt: string
}

const STATUS_CONFIG: Record<ProgramStatus, { label: string; className: string }> = {
  draft: { label: 'ฉบับร่าง', className: 'border-gray-200 bg-gray-50 text-gray-600' },
  submitted: { label: 'รอตรวจ', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  approved: { label: 'อนุมัติแล้ว', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  rejected: { label: 'ส่งกลับแก้', className: 'border-rose-200 bg-rose-50 text-rose-700' },
}

export function CoachTodayProgramDialog({
  program,
  groupName,
}: {
  program: CoachTodayProgram
  groupName: string
}) {
  const [open, setOpen] = useState(false)
  const status = STATUS_CONFIG[program.status]

  return (
    <>
      <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3" data-testid="coach-today-program">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-bold text-[#153c85]">
            <BookOpenText className="h-4 w-4" />
            โปรแกรมสอนรอบนี้
          </p>
          <Badge variant="outline" className={cn('text-[10px]', status.className)}>{status.label}</Badge>
        </div>
        <p className="mt-2 line-clamp-2 whitespace-pre-line text-sm leading-6 text-gray-700">
          {program.programContent}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 w-full gap-2 bg-white sm:w-auto"
          onClick={() => setOpen(true)}
          aria-label={`อ่านโปรแกรมสอนฉบับเต็มของ ${groupName}`}
        >
          <Eye className="h-4 w-4" />
          อ่านโปรแกรมฉบับเต็ม
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-hidden p-0">
          <DialogHeader className="border-b px-5 py-4 text-left">
            <div className="flex flex-wrap items-center gap-2 pr-8">
              <DialogTitle className="text-[#153c85]">โปรแกรมสอนรอบนี้</DialogTitle>
              <Badge variant="outline" className={cn('text-[10px]', status.className)}>{status.label}</Badge>
            </div>
            <DialogDescription>{groupName}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[68vh] overflow-y-auto px-5 py-4">
            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-800">
              {program.programContent}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { formatThaiDateWithWeekday } from '@/lib/date-format'

export function AssessmentNotePreview({ notes, studentName, level, evaluatedAt, evaluatedBy }: {
  notes: string
  studentName: string
  level: number
  evaluatedAt: string | null
  evaluatedBy: string | null
}) {
  const container = useRef<HTMLDivElement>(null)
  const text = useRef<HTMLParagraphElement>(null)
  const [truncated, setTruncated] = useState(false)

  useEffect(() => {
    const element = container.current
    const paragraph = text.current
    if (!element || !paragraph) return
    let active = true
    // Decide against the full row width before reserving space for the button.
    const measure = () => { if (active) setTruncated(paragraph.scrollWidth > element.clientWidth + 1) }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    measure()
    void document.fonts.ready.then(measure)
    return () => { active = false; observer.disconnect() }
  }, [notes])

  return (
    <Dialog>
      <div ref={container} className="mt-1 flex min-w-0 items-center gap-2">
        <p ref={text} className="min-w-0 flex-1 truncate text-xs text-gray-400">{notes}</p>
        {truncated && (
          <DialogTrigger asChild>
            <button type="button" className="shrink-0 text-xs text-[#2748bf] hover:underline [@media(pointer:coarse)]:min-h-11" aria-label={`อ่านหมายเหตุเพิ่มเติมของ${studentName}`}>อ่านเพิ่มเติม</button>
          </DialogTrigger>
        )}
      </div>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#153c85]">หมายเหตุการประเมินล่าสุด</DialogTitle>
          <DialogDescription>{studentName} · LV {level}</DialogDescription>
        </DialogHeader>
        <p className="text-xs text-gray-500">{evaluatedAt ? formatThaiDateWithWeekday(evaluatedAt) : 'ไม่พบวันที่ประเมิน'} · {evaluatedBy || 'ไม่พบชื่อผู้ประเมิน'}</p>
        <p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{notes}</p>
        <div className="flex justify-end"><DialogClose asChild><Button type="button">ปิด</Button></DialogClose></div>
      </DialogContent>
    </Dialog>
  )
}

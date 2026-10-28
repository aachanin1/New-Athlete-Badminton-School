'use client'
import Link from 'next/link'
import {usePathname,useRouter} from 'next/navigation'
import {useEffect,useRef,useState} from 'react'
import {CalendarDays,Clock} from 'lucide-react'
import {paymentTimeLeft} from '@/lib/booking-checkout'
export function BookingEntryBar({pending}:{pending?:{count:number;amount:number;deadline:string|null;received?:number;serverNow?:string}}) {
  const pathname=usePathname(),router=useRouter(),refreshed=useRef('')
  const [now,setNow]=useState<number|null>(null)
  useEffect(()=>{if(!pending?.deadline)return;const offset=pending.serverNow?Date.parse(pending.serverNow)-Date.now():0;setNow(Date.now()+offset);const timer=setInterval(()=>setNow(Date.now()+offset),1000);return()=>clearInterval(timer)},[pending?.deadline,pending?.serverNow])
  const due=Boolean(now&&pending?.deadline&&now>=Date.parse(pending.deadline))
  useEffect(()=>{if(due&&pending?.deadline&&refreshed.current!==pending.deadline){refreshed.current=pending.deadline;router.refresh()}},[due,pending?.deadline,router])
  return <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-testid="booking-entry-bar">
    <Link href="/dashboard/booking" className={'inline-flex min-h-14 items-center justify-center gap-3 rounded-xl bg-orange-500 px-6 py-3 text-lg font-bold text-white shadow-sm hover:bg-orange-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700 '+(pathname==='/dashboard'?'booking-entry-pulse':'')}><CalendarDays className="h-6 w-6"/>จองวันเรียน</Link>
    {Boolean(pending?.count)&&!due&&<Link href="/dashboard/payments" className="flex min-h-14 flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-semibold text-[#153c85]" data-testid="pending-payment-entry"><span>ชำระเงินต่อ · {pending!.count} ชุด · ฿{Number(pending!.amount).toLocaleString()}</span><span className="flex items-center gap-1 text-sm font-bold text-red-700"><Clock className="h-4 w-4"/>{now===null?'กำลังอ่านเวลาคงเหลือ':'เหลือ '+paymentTimeLeft(pending!.deadline,now)}{pending!.count>1?' · ชุดที่หมดเวลาก่อน':''}</span></Link>}
    {Boolean(pending?.received)&&<Link href="/dashboard/payments" className="rounded-xl bg-gray-100 p-3 text-sm font-medium text-blue-800">ติดตามผลการชำระ {pending!.received} ชุด · ดูสถานะล่าสุด</Link>}
  </div>
}

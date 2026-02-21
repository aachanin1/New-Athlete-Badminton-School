'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Search, Activity, User, Clock, FileText, Shield,
} from 'lucide-react'

interface LogData {
  id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string | null
  details: any
  ip_address: string | null
  created_at: string
  user_name: string
}

interface LogsClientProps {
  logs: LogData[]
}

const ENTITY_COLORS: Record<string, string> = {
  booking: 'bg-blue-100 text-blue-700',
  payment: 'bg-green-100 text-green-700',
  profile: 'bg-purple-100 text-purple-700',
  complaint: 'bg-red-100 text-red-700',
  coupon: 'bg-yellow-100 text-yellow-700',
  notification: 'bg-orange-100 text-orange-700',
  branch: 'bg-teal-100 text-teal-700',
  coach: 'bg-indigo-100 text-indigo-700',
  attendance: 'bg-cyan-100 text-cyan-700',
  session: 'bg-pink-100 text-pink-700',
}

export function LogsClient({ logs }: LogsClientProps) {
  const [search, setSearch] = useState('')
  const [filterEntity, setFilterEntity] = useState<string>('all')
  const [filterDate, setFilterDate] = useState<string>('')

  const entityTypes = useMemo(() => {
    return Array.from(new Set(logs.map((l) => l.entity_type))).sort()
  }, [logs])

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (filterEntity !== 'all' && l.entity_type !== filterEntity) return false
      if (filterDate) {
        const logDate = new Date(l.created_at).toISOString().split('T')[0]
        if (logDate !== filterDate) return false
      }
      if (!search) return true
      const q = search.toLowerCase()
      return l.action.toLowerCase().includes(q) || l.user_name.toLowerCase().includes(q) || l.entity_type.toLowerCase().includes(q)
    })
  }, [logs, search, filterEntity, filterDate])

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return {
      total: logs.length,
      today: logs.filter((l) => new Date(l.created_at).toISOString().split('T')[0] === today).length,
      uniqueUsers: new Set(logs.map((l) => l.user_id)).size,
    }
  }, [logs])

  const formatDateTime = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">Activity Log</h1>
        <p className="text-gray-500 text-sm mt-1">ดู Log ทั้งระบบ ว่าใครทำอะไรอย่างไร (Super Admin เท่านั้น)</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-[#2748bf]">{stats.total}</p><p className="text-xs text-gray-500">Log ทั้งหมด</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.today}</p><p className="text-xs text-gray-500">วันนี้</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.uniqueUsers}</p><p className="text-xs text-gray-500">ผู้ใช้ที่ active</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="ค้นหา action, ชื่อผู้ใช้..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterEntity} onValueChange={setFilterEntity}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Entity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกประเภท</SelectItem>
            {entityTypes.map((et) => (
              <SelectItem key={et} value={et}>{et}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-44" />
      </div>

      {/* Log list */}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">
          <Activity className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">ไม่พบ Log</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((log) => {
            const entityColor = ENTITY_COLORS[log.entity_type] || 'bg-gray-100 text-gray-700'
            return (
              <Card key={log.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-start gap-3 p-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                      <FileText className="h-4 w-4 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-[10px] ${entityColor}`}>{log.entity_type}</Badge>
                        <p className="font-medium text-sm">{log.action}</p>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400 flex-wrap">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{log.user_name}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDateTime(log.created_at)}</span>
                        {log.ip_address && <span className="flex items-center gap-1"><Shield className="h-3 w-3" />{log.ip_address}</span>}
                        {log.entity_id && <span className="text-gray-300 font-mono text-[10px]">{log.entity_id.substring(0, 8)}...</span>}
                      </div>
                      {log.details && (
                        <details className="mt-1">
                          <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600">ดูรายละเอียด</summary>
                          <pre className="text-[10px] bg-gray-50 p-2 rounded mt-1 overflow-auto max-h-24 text-gray-600">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">แสดง {filtered.length} จาก {logs.length} รายการ</p>
    </div>
  )
}

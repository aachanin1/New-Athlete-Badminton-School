'use client'

import { useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Activity, Clock, Eye, FileText, Search, Shield, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ListPagination } from '@/components/admin/list-pagination'

interface LogData {
  id: string
  user_id: string
  action: string
  entity_type: string
  entity_id: string | null
  details: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
  user_name: string
}

interface LogsClientProps {
  logs: LogData[]
}

const ENTITY_COLORS: Record<string, string> = {
  booking: 'border-blue-200 bg-blue-50 text-blue-700',
  payment: 'border-green-200 bg-green-50 text-green-700',
  profile: 'border-purple-200 bg-purple-50 text-purple-700',
  complaint: 'border-red-200 bg-red-50 text-red-700',
  coupon: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  notification: 'border-orange-200 bg-orange-50 text-orange-700',
  branch: 'border-teal-200 bg-teal-50 text-teal-700',
  coach: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  attendance: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  session: 'border-pink-200 bg-pink-50 text-pink-700',
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function LogsClient({ logs }: LogsClientProps) {
  const [search, setSearch] = useState('')
  const [filterEntity, setFilterEntity] = useState('all')
  const [filterDate, setFilterDate] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [selectedLog, setSelectedLog] = useState<LogData | null>(null)

  const entityTypes = useMemo(() => Array.from(new Set(logs.map((log) => log.entity_type))).sort(), [logs])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return logs.filter((log) => {
      if (filterEntity !== 'all' && log.entity_type !== filterEntity) return false
      if (filterDate) {
        const logDate = new Date(log.created_at).toISOString().split('T')[0]
        if (logDate !== filterDate) return false
      }
      if (!query) return true
      return [
        log.action,
        log.user_name,
        log.entity_type,
        log.entity_id || '',
        log.ip_address || '',
      ].some((value) => value.toLowerCase().includes(query))
    })
  }, [filterDate, filterEntity, logs, search])

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return {
      total: logs.length,
      today: logs.filter((log) => new Date(log.created_at).toISOString().split('T')[0] === today).length,
      uniqueUsers: new Set(logs.map((log) => log.user_id).filter(Boolean)).size,
      entityCount: entityTypes.length,
    }
  }, [entityTypes.length, logs])

  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)))
  const pagedLogs = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  const resetPage = (callback: () => void) => {
    callback()
    setPage(1)
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-[#2748bf]">
          <Activity className="h-4 w-4" />
          Activity Audit
        </div>
        <h1 className="mt-1 text-2xl font-bold text-[#153c85]">Activity Log</h1>
        <p className="mt-1 text-sm text-gray-500">
          ดูประวัติการทำงานของระบบแบบ compact และเปิด JSON รายละเอียดเฉพาะรายการที่ต้องตรวจ
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <Stat label="Log ทั้งหมด" value={stats.total} tone="blue" />
        <Stat label="วันนี้" value={stats.today} tone="green" />
        <Stat label="ผู้ใช้ที่ active" value={stats.uniqueUsers} tone="purple" />
        <Stat label="ประเภทข้อมูล" value={stats.entityCount} tone="slate" />
      </div>

      <Card className="border-gray-200">
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(260px,1fr)_190px_170px_auto] lg:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="ค้นหา action, ผู้ใช้, entity id, IP..."
              value={search}
              onChange={(event) => resetPage(() => setSearch(event.target.value))}
              className="pl-10"
            />
          </div>
          <Select value={filterEntity} onValueChange={(value) => resetPage(() => setFilterEntity(value))}>
            <SelectTrigger>
              <SelectValue placeholder="ประเภท" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกประเภท</SelectItem>
              {entityTypes.map((entityType) => (
                <SelectItem key={entityType} value={entityType}>{entityType}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={filterDate} onChange={(event) => resetPage(() => setFilterDate(event.target.value))} />
          <p className="whitespace-nowrap text-sm text-gray-500">แสดง {filtered.length} จาก {logs.length} รายการ</p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-gray-200">
        {filtered.length === 0 ? (
          <CardContent className="py-14 text-center text-gray-400">
            <Activity className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p className="font-medium">ไม่พบ Log ตามตัวกรอง</p>
          </CardContent>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500">
                  <tr>
                    <th className="px-4 py-3">เวลา</th>
                    <th className="px-4 py-3">ผู้ใช้</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Entity</th>
                    <th className="px-4 py-3">IP / ID</th>
                    <th className="px-4 py-3 text-right">รายละเอียด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pagedLogs.map((log) => {
                    const entityColor = ENTITY_COLORS[log.entity_type] || 'border-gray-200 bg-gray-50 text-gray-700'
                    return (
                      <tr key={log.id} className="hover:bg-gray-50/70">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-gray-700">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <span className="whitespace-nowrap">{formatDateTime(log.created_at)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-xs font-bold text-[#2748bf]">
                              {log.user_name.charAt(0)}
                            </div>
                            <span className="font-semibold text-gray-900">{log.user_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="line-clamp-1 font-medium text-gray-900">{log.action}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={entityColor}>{log.entity_type}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1 text-xs text-gray-500">
                            {log.ip_address && (
                              <p className="flex items-center gap-1">
                                <Shield className="h-3 w-3" />
                                {log.ip_address}
                              </p>
                            )}
                            {log.entity_id && <p className="font-mono text-gray-400">{log.entity_id.substring(0, 12)}...</p>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="outline" onClick={() => setSelectedLog(log)}>
                            <Eye className="mr-2 h-4 w-4" />
                            เปิด
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <ListPagination
              page={safePage}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </Card>

      <Dialog open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">รายละเอียด Activity Log</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-lg bg-gray-50 p-3 text-sm sm:grid-cols-2">
                <DetailLine icon={User} label="ผู้ใช้" value={selectedLog.user_name} />
                <DetailLine icon={Clock} label="เวลา" value={formatDateTime(selectedLog.created_at)} />
                <DetailLine icon={FileText} label="Action" value={selectedLog.action} />
                <DetailLine icon={Shield} label="IP" value={selectedLog.ip_address || '-'} />
              </div>
              <div className="rounded-lg border bg-white p-3">
                <p className="mb-2 text-xs font-semibold text-gray-500">Entity</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={ENTITY_COLORS[selectedLog.entity_type] || 'border-gray-200 bg-gray-50 text-gray-700'}>
                    {selectedLog.entity_type}
                  </Badge>
                  {selectedLog.entity_id && <Badge variant="outline" className="font-mono">{selectedLog.entity_id}</Badge>}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold text-gray-500">Details JSON</p>
                <pre className="max-h-[50vh] overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
                  {JSON.stringify(selectedLog.details || {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'blue' | 'green' | 'purple' | 'slate' }) {
  const toneClass = {
    blue: 'text-[#2748bf]',
    green: 'text-emerald-600',
    purple: 'text-purple-600',
    slate: 'text-slate-600',
  }[tone]

  return (
    <Card className="border-gray-200">
      <CardContent className="p-3 sm:p-4">
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`mt-1 text-xl font-bold sm:text-2xl ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

function DetailLine({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-gray-400" />
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="truncate font-semibold text-gray-900">{value}</p>
      </div>
    </div>
  )
}

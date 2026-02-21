'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Search, Camera, MapPin, Clock, User, Building2, CheckCircle2, Image as ImageIcon,
} from 'lucide-react'

interface CheckinData {
  id: string
  coach_id: string
  branch_id: string
  checkin_time: string
  photo_url: string | null
  location_lat: number | null
  location_lng: number | null
  created_at: string
  coach_name: string
  branch_name: string
}

interface CoachCheckinsClientProps {
  checkins: CheckinData[]
  branches: { id: string; name: string }[]
}

export function CoachCheckinsClient({ checkins, branches }: CoachCheckinsClientProps) {
  const [search, setSearch] = useState('')
  const [filterBranch, setFilterBranch] = useState<string>('all')
  const [filterDate, setFilterDate] = useState<string>('')
  const [photoOpen, setPhotoOpen] = useState(false)
  const [selectedCheckin, setSelectedCheckin] = useState<CheckinData | null>(null)

  const filtered = useMemo(() => {
    return checkins.filter((c) => {
      if (filterBranch !== 'all' && c.branch_id !== filterBranch) return false
      if (filterDate) {
        const checkinDate = new Date(c.checkin_time).toISOString().split('T')[0]
        if (checkinDate !== filterDate) return false
      }
      if (!search) return true
      const q = search.toLowerCase()
      return c.coach_name.toLowerCase().includes(q) || c.branch_name.toLowerCase().includes(q)
    })
  }, [checkins, search, filterBranch, filterDate])

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    const todayCheckins = checkins.filter((c) => new Date(c.checkin_time).toISOString().split('T')[0] === today)
    const withPhoto = checkins.filter((c) => c.photo_url)
    const uniqueCoaches = new Set(todayCheckins.map((c) => c.coach_id))
    return {
      total: checkins.length,
      today: todayCheckins.length,
      coachesToday: uniqueCoaches.size,
      withPhoto: withPhoto.length,
    }
  }, [checkins])

  const formatDate = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
  const formatTime = (d: string) => new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  const formatDateTime = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#153c85]">เช็คอินโค้ช</h1>
        <p className="text-gray-500 text-sm mt-1">ตรวจสอบการเช็คอินและรูปถ่ายของโค้ช</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-[#2748bf]">{stats.total}</p><p className="text-xs text-gray-500">เช็คอินทั้งหมด</p>
        </CardContent></Card>
        <Card className={stats.today > 0 ? 'ring-2 ring-green-400' : ''}><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.today}</p><p className="text-xs text-gray-500">เช็คอินวันนี้</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.coachesToday}</p><p className="text-xs text-gray-500">โค้ชเข้างานวันนี้</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-orange-500">{stats.withPhoto}</p><p className="text-xs text-gray-500">มีรูปถ่าย</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="ค้นหาชื่อโค้ช, สาขา..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={filterBranch} onValueChange={setFilterBranch}>
          <SelectTrigger className="w-48"><SelectValue placeholder="สาขา" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกสาขา</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-44" />
      </div>

      {/* Checkin list */}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-gray-400">
          <Camera className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">{search || filterBranch !== 'all' || filterDate ? 'ไม่พบข้อมูล' : 'ยังไม่มีการเช็คอิน'}</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((checkin) => (
            <Card key={checkin.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center gap-3 p-4">
                  {/* Photo thumbnail */}
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 cursor-pointer ${checkin.photo_url ? 'bg-green-50 border border-green-200' : 'bg-gray-100'}`}
                    onClick={() => { if (checkin.photo_url) { setSelectedCheckin(checkin); setPhotoOpen(true) } }}
                  >
                    {checkin.photo_url ? (
                      <img src={checkin.photo_url} alt="checkin" className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <Camera className="h-5 w-5 text-gray-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{checkin.coach_name}</p>
                      {checkin.photo_url && <Badge className="text-[10px] bg-green-100 text-green-700">มีรูป</Badge>}
                      {checkin.location_lat && <Badge className="text-[10px] bg-blue-100 text-blue-700">GPS</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400 flex-wrap">
                      <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{checkin.branch_name}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(checkin.checkin_time)} {formatTime(checkin.checkin_time)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {checkin.photo_url && (
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setSelectedCheckin(checkin); setPhotoOpen(true) }}>
                        <ImageIcon className="h-4 w-4 text-gray-400" />
                      </Button>
                    )}
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">แสดง {filtered.length} จาก {checkins.length} รายการ</p>

      {/* Photo Dialog */}
      <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#153c85]">รูปเช็คอิน</DialogTitle>
          </DialogHeader>
          {selectedCheckin && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <User className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="font-medium text-sm">{selectedCheckin.coach_name}</p>
                  <p className="text-xs text-gray-500">{selectedCheckin.branch_name} • {formatDateTime(selectedCheckin.checkin_time)}</p>
                </div>
              </div>

              {selectedCheckin.photo_url && (
                <img src={selectedCheckin.photo_url} alt="checkin photo" className="w-full rounded-lg" />
              )}

              {selectedCheckin.location_lat && selectedCheckin.location_lng && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg text-sm">
                  <MapPin className="h-4 w-4 text-blue-500 shrink-0" />
                  <div>
                    <p className="text-blue-700 font-medium">ตำแหน่ง GPS</p>
                    <p className="text-blue-600 text-xs">{selectedCheckin.location_lat.toFixed(6)}, {selectedCheckin.location_lng.toFixed(6)}</p>
                    <a
                      href={`https://www.google.com/maps?q=${selectedCheckin.location_lat},${selectedCheckin.location_lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 underline text-xs"
                    >
                      เปิดใน Google Maps
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

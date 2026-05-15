'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { Award, Building2, Medal, Search, Trophy } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  StudentAchievementManager,
  StudentAchievementPills,
  type ManagedStudentAchievement,
} from '@/components/shared/student-achievement-manager'
import { LEVEL_RANGES, formatLevelRange, getLevelDisplay } from '@/constants/levels'
import { cn } from '@/lib/utils'

export interface RankingBranch {
  id: string
  name: string
}

export type RankingAchievement = ManagedStudentAchievement

export interface RankingStudent {
  id: string
  type: 'kid' | 'adult'
  name: string
  branchIds: string[]
  branchNames: string[]
  avatarUrl: string | null
  level: number
  levelName: string | null
  levelUpdatedAt: string | null
  evaluatedBy: string | null
  notes: string | null
  achievements: RankingAchievement[]
}

interface RankingBoardProps {
  kids: RankingStudent[]
  adults: RankingStudent[]
  branches: RankingBranch[]
  canManageAchievements?: boolean
}

type LearnerTab = 'kids' | 'adults'
type LevelFilter = 'all' | 'unassessed' | 'basic' | 'athlete_1' | 'athlete_2' | 'athlete_3'

function getInitials(name: string) {
  return name.trim().slice(0, 2).toUpperCase()
}

function formatDate(date: string | null) {
  if (!date) return 'ยังไม่ได้ประเมิน'
  return new Date(date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
}

function getRankClass(rank: number) {
  if (rank === 1) return 'bg-amber-100 text-amber-700'
  if (rank === 2) return 'bg-slate-100 text-slate-700'
  if (rank === 3) return 'bg-orange-100 text-orange-700'
  return 'bg-blue-50 text-[#2748bf]'
}

function filterByLevel(student: RankingStudent, levelFilter: LevelFilter) {
  if (levelFilter === 'all') return true
  if (levelFilter === 'unassessed') return student.level <= 0
  const range = LEVEL_RANGES.find((item) => item.category === levelFilter)
  return range ? student.level >= range.minLevel && student.level <= range.maxLevel : true
}

function getTopLabel(student: RankingStudent | undefined) {
  if (!student) return 'ยังไม่มีข้อมูล'
  const achievements = student.achievements.map((item) => item.emoji).join('')
  return `${student.name}${achievements ? ` ${achievements}` : ''}`
}

function buildRankMap(students: RankingStudent[]) {
  return new Map(students.map((student, index) => [student.id, index + 1]))
}

function RankingList({
  students,
  overallRankMap,
  branchRankMap,
  selectedBranchId,
  canManageAchievements,
  onManageAchievements,
}: {
  students: RankingStudent[]
  overallRankMap: Map<string, number>
  branchRankMap: Map<string, number>
  selectedBranchId: string
  canManageAchievements: boolean
  onManageAchievements: (student: RankingStudent) => void
}) {
  if (students.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-gray-400">
        <Trophy className="mx-auto mb-4 h-14 w-14 opacity-30" />
        <p className="text-lg font-semibold">ยังไม่มีข้อมูลอันดับ</p>
        <p className="mt-1 text-sm">ลองเปลี่ยนสาขาหรือช่วง Level ที่ต้องการดู</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {students.map((student) => {
        const overallRank = overallRankMap.get(student.id) || 0
        const branchRank = branchRankMap.get(student.id) || overallRank
        const primaryRank = selectedBranchId === 'all' ? overallRank : branchRank
        const levelInfo = getLevelDisplay(student.level)
        const levelLabel = student.levelName || levelInfo.label

        return (
          <div key={student.id} className="grid gap-3 rounded-lg border bg-white p-3 shadow-sm sm:grid-cols-[auto_minmax(0,1fr)_112px] sm:items-center">
            <div className="flex items-center gap-3">
              <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold', getRankClass(primaryRank))}>
                #{primaryRank}
              </div>
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#153c85]/10 text-sm font-bold text-[#153c85]">
                {student.avatarUrl ? (
                  <Image src={student.avatarUrl} alt={student.name} fill sizes="44px" className="object-cover" />
                ) : (
                  getInitials(student.name)
                )}
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 truncate font-semibold text-[#153c85]">{student.name}</p>
                <StudentAchievementPills achievements={student.achievements} />
                <Badge className={levelInfo.color}>{levelLabel}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {student.branchNames.length > 0 ? student.branchNames.join(', ') : 'ยังไม่ผูกสาขา'}
                </span>
                {selectedBranchId !== 'all' && <span>อันดับ NA #{overallRank}</span>}
                <span>ประเมินล่าสุด: {formatDate(student.levelUpdatedAt)}</span>
                {student.evaluatedBy && <span>โดย {student.evaluatedBy}</span>}
              </div>
              {student.notes && <p className="mt-1 line-clamp-1 text-xs text-gray-400">{student.notes}</p>}
            </div>

            <div className="rounded-lg bg-gray-50 px-3 py-2 text-center sm:py-3">
              <p className="text-xs text-gray-500">Level</p>
              <p className="text-2xl font-bold text-[#2748bf]">{levelInfo.level}</p>
              {canManageAchievements && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7 w-full text-[11px]"
                  onClick={() => onManageAchievements(student)}
                >
                  <Award className="h-3 w-3" />
                  รางวัล
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function RankingBoard({ kids, adults, branches, canManageAchievements = false }: RankingBoardProps) {
  const [activeTab, setActiveTab] = useState<LearnerTab>('kids')
  const [selectedBranchId, setSelectedBranchId] = useState('all')
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all')
  const [managingStudent, setManagingStudent] = useState<RankingStudent | null>(null)

  const activeStudents = activeTab === 'kids' ? kids : adults
  const overallRankMap = useMemo(() => buildRankMap(activeStudents), [activeStudents])

  const branchStudents = useMemo(() => {
    const inBranch = selectedBranchId === 'all'
      ? activeStudents
      : activeStudents.filter((student) => student.branchIds.includes(selectedBranchId))

    return inBranch.filter((student) => filterByLevel(student, levelFilter))
  }, [activeStudents, levelFilter, selectedBranchId])

  const branchRankMap = useMemo(() => {
    const source = selectedBranchId === 'all'
      ? activeStudents
      : activeStudents.filter((student) => student.branchIds.includes(selectedBranchId))
    return buildRankMap(source)
  }, [activeStudents, selectedBranchId])

  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId)
  const overallTop = activeStudents[0]
  const branchTop = selectedBranchId === 'all'
    ? overallTop
    : activeStudents.filter((student) => student.branchIds.includes(selectedBranchId))[0]

  return (
    <div className="mx-auto max-w-5xl">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as LearnerTab)}>
        <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px] lg:items-center">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="kids">เด็ก ({kids.length})</TabsTrigger>
            <TabsTrigger value="adults">ผู้ใหญ่ ({adults.length})</TabsTrigger>
          </TabsList>

          <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="เลือกสาขา" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสาขา</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={levelFilter} onValueChange={(value) => setLevelFilter(value as LevelFilter)}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="ช่วง Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุก Level</SelectItem>
              <SelectItem value="unassessed">Level 0</SelectItem>
              {LEVEL_RANGES.map((range) => (
                <SelectItem key={range.category} value={range.category}>
                  {range.label} ({formatLevelRange(range)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-gray-500">Top NA</p>
              <p className="mt-1 truncate text-lg font-bold text-[#153c85]">{getTopLabel(overallTop)}</p>
              <p className="text-xs text-gray-400">{overallTop ? `Level ${overallTop.level}` : '-'}</p>
            </CardContent>
          </Card>
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-gray-500">{selectedBranch ? `Top ${selectedBranch.name}` : 'Top สาขา'}</p>
              <p className="mt-1 truncate text-lg font-bold text-[#153c85]">{getTopLabel(branchTop)}</p>
              <p className="text-xs text-gray-400">{branchTop ? `Level ${branchTop.level}` : '-'}</p>
            </CardContent>
          </Card>
          <Card className="border-gray-200">
            <CardContent className="p-4">
              <p className="flex items-center gap-1 text-xs font-medium text-gray-500">
                <Search className="h-3 w-3" />
                ผลลัพธ์ที่แสดง
              </p>
              <p className="mt-1 text-lg font-bold text-[#153c85]">{branchStudents.length} คน</p>
              <p className="text-xs text-gray-400">{selectedBranch?.name || 'ทุกสาขา'}</p>
            </CardContent>
          </Card>
        </div>

        <TabsContent value="kids" className="mt-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Medal className="h-5 w-5 text-[#f57e3b]" />
                อันดับนักเรียนเด็ก
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RankingList
                students={branchStudents}
                overallRankMap={overallRankMap}
                branchRankMap={branchRankMap}
                selectedBranchId={selectedBranchId}
                canManageAchievements={canManageAchievements}
                onManageAchievements={setManagingStudent}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="adults" className="mt-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Medal className="h-5 w-5 text-[#2748bf]" />
                อันดับนักเรียนผู้ใหญ่
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RankingList
                students={branchStudents}
                overallRankMap={overallRankMap}
                branchRankMap={branchRankMap}
                selectedBranchId={selectedBranchId}
                canManageAchievements={canManageAchievements}
                onManageAchievements={setManagingStudent}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {canManageAchievements && (
        <StudentAchievementManager
          student={managingStudent ? {
            id: managingStudent.id,
            name: managingStudent.name,
            studentType: managingStudent.type === 'kid' ? 'child' : 'adult',
            achievements: managingStudent.achievements,
          } : null}
          open={Boolean(managingStudent)}
          onOpenChange={(open) => {
            if (!open) setManagingStudent(null)
          }}
        />
      )}
    </div>
  )
}

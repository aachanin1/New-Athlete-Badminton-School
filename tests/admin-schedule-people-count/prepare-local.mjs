import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fixture } from './regression.mjs'

const root = process.cwd()
const run = path.resolve('.playwright/admin-schedule-people-count-1', `local-${Date.now()}`)
const app = path.join(run, 'app')
const ui = path.join(run, 'ui')
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const write = (file, content) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content, { flag: 'wx' }) }
fs.mkdirSync(app, { recursive: true })
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(file => file && !file.startsWith('.env') && (
  /^(src|public)\//.test(file) || ['package.json', 'package-lock.json', 'next.config.mjs', 'tsconfig.json', 'tailwind.config.ts', 'postcss.config.mjs', 'eslint.config.mjs'].includes(file)
))
const manifest = files.map(file => {
  const dest = path.join(app, file)
  fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(path.join(root, file), dest)
  return { path: file, sha256: hash(dest) }
})
fs.symlinkSync(path.join(root, 'node_modules'), path.join(app, 'node_modules'), 'junction')
// A separate component harness: no authentication, database, storage or external services.
for (const dir of ['components', 'lib', 'types', 'constants']) fs.cpSync(path.join(root, 'src', dir), path.join(ui, 'src', dir), { recursive: true })
for (const file of ['package.json', 'package-lock.json', 'tsconfig.json', 'tailwind.config.ts', 'postcss.config.mjs']) {
  fs.copyFileSync(path.join(root, file), path.join(ui, file))
}
fs.symlinkSync(path.join(root, 'node_modules'), path.join(ui, 'node_modules'), 'junction')
write(path.join(ui, 'next.config.mjs'), 'export default { devIndicators: false }\n')
const walletOnly = fixture.sessions[1]
const extra = { ...fixture.sessions[0], id: 'private-learner', child_id: null, date: '2026-11-18', schedule_slot_id: 'slot-private', branch_id: 'branch-b', branches: { name: 'สาขาที่สอง' }, bookings: { ...fixture.sessions[0].bookings, user_id: 'self-learner', learner_type: 'adult', course_type_id: 'private', course_types: { name: 'private' } } }
const data = { ...fixture, sessions: [...fixture.sessions, { ...walletOnly, id: 'wallet-only', date: '2026-11-17', schedule_slot_id: 'slot-wallet' }, extra], groups: [...fixture.groups, { ...fixture.groups[0], id: 'private-group', schedule_slot_id: 'slot-private', coach_id: 'coach-b', profiles: { id: 'coach-b', full_name: 'โค้ชคนที่สอง', role: 'coach' }, coach_assignment_group_students: [{ booking_session_id: 'private-learner' }] }], walletCredits: [...fixture.walletCredits, { original_session_id: 'wallet-only', status: 'active' }] }
data.sessions.push({ ...extra, id: 'adult-learner', date: '2026-11-19', schedule_slot_id: 'slot-adult', bookings: { ...extra.bookings, user_id: 'adult-learner', course_type_id: 'adult', course_types: { name: 'adult_group' } } })
data.groups.push({ ...data.groups.at(-1), id: 'adult-group', schedule_slot_id: 'slot-adult', coach_id: 'coach-c', profiles: { id: 'coach-c', full_name: 'โค้ชคนที่สาม', role: 'coach' }, coach_assignment_group_students: [{ booking_session_id: 'adult-learner' }] })
write(path.join(ui, 'src', 'fixture.json'), JSON.stringify(data))
write(path.join(ui, 'src/app/globals.css'), fs.readFileSync(path.join(root, 'src/app/globals.css')))
write(path.join(ui, 'src/app/layout.tsx'), `import './globals.css'\nexport default function Layout({ children }: { children: React.ReactNode }) { return <html lang="th"><body><main className="mx-auto max-w-7xl p-3">{children}</main></body></html> }\n`)
write(path.join(ui, 'src/app/page.tsx'), `import { SchedulesClient } from '@/components/admin/schedules-client'
import { buildAdminScheduleMonthSummary, type AdminScheduleGroupRow, type AdminScheduleWalletCreditRow } from '@/lib/admin-schedules-model'
import data from '@/fixture.json'
export default function Page() {
 const summary = buildAdminScheduleMonthSummary({ ...data, groups: data.groups as AdminScheduleGroupRow[], walletCredits: data.walletCredits as AdminScheduleWalletCreditRow[] })
 return <SchedulesClient summary={summary} initialYear={2026} initialMonth={11} initialPerformance={{durationMs:0,externalCalls:0,rows:{},calls:{}}} branches={[{id:'branch-a',name:'สาขาทดสอบ',slug:'test'},{id:'branch-b',name:'สาขาที่สอง',slug:'second'}]} />
}
`)
write(path.join(ui, 'src/app/api/admin/schedules/day/route.ts'), `import { NextRequest, NextResponse } from 'next/server'
import { buildAdminScheduleDayDetail, type AdminScheduleGroupRow, type AdminScheduleWalletCreditRow } from '@/lib/admin-schedules-model'
import data from '@/fixture.json'
export function GET(request: NextRequest) {
 const sessions = data.sessions.filter(s => s.date === request.nextUrl.searchParams.get('date'))
 return NextResponse.json(buildAdminScheduleDayDetail({sessions, groups:data.groups as AdminScheduleGroupRow[],walletCredits:data.walletCredits as AdminScheduleWalletCreditRow[],slotSessions:[],attendanceRows:[],studentLevels:[],levels:[],teachingPrograms:[]}))
}
`)
write(path.join(ui, 'src/app/api/admin/schedules/search/route.ts'), `import { NextRequest, NextResponse } from 'next/server'
import { buildAdminScheduleSearchResult, type AdminScheduleGroupRow } from '@/lib/admin-schedules-model'
import data from '@/fixture.json'
export function GET(request: NextRequest) {
 return NextResponse.json(buildAdminScheduleSearchResult({...data,groups:data.groups as AdminScheduleGroupRow[],query:request.nextUrl.searchParams.get('q') || '',startDate:'2026-11-01',endDate:'2026-11-30',limit:200,branchId:request.nextUrl.searchParams.get('branch') || undefined,courseType:request.nextUrl.searchParams.get('course') || undefined}))
}
`)
write(path.join(run, 'manifest.json'), JSON.stringify({ created: new Date().toISOString(), base: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), app, ui, files: manifest, isolation: 'no env files copied; build env uses unreachable loopback data target; UI only synthetic JSON, no service clients in its routes' }, null, 2))
console.log(JSON.stringify({ run, app, ui }))

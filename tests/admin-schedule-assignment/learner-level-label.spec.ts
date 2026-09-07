import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'

// No database, reset, credentials or remote fixtures. Runs with a no-global-setup
// runner. Actual portal components receive disposable in-memory read fixtures;
// framework navigation and server data providers alone are replaced.
const root = process.cwd()
const require = createRequire(path.join(root, 'package.json'))
const dir = path.join(root, '.playwright/lv0/components')
const label = 'LV 0 · นักเรียนใหม่/รอประเมิน'
let server: http.Server
let base: string

test.beforeAll(async () => {
  fs.mkdirSync(dir, { recursive: true })
  const put = (name: string, content: string) => fs.writeFileSync(path.join(dir, name), content)
  put('loader.cjs', `module.exports=function(s){return require(${JSON.stringify(require.resolve('typescript'))}).transpileModule(s,{compilerOptions:{module:99,target:7,jsx:4,esModuleInterop:true},fileName:this.resourcePath}).outputText}`)
  put('navigation.js', `export const useRouter=()=>({push(){},replace(){},refresh(){},prefetch(){}});export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const redirect=()=>{throw Error('Unexpected auth redirect')}`)
  put('link.jsx', `import React from 'react';export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}`)
  put('image.jsx', `import React from 'react';export default function Image({fill,priority,unoptimized,...props}){return <img {...props}/>}`)
  put('data.js', `
export const students=[
{id:'adult-zero',name:'ผู้ใหญ่ ทดสอบชื่อยาวสำหรับหน้าจอมือถือ',type:'adult',level:0},
{id:'child-zero',name:'เด็ก ทดสอบชื่อยาวสำหรับหน้าจอมือถือ',type:'child',level:0},
{id:'child-nine',name:'ผู้เรียนประเมินแล้ว',type:'child',level:9},
{id:'adult-ten',name:'ประเมินแล้วไม่มีชื่อ Level',type:'adult',level:10}
].map(s=>({...s,parentName:s.type==='child'?'ผู้ปกครองทดสอบ':null,branchName:'สาขาทดสอบ',source:'head_coach_branch',sessionCount:1,memory:[],currentLevel:s.level,lastUpdated:null,achievements:[],branchIds:['branch'],branchNames:['สาขาทดสอบ'],avatarUrl:null,levelName:s.level===0?'ข้อความเก่าที่ต้องไม่ทับ':s.level===9?'Backhand':null,levelUpdatedAt:null,evaluatedBy:null,notes:null}));
export const levels=[{id:0,name:'ยังไม่ประเมิน',is_active:true,category:'basic'},{id:9,name:'Backhand',is_active:true,category:'basic'}];
export const date='2026-09-20';
export const learnerRows=students.map((s,i)=>({id:'session-'+i,round_key:'slot',schedule_slot_id:'slot',date,start_time:'17:00',end_time:'18:00',status:'scheduled',is_makeup:false,child_id:s.type==='child'?s.id:null,student_id:s.id,student_type:s.type,level:s.level,level_name:s.levelName,level_category:s.level>0?'basic':null,learner_type:s.type==='child'?'child':'self',has_missing_child_link:false,branch_id:'branch',branch_name:'สาขาทดสอบ',course_type_id:'course',learner_name:s.name,parent_name:s.parentName,course_type:'private',booking_status:'verified',coach_names:[]}));
export const round={key:'slot',schedule_slot_id:'slot',date,start_time:'17:00',end_time:'18:00',branch_id:'branch',branch_name:'สาขาทดสอบ',course_type_id:'course',course_type:'private',learner_count:4,groups:[],unassigned_learners:learnerRows};
export const assignmentStudents=students.map((s,i)=>({bookingSessionId:'session-'+i,studentId:s.id,studentType:s.type,name:s.name,parentName:s.parentName,isChild:s.type==='child',level:s.level,levelName:s.levelName,levelCategory:s.level>0?'basic':null,levelProgramName:null,coachMemory:[],suggestedCoachId:null,suggestedCoachName:null}));
export const slot={key:'slot',scheduleSlotId:'slot',branchId:'branch',branchName:'สาขาทดสอบ',courseTypeId:'course',courseType:'private',date,startTime:'17:00',endTime:'18:00',legacyAssignedCoachId:null,legacyAssignedCoachName:null,suggestedCoachId:null,suggestedCoachName:null,suggestedCoachReason:null,assignmentLocked:false,assignmentLockReason:null,students:assignmentStudents,assignmentGroups:[{id:'group',name:'กลุ่มเดิม',coachId:null,coachName:null,levelMin:0,levelMax:10,sortOrder:0,studentSessionIds:assignmentStudents.map(s=>s.bookingSessionId)}],rosterDelta:{hasPersistedAssignment:true,addedStudents:[],removedCount:0,removedStudentNames:[]}};
export const sessions=learnerRows.slice(0,3).map((r,i)=>({...r,booking_id:'family',branch_id:'branch',rescheduled_from_id:null,level_label:i===0?undefined:i<2?'LV 0 / ยังไม่ประเมิน':'LV 9 · Backhand',children:r.child_id?{full_name:r.learner_name,nickname:null}:null,bookings:{course_types:{name:'private'}},branches:{name:'สาขาทดสอบ'}}));
export const teachingDay={slots:[{...slot,id:'slot',checkin:null,students:assignmentStudents.map(s=>({...s,studentName:s.name,studentNickname:null,assignmentGroupId:'group',assignmentGroupName:'กลุ่มเดิม',sessionStatus:'scheduled',attendanceStatus:null}))}],checkedSlotCount:0,totalStudents:4};
`)
  put('supabase.js', `import {students,levels} from './data';export async function createClient(){return {auth:{getUser:async()=>({data:{user:{id:'adult-zero'}}})},from(table){const data=table==='levels'?levels:table==='children'?students.filter(s=>s.type==='child').map(s=>({id:s.id,full_name:s.name,nickname:null})):table==='student_levels'?students.filter(s=>s.level>0).map(s=>({id:s.id,student_id:s.id,student_type:s.type,level:s.level,created_at:'2026-09-01',notes:null})):[];const q=new Proxy({}, {get(_,key){if(key==='then')return resolve=>Promise.resolve({data,error:null}).then(resolve);if(['insert','update','delete','upsert','rpc'].includes(key))throw Error('Fixture refuses writes');return ()=>q}});return q}}}`)
  put('teaching.js', `import {teachingDay} from './data';export const getCoachAssignedTeachingDay=async()=>teachingDay;export {formatCoachAssignedGroupLevelRange} from ${JSON.stringify(path.join(root,'src/lib/coach-assigned-schedule.ts'))};`)
  put('hours.js', 'export const getCoachTeachingHourSourceRows=async()=>[];')
  put('admin.js', "export const getServiceRoleClient=()=>{throw Error('Fixture refuses service-role access')};")
  put('entry.tsx', `
import React from 'react';import {createRoot} from 'react-dom/client';
import {RankingBoard} from '@/components/shared/ranking-board';
import {StudentsClient} from '@/components/coach/students-client';
import {LevelsClient} from '@/components/coach/levels-client';
import {AssignGroupsClient} from '@/components/coach/assign-groups-client';
import {SchedulesClient} from '@/components/admin/schedules-client';
import {ScheduleCalendarClient} from '@/components/dashboard/schedule-calendar-client';
import ProgressPage from '@/app/(dashboard)/dashboard/progress/page';
import TodayPage from '@/app/(coach)/coach/today/page';
import {students,levels,round,slot,sessions,date,learnerRows} from './data';
window.fixtureDay={sessions:learnerRows,rounds:[round]};
const surface=location.pathname;let element;
async function start(){
if(surface.includes('ranking')) element=<RankingBoard kids={students.filter(s=>s.type==='child').map(s=>({...s,type:'kid'}))} adults={students.filter(s=>s.type==='adult')} branches={[{id:'branch',name:'สาขาทดสอบ'}]} canManageAchievements={surface.includes('admin')} enableSearch/>;
else if(surface.includes('students')) element=<StudentsClient students={students}/>;
else if(surface.includes('levels')) element=<LevelsClient students={students} levels={levels}/>;
else if(surface.includes('assign-groups')) element=<AssignGroupsClient coaches={[]} slots={[slot]} selectedMonth="2026-09" currentBangkokMonth="2026-09" coachMemoryEnabled={false}/>;
else if(surface.includes('/admin/schedules')) element=<SchedulesClient summary={{rounds:[{...round,session_count:4,waiting_coach_count:4,walleted_count:0}],totalsByFilter:{}}} initialPerformance={{durationMs:0,externalCalls:0,rows:{},calls:{}}} branches={[{id:'branch',name:'สาขาทดสอบ',slug:'fixture'}]} initialYear={2026} initialMonth={9}/>;
else if(surface.includes('/dashboard/schedule')) element=<ScheduleCalendarClient sessions={sessions} learnerChildren={students.filter(s=>s.type==='child').map(s=>({id:s.id,full_name:s.name,nickname:null}))} userName={students[0].name} initialYear={2026} initialMonth={8} todayDate="2026-09-07" renderedAt="2026-09-07T00:00:00Z"/>;
else if(surface.includes('progress')) element=await ProgressPage();
else element=await TodayPage({searchParams:Promise.resolve({date})});
createRoot(document.getElementById('root')).render(element);
}start().catch(e=>{document.body.textContent=e.stack;throw e});
`)
  const { webpack } = require('next/dist/compiled/webpack/webpack')
  await new Promise<void>((resolve, reject) => webpack({
    mode: 'development', target: 'web', devtool: false, entry: path.join(dir, 'entry.tsx'),
    output: { path: dir, filename: 'bundle.js' },
    resolve: { extensions: ['.tsx', '.ts', '.jsx', '.js'], alias: {
      'next/navigation$': path.join(dir, 'navigation.js'), 'next/image$': path.join(dir, 'image.jsx'),
      'next/link$': path.join(dir, 'link.jsx'), '@/lib/supabase/server$': path.join(dir, 'supabase.js'),
      '@/lib/coach-assigned-schedule$': path.join(dir, 'teaching.js'),
      '@/lib/coach-teaching-hours$': path.join(dir, 'hours.js'),
      '@/lib/auth/admin$': path.join(dir, 'admin.js'),
      '@': path.join(root, 'src'),
    } },
    module: { rules: [{ test: /\.[jt]sx?$/, exclude: /node_modules/, use: path.join(dir, 'loader.cjs') }] },
  }, (error: Error | null, stats: { hasErrors(): boolean; toString(): string }) => {
    if (error || stats.hasErrors()) reject(error || new Error(stats.toString()))
    else resolve()
  }))
  execFileSync(process.execPath, [require.resolve('tailwindcss/lib/cli.js'), '-i', 'src/app/globals.css', '-o', path.join(dir, 'style.css')], { cwd: root, stdio: 'pipe' })
  server = http.createServer((req, res) => {
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return }
    const file = req.url === '/bundle.js' ? 'bundle.js' : req.url === '/style.css' ? 'style.css' : null
    res.setHeader('Content-Type', file === 'bundle.js' ? 'application/javascript' : file ? 'text/css' : 'text/html; charset=utf-8')
    res.end(file ? fs.readFileSync(path.join(dir, file)) : '<html lang="th"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body><main id="root" class="mx-auto max-w-6xl p-4"></main><script src="/bundle.js"></script></body></html>')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
})

test.afterAll(async () => { if (server) await new Promise<void>((resolve) => server.close(() => resolve())) })

async function checkBadges(page: Page) {
  const badges = page.getByText(label, { exact: true })
  await expect(badges.first()).toBeVisible()
  for (const badge of await badges.all()) {
    if (!await badge.isVisible()) continue
    const metrics = await badge.evaluate((el) => {
      const s = getComputedStyle(el), r = el.getBoundingClientRect()
      return { color: s.color, weight: Number(s.fontWeight), size: parseFloat(s.fontSize), wrap: s.whiteSpace, clip: el.scrollWidth > el.clientWidth + 1, right: r.right, width: innerWidth }
    })
    expect(metrics.color).toBe('rgb(185, 28, 28)')
    expect(metrics.weight).toBeGreaterThanOrEqual(700)
    expect(metrics.size).toBeGreaterThanOrEqual(14)
    expect(metrics.wrap).toBe('normal')
    expect(metrics.clip).toBe(false)
    expect(metrics.right).toBeLessThanOrEqual(metrics.width)
  }
}

for (const width of [320, 390, 1440]) for (const surface of ['/admin/schedules', '/admin/ranking', '/coach/assign-groups', '/coach/today', '/coach/students', '/coach/levels', '/dashboard/schedule', '/dashboard/progress', '/ranking']) {
  test(`${surface} LV0 child/adult and assessed presentation at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    page.setDefaultTimeout(15000)
    const errors: string[] = [], writes: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    await page.route('**/*', async route => {
      const request = route.request()
      if (request.method() !== 'GET') { writes.push(request.url()); await route.abort(); return }
      if (!request.url().startsWith(base + '/')) { await route.abort(); return }
      if (request.url().includes('/api/admin/schedules/day')) {
        const json = await page.evaluate(() => (window as unknown as { fixtureDay: unknown }).fixtureDay)
        await route.fulfill({ json }); return
      }
      await route.continue()
    })
    await page.goto(base + surface)
    if (surface === '/admin/schedules') await page.getByTestId('admin-schedule-calendar-day-2026-09-20').click()
    if (surface === '/dashboard/schedule') await page.getByRole('button', { name: 'ดูตารางวันที่ 2026-09-20', exact: true }).click()
    await checkBadges(page)
    const assessedLabel = surface === '/coach/assign-groups' ? 'Backhand (LV 9)'
      : ['/admin/schedules', '/coach/today', '/dashboard/schedule'].includes(surface) ? 'LV 9 · Backhand'
      : surface.includes('ranking') || surface === '/coach/levels' ? 'Backhand' : 'พื้นฐาน'
    await expect(page.getByText(assessedLabel, { exact: true }).first()).toBeVisible()
    if (surface === '/coach/assign-groups' || surface === '/coach/today') {
      await expect(page.getByText('เด็กในกลุ่ม LV 9-10 + ยังไม่ประเมิน 2 คน', { exact: true })).toBeVisible()
    }
    await page.screenshot({ path: testInfo.outputPath('rendered.png'), fullPage: true })
    if (surface === '/coach/levels') {
      await page.getByRole('button', { name: 'กรอก LV', exact: true }).first().click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await expect(page.getByRole('dialog')).toHaveCSS('opacity', '1')
      await checkBadges(page)
      await page.screenshot({ path: testInfo.outputPath('current-level-dialog.png'), fullPage: true })
    }
    if (surface === '/dashboard/schedule') {
      await page.getByText('LV 9 · Backhand', { exact: true }).scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath('family-participants.png'), fullPage: true })
      await page.getByRole('button', { name: 'เก็บทั้งครอบครัวเข้ากระเป๋า', exact: true }).click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
      await expect(page.getByRole('alertdialog')).toHaveCSS('opacity', '1')
      await checkBadges(page)
      await page.screenshot({ path: testInfo.outputPath('family-read-only-dialog.png'), fullPage: true })
    }
    if (surface.includes('ranking')) {
      await page.getByRole('tab', { name: /ผู้ใหญ่/ }).click()
      await checkBadges(page)
      const search = page.getByRole('textbox')
      await search.fill('ผู้ใหญ่')
      await checkBadges(page)
      await search.fill(label)
      await checkBadges(page)
      await search.fill('')
      await page.getByRole('combobox').nth(1).click()
      await page.getByRole('option', { name: 'Level 0', exact: true }).click()
      await checkBadges(page)
      await expect(page.getByText('ประเมินแล้วไม่มีชื่อ Level', { exact: true })).toHaveCount(0)
      await search.fill('ไม่มีผู้เรียนนี้')
      await expect(page.getByText(label, { exact: true })).toHaveCount(0)
    }
    expect(writes).toEqual([])
    expect(errors).toEqual([])
  })
}

import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { createServerClient } from '@supabase/ssr'
import { randomUUID } from 'node:crypto'
import { account, seed, snapshot, payload, login, password, type Account, type Fixture } from '../assignment-roster/fixtures'
import { localSql as sql, sqlLiteral as q, holdLocalTransaction } from '../task10-regression/local-supabase'
import { lessonSourceEnvironment } from '../../scripts/verify-lesson-source-test-target.mjs'
import { seed as seedFamily, paymentEvidence } from './local-db.mjs'

const clients: APIRequestContext[] = []
async function api(a: Account, playwright: { request: typeof import('@playwright/test').request }) {
  const env = lessonSourceEnvironment(), cookies = new Map<string, string>()
  const auth = createServerClient(env.apiUrl, env.publishableKey, { cookies: { getAll: () => [...cookies].map(([name,value]) => ({name,value})), setAll: rows => rows.forEach(r => cookies.set(r.name,r.value)) } })
  expect((await auth.auth.signInWithPassword({email:a.email,password})).error).toBeNull()
  const c = await playwright.request.newContext({baseURL:'http://127.0.0.1:3163',extraHTTPHeaders:{Cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; ')}})
  clients.push(c); return c
}
async function actors() { return { parent: await account('user','ผู้ปกครองอัตโนมัติ'), head: await account('head_coach','หัวหน้าอัตโนมัติ'), coach: await account('coach','โค้ชอัตโนมัติ') } }
async function body(c: APIRequestContext, f: Fixture, coach: Account, clockOffset = 0) {
  const response = await c.get(`/api/coach/assignment-groups?scheduleSlotId=${f.slot}&branchId=${f.branch}`)
  expect(response.status()).toBe(200)
  const ctx = await response.json()
  const data = { scheduleSlotId:f.slot,branchId:f.branch,groups:payload(f,coach),expectedGroups:ctx.canonicalGroups,saveContext:ctx.saveContext,requestId:randomUUID(),deadline:new Date(Date.now()+20_000+clockOffset).toISOString() }
  expect((await c.post('/api/coach/assignment-groups',{data:{...data,prepare:true}})).status()).toBe(200)
  return data
}
const store = (f: Fixture, parent: Account, index=0) => sql(`SELECT lesson_source_transition_v1(${q(parent.id)},'store',${q(f.ids[index])},'{}');`)
test.afterAll(async()=>{for(const c of clients)await c.dispose()})

test('Store-first reconciles exactly removed learner, receipts survive later Store and prevent duplicate effects',async({playwright})=>{
  const a=await actors(),f=seed(a.parent,[a.head,a.coach]),c=await api(a.head,playwright),data=await body(c,f,a.coach)
  store(f,a.parent)
  const saved=await c.post('/api/coach/assignment-groups',{data});expect(saved.status()).toBe(200)
  const result=await saved.json();expect(result.result.removedSessionIds).toEqual([f.ids[0]])
  expect(snapshot(f)[0].student_session_ids).toEqual([f.ids[1]])
  const notices=sql(`SELECT count(*) FROM notifications WHERE user_id=${q(a.coach.id)};`)
  store(f,a.parent,1)
  const replay=await c.post('/api/coach/assignment-groups',{data});expect(replay.status()).toBe(200)
  expect((await replay.json()).noAssignmentNeeded).toBe(true)
  expect(sql(`SELECT count(*) FROM assignment5_receipts WHERE request_id=${q(data.requestId)};`)).toBe('1')
  const afterStore=sql(`SELECT count(*) FROM notifications WHERE user_id=${q(a.coach.id)};`)
  await c.post('/api/coach/assignment-groups',{data});expect(sql(`SELECT count(*) FROM notifications WHERE user_id=${q(a.coach.id)};`)).toBe(afterStore)
  expect(Number(afterStore)).toBeGreaterThanOrEqual(Number(notices))
  expect((await c.post('/api/coach/assignment-groups',{data:{...data,groups:[{...data.groups[0],name:'ร่างอื่น'}]}})).status()).toBe(409)
})

test('everyone Stored finishes with no assignment needed and does not manufacture an empty group',async({playwright})=>{
  const a=await actors(),f=seed(a.parent,[a.head,a.coach],1),c=await api(a.head,playwright),data=await body(c,f,a.coach)
  store(f,a.parent)
  const response=await c.post('/api/coach/assignment-groups',{data});expect(response.status()).toBe(200)
  expect((await response.json()).noAssignmentNeeded).toBe(true);expect(snapshot(f)).toEqual([])
})

test('legacy full slot normalization by Store completes while unrelated slot edits still require review',async({playwright})=>{
  const a=await actors(),c=await api(a.head,playwright)
  for(const unrelated of [false,true]){
    const f=seed(a.parent,[a.head,a.coach])
    sql(`UPDATE schedule_slots SET status='full' WHERE id=${q(f.slot)};`)
    const data=await body(c,f,a.coach)
    sql(`BEGIN;SELECT lesson_source_transition_v1(${q(a.parent.id)},'store',${q(f.ids[0])},'{}');${unrelated?`UPDATE schedule_slots SET status='cancelled' WHERE id=${q(f.slot)};`:''}COMMIT;`)
    const response=await c.post('/api/coach/assignment-groups',{data})
    expect(response.status()).toBe(unrelated?409:200)
    if(unrelated)expect(snapshot(f)).toEqual([])
    else{expect(snapshot(f)[0].student_session_ids).toEqual([f.ids[1]]);expect(sql(`SELECT status FROM schedule_slots WHERE id=${q(f.slot)};`)).toBe('open')}
  }
})

test('Family all participants finish together with one credit and no empty assignment',async({playwright})=>{
  const a=await actors(),f=seedFamily(a.parent,[a.head,a.coach],3,'private') as Fixture,c=await api(a.head,playwright)
  paymentEvidence(f,a.parent)
  const data=await body(c,f,a.coach)
  store(f,a.parent)
  const response=await c.post('/api/coach/assignment-groups',{data});expect(response.status()).toBe(200)
  expect((await response.json()).noAssignmentNeeded).toBe(true)
  expect(sql(`SELECT count(*) FROM lesson_wallet_credits WHERE booking_id=${q(f.booking)};`)).toBe('1')
  expect(sql(`SELECT count(*) FROM booking_sessions WHERE booking_id=${q(f.booking)} AND status='walleted';`)).toBe('3')
})

test('old v2 writer ABA is rejected even when groups look exactly like the signed baseline',async({playwright})=>{
  const a=await actors(),f=seed(a.parent,[a.head,a.coach]),c=await api(a.head,playwright)
  sql(`SELECT save_coach_assignment_groups_v2(${q(f.slot)},${q(a.head.id)},${q(JSON.stringify(payload(f,a.coach)))});`)
  const data=await body(c,f,a.coach)
  sql(`SELECT save_coach_assignment_groups_v2(${q(f.slot)},${q(a.head.id)},${q(JSON.stringify([{...payload(f,a.coach)[0],name:'ชื่อชั่วคราว'}]))}); SELECT save_coach_assignment_groups_v2(${q(f.slot)},${q(a.head.id)},${q(JSON.stringify(payload(f,a.coach)))});`)
  expect((await c.post('/api/coach/assignment-groups',{data})).status()).toBe(409)
  expect(sql(`SELECT count(*) FROM assignment5_receipts WHERE request_id=${q(data.requestId)};`)).toBe('0')
})

test('unrelated cancellation metadata change cannot hide behind a legitimate Store',async({playwright})=>{
  const a=await actors(),f=seed(a.parent,[a.head,a.coach]),c=await api(a.head,playwright),data=await body(c,f,a.coach)
  store(f,a.parent)
  sql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);UPDATE booking_sessions SET cancelled_at=clock_timestamp() WHERE id=${q(f.ids[1])};COMMIT;`)
  expect((await c.post('/api/coach/assignment-groups',{data})).status()).toBe(409);expect(snapshot(f)).toEqual([])
})

for(const skew of [-300_000,300_000])test(`server budget tolerates client clock offset ${skew} and confirms receipt after expiry`,async({playwright})=>{
  const a=await actors(),f=seed(a.parent,[a.head,a.coach]),c=await api(a.head,playwright),data=await body(c,f,a.coach,skew)
  expect((await c.post('/api/coach/assignment-groups',{data})).status()).toBe(200)
  sql(`UPDATE assignment5_requests SET deadline=clock_timestamp()-interval '1 second' WHERE request_id=${q(data.requestId)};`)
  const response=await c.post('/api/coach/assignment-groups',{data});expect(response.status()).toBe(200);expect((await response.json()).result.replayed).toBe(true)
})

test('coach role revoked after snapshot cannot be written by the queued intent',async({playwright})=>{
  const a=await actors(),f=seed(a.parent,[a.head,a.coach]),c=await api(a.head,playwright),data=await body(c,f,a.coach)
  sql(`UPDATE profiles SET role='user' WHERE id=${q(a.coach.id)};`)
  expect((await c.post('/api/coach/assignment-groups',{data})).status()).toBe(409);expect(snapshot(f)).toEqual([])
})

test('Store plus unrelated group write in the same transaction is never auto-merged',async({playwright})=>{
  const a=await actors(),f=seed(a.parent,[a.head,a.coach]),c=await api(a.head,playwright)
  sql(`SELECT save_coach_assignment_groups_v2(${q(f.slot)},${q(a.head.id)},${q(JSON.stringify(payload(f,a.coach)))});`)
  const data=await body(c,f,a.coach)
  sql(`BEGIN;SELECT lesson_source_transition_v1(${q(a.parent.id)},'store',${q(f.ids[0])},'{}'); UPDATE coach_assignment_groups SET name='งานคนอื่น' WHERE schedule_slot_id=${q(f.slot)}; COMMIT;`)
  expect((await c.post('/api/coach/assignment-groups',{data})).status()).toBe(409)
  expect(snapshot(f)[0].name).toBe('งานคนอื่น');expect(snapshot(f)[0].student_session_ids).toEqual([f.ids[1]])
})

test('tampered context, foreign branch and anonymous receipt lookup are refused',async({playwright})=>{
  const a=await actors(),f=seed(a.parent,[a.head,a.coach]),c=await api(a.head,playwright),data=await body(c,f,a.coach)
  expect((await c.post('/api/coach/assignment-groups',{data:{...data,saveContext:{...data.saveContext,signature:'0'.repeat(64)}}})).status()).toBe(409)
  const other=await api(await account('head_coach','ต่างสาขา'),playwright)
  expect((await other.get(`/api/coach/assignment-groups?scheduleSlotId=${f.slot}&branchId=${f.branch}&requestId=${data.requestId}`)).status()).toBe(403)
  const anon=await playwright.request.newContext({baseURL:'http://127.0.0.1:3163'});clients.push(anon)
  expect((await anon.get(`/api/coach/assignment-groups?scheduleSlotId=${f.slot}&branchId=${f.branch}&requestId=${data.requestId}`)).status()).toBe(401)
})

async function parentScreen(page:Page,a:Account,f:Fixture){
  await page.goto('/auth/login');await page.getByLabel('อีเมล',{exact:true}).fill(a.email);await page.locator('input#password').fill(password)
  await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();await expect(page).not.toHaveURL(/auth\/login/)
  await page.goto('/dashboard/schedule')
  if(Number(f.date.slice(5,7))!==Number(sql("SELECT to_char(now() at time zone 'Asia/Bangkok','MM');")))await page.getByRole('button',{name:'เดือนถัดไป',exact:true}).click()
  await page.getByRole('button',{name:`ดูตารางวันที่ ${f.date}`,exact:true}).click()
  await page.locator('div.rounded-xl.border.bg-white').filter({has:page.getByText('เด็ก Roster 1',{exact:true})}).getByRole('button',{name:'เก็บเข้ากระเป๋า',exact:true}).click()
}
async function draft(page:Page,coach:Account){await page.getByLabel('ชื่อกลุ่ม',{exact:true}).fill('จัดครั้งเดียว');await page.getByRole('combobox').first().click();await page.getByRole('option',{name:`${coach.name} - โค้ช`,exact:true}).click()}

for(const order of ['Store','Save'])test(`two browsers ${order}-first both finish with exactly one user click`,async({browser},info)=>{
  const a=await actors(),date=sql("SELECT ((now() at time zone 'Asia/Bangkok')::date+4)::text;"),f=seed(a.parent,[a.head,a.coach],2,date)
  sql(`BEGIN;SELECT set_config('task10.payment_write','authorized',true);UPDATE bookings SET month=${Number(date.slice(5,7))},year=${date.slice(0,4)} WHERE id=${q(f.booking)};COMMIT;`)
  const hc=await browser.newContext({viewport:{width:1366,height:1000}}),pc=await browser.newContext({viewport:{width:390,height:900}})
  try{
    const h=await hc.newPage(),p=await pc.newPage();await login(h,a.head,f);await draft(h,a.coach);await parentScreen(p,a.parent,f)
    const sources:string[]=[]
    p.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/api/lesson-wallet'))sources.push(request.postDataJSON().sessionId)})
    let release!:()=>void,arrived!:()=>void
    const gate=new Promise<void>(resolve=>{release=resolve}),seen=new Promise<void>(resolve=>{arrived=resolve})
    const held=order==='Store'?h:p,url=order==='Store'?'**/api/coach/assignment-groups':'**/api/lesson-wallet'
    await held.route(url,async route=>{if(route.request().postDataJSON()?.prepare){await route.continue();return}arrived();await gate;await route.continue()})
    if(order==='Store'){
      await h.getByRole('button',{name:'บันทึก/ยืนยันการมอบหมาย',exact:true}).click();await seen
      await p.getByRole('button',{name:'ยืนยันเก็บเข้ากระเป๋า',exact:true}).click();await expect(p.getByText('เก็บเข้ากระเป๋าแล้ว',{exact:true}).last()).toBeVisible();release()
    }else{
      await p.getByRole('button',{name:'ยืนยันเก็บเข้ากระเป๋า',exact:true}).click();await seen
      await h.getByRole('button',{name:'บันทึก/ยืนยันการมอบหมาย',exact:true}).click();await expect.poll(()=>snapshot(f)[0]?.name).toBe('จัดครั้งเดียว');release()
    }
    await expect.poll(()=>snapshot(f)[0]?.student_session_ids).toEqual([f.ids[1]])
    await expect(h.getByRole('button',{name:'กำลังบันทึก',exact:true})).toHaveCount(0)
    await expect(p.getByRole('alertdialog')).toHaveCount(0)
    expect(sources.length).toBeGreaterThan(0);expect(sources.every(id=>id===f.ids[0])).toBe(true)
    await expect(h.getByText('ผู้เรียนทั้งหมด',{exact:true}).locator('..').locator('p').last()).toHaveText('1',{timeout:15_000})
    await expect(h.getByText('เด็ก Roster 1',{exact:true})).toHaveCount(0)
    await expect(h.getByText('เด็ก Roster 2',{exact:true})).toBeVisible()
    await expect(p.getByText('อยู่ในกระเป๋า',{exact:false})).toBeVisible()
    await h.screenshot({path:info.outputPath('head-complete.png'),fullPage:true});await p.screenshot({path:info.outputPath('parent-complete.png'),fullPage:true})
    expect(sql(`SELECT count(*) FROM lesson_wallet_credits WHERE booking_id=${q(f.booking)};`)).toBe('1')
  }finally{await hc.close();await pc.close()}
})

test('foreground server budget admits at most three aborted write attempts',async({playwright})=>{
  const a=await actors(),f=seed(a.parent,[a.head,a.coach]),c=await api(a.head,playwright),data=await body(c,f,a.coach)
  const held=await holdLocalTransaction(`SELECT id FROM bookings WHERE id=${q(f.booking)} FOR UPDATE;`,'a5-auto-budget')
  try{
    for(let i=0;i<3;i++){const response=await c.post('/api/coach/assignment-groups',{data});expect((await response.json()).code).toBe('COACH_ASSIGNMENT_RETRY')}
    const fourth=await c.post('/api/coach/assignment-groups',{data});expect((await fourth.json()).code).toBe('COACH_ASSIGNMENT_STOPPED')
    expect(sql(`SELECT attempts FROM assignment5_requests WHERE request_id=${q(data.requestId)};`)).toBe('3');expect(snapshot(f)).toEqual([])
  }finally{await held.finish()}
})

test('a fully removed group disappears while remaining group keeps its chosen coach',async({playwright})=>{
  const a=await actors(),f=seed(a.parent,[a.head,a.coach]),c=await api(a.head,playwright),initial=await body(c,f,a.coach)
  const data={...initial,requestId:randomUUID(),groups:[{...initial.groups[0],name:'กลุ่มออก',coachId:null,studentSessionIds:[f.ids[0]]},{...initial.groups[0],name:'กลุ่มคงอยู่',sortOrder:1,studentSessionIds:[f.ids[1]]}]}
  expect((await c.post('/api/coach/assignment-groups',{data:{...data,prepare:true}})).status()).toBe(200)
  store(f,a.parent)
  expect((await c.post('/api/coach/assignment-groups',{data})).status()).toBe(200)
  expect(snapshot(f)).toHaveLength(1);expect(snapshot(f)[0].name).toBe('กลุ่มคงอยู่');expect(snapshot(f)[0].coach_id).toBe(a.coach.id)
})

for(const variant of ['uncommitted-offline','ABA','newer-edit'])test(`reload recovery ${variant} preserves original draft and cannot silently rebase`,async({page},info)=>{
  const a=await actors(),f=seed(a.parent,[a.head,a.coach])
  if(variant==='ABA')sql(`SELECT save_coach_assignment_groups_v2(${q(f.slot)},${q(a.head.id)},${q(JSON.stringify(payload(f,a.coach)))});`)
  await login(page,a.head,f)
  if(variant==='ABA')await page.getByLabel('ชื่อกลุ่ม',{exact:true}).fill('ร่างเดิมที่ต้องอยู่')
  else await draft(page,a.coach)
  let deny=true,posts=0,readSeen!:()=>void
  const seen=new Promise<void>(resolve=>{readSeen=resolve})
  await page.route('**/api/coach/assignment-groups',async route=>{
    if(route.request().postDataJSON()?.prepare){await route.continue();return}
    posts++
    if(variant==='ABA'&&!deny){await route.continue();return}
    if(variant==='newer-edit'){const response=await route.fetch();expect(response.status()).toBe(200)}
    await route.abort()
  })
  await page.route('**/api/coach/assignment-groups?**',async route=>{if(route.request().url().includes('requestId=')){readSeen();if(deny){await route.fulfill({status:503,json:{error:'offline'}});return}}await route.continue()})
  await page.getByRole('button',{name:'บันทึก/ยืนยันการมอบหมาย',exact:true}).click();await seen
  if(variant==='ABA'){
    sql(`SELECT save_coach_assignment_groups_v2(${q(f.slot)},${q(a.head.id)},${q(JSON.stringify([{...payload(f,a.coach)[0],name:'เปลี่ยนชั่วคราว'}]))});SELECT save_coach_assignment_groups_v2(${q(f.slot)},${q(a.head.id)},${q(JSON.stringify(payload(f,a.coach)))});`)
  }
  await page.reload()
  await expect(page.getByLabel('ชื่อกลุ่ม',{exact:true})).toHaveValue(variant==='ABA'?'ร่างเดิมที่ต้องอยู่':'จัดครั้งเดียว')
  if(variant==='uncommitted-offline'){
    expect(posts).toBe(1);expect(snapshot(f)).toEqual([])
  }else if(variant==='ABA'){
    sql(`UPDATE assignment5_requests SET deadline=clock_timestamp()-interval '1 second' WHERE slot_id=${q(f.slot)};`)
    deny=false
    await page.getByRole('button',{name:'บันทึก/ยืนยันการมอบหมาย',exact:true}).click()
    await expect(page.getByRole('button',{name:'ใช้รายชื่อปัจจุบัน',exact:true})).toBeVisible({timeout:15_000})
    expect(snapshot(f)[0].name).toBe('ชุดพื้นฐาน')
  }else{
    await page.getByLabel('ชื่อกลุ่ม',{exact:true}).fill('ร่างที่แก้ต่อ')
    sql(`SELECT save_coach_assignment_groups_v2(${q(f.slot)},${q(a.head.id)},${q(JSON.stringify([{...payload(f,a.coach)[0],name:'งานหัวหน้าอีกคน'}]))});`)
    deny=false;await page.evaluate(()=>window.dispatchEvent(new Event('online')))
    await expect(page.getByRole('button',{name:'ใช้รายชื่อปัจจุบัน',exact:true})).toBeVisible({timeout:15_000})
    await expect(page.getByLabel('ชื่อกลุ่ม',{exact:true})).toHaveValue('ร่างที่แก้ต่อ');expect(snapshot(f)[0].name).toBe('งานหัวหน้าอีกคน')
    expect(posts).toBe(1)
  }
  await page.screenshot({path:info.outputPath('recovered-draft.png'),fullPage:true})
})

for(const mode of ['after-commit-then-Store','before-server','reload'])test(`Save lost response ${mode} confirms original request without a second click`,async({page},info)=>{
  const a=await actors(),f=seed(a.parent,[a.head,a.coach]);await login(page,a.head,f);await draft(page,a.coach)
  let posts=0,readSeen!:()=>void,deny=mode==='reload';const seen=new Promise<void>(resolve=>{readSeen=resolve})
  await page.route('**/api/coach/assignment-groups',async route=>{
    if(route.request().postDataJSON()?.prepare){await route.continue();return}
    posts++
    if(mode==='before-server'&&posts===1){await route.abort();return}
    const response=await route.fetch();expect(response.status()).toBe(200)
    if(mode==='after-commit-then-Store')store(f,a.parent)
    await route.abort()
  })
  await page.route('**/api/coach/assignment-groups?**',async route=>{if(route.request().url().includes('requestId=')){readSeen();if(deny){await route.fulfill({status:503,json:{error:'local unavailable'}});return}}await route.continue()})
  await page.getByRole('button',{name:'บันทึก/ยืนยันการมอบหมาย',exact:true}).click()
  if(mode==='reload'){await seen;deny=false;await page.reload()}
  await expect(page.getByText(/บันทึกกลุ่มแล้ว/).last()).toBeVisible({timeout:25_000})
  expect(posts).toBe(mode==='before-server'?2:1)
  expect(sql(`SELECT count(*) FROM assignment5_receipts WHERE slot_id=${q(f.slot)};`)).toBe('1')
  if(mode==='after-commit-then-Store')expect(snapshot(f)[0].student_session_ids).toEqual([f.ids[1]])
  await page.screenshot({path:info.outputPath('save-confirmed.png'),fullPage:true})
})

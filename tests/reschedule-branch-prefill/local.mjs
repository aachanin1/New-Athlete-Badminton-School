import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServerClient } from '@supabase/ssr'
import { chromium, expect } from '@playwright/test'
import ts from 'typescript'

const root = resolve('.playwright/reschedule-branch-and-booking-prefill-1')
process.env.LESSON_SOURCE_RUN_MANIFEST = resolve(root, 'run.json')
process.env.TASK10_DISPOSABLE_TARGET = resolve(root, 'target.json')
const { run, env, db, sql, q } = await import('../branch-closure/isolated-runtime.mjs')
const base = 'http://127.0.0.1:63710'
assert.equal(env.apiUrl, 'http://127.0.0.1:63701')
const copied = JSON.parse(readFileSync(resolve(root, 'app-development/source-manifest.json'), 'utf8'))
const testSha256 = createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex')
assert.equal(copied.runId, run.runId)
for (const file of ['src/lib/booking-checkout-server.ts', 'src/components/dashboard/reschedule-client.tsx']) {
  assert.deepEqual(readFileSync(file), readFileSync(resolve(root, 'app-development', file)))
}

const read = statement => JSON.parse(sql(statement))
const checks = []
const evidence = (label, observed) => {
  checks.push({ label, observed })
  console.log(JSON.stringify({ label, observed }))
}
const unique = randomUUID()
const slugPrefix = 'reschedule-branch-qa-'
const month = sql("select to_char(date_trunc('month',now() at time zone 'Asia/Bangkok')+interval '1 month','YYYY-MM')")
const day = n => month + '-' + String(n).padStart(2, '0')
const [year, monthNumber] = month.split('-').map(Number)
const password = randomUUID() + 'Local!9'
const branchNames = ['345', 'พระราม 2', 'รามอินทรา', 'สาขาปิด']
const [cross, rama, ramintra, inactive] = branchNames.map(() => randomUUID())
const writeContext = "SET LOCAL lesson_source.write='authorized'; SET LOCAL task10.source_write='authorized';"

sql(`BEGIN;
INSERT INTO course_types(name,max_students,duration_hours)
SELECT item::course_type_name, 20, CASE WHEN item='private' THEN 1 ELSE 2 END
FROM unnest(ARRAY['kids_group','adult_group','private']) item
WHERE NOT EXISTS(SELECT 1 FROM course_types WHERE course_types.name::text=item);
UPDATE branches SET is_active=false WHERE slug LIKE ${q(slugPrefix+'%')};
DELETE FROM schedule_templates t USING branches b
WHERE t.branch_id=b.id AND b.slug LIKE ${q(slugPrefix+'%')} AND NOT b.is_active
  AND NOT EXISTS (SELECT 1 FROM schedule_slots s WHERE s.template_id=t.id);
${branchNames.map((name,i) => `INSERT INTO branches(id,name,slug,is_active) VALUES(${q([cross,rama,ramintra,inactive][i])},${q(name)},${q(slugPrefix+unique+'-'+i)},${i !== 3});`).join('\n')}
COMMIT;`)
const courses = read('SELECT jsonb_object_agg(name,id) FROM course_types')
sql(`BEGIN;
UPDATE task10_policy_activation SET state='never_activated',effective_at=NULL,pricing_enabled=false,makeup_enabled=false,expiry_enabled=false
  WHERE NOT EXISTS (SELECT 1 FROM task10_pricing_catalog_heads WHERE regime='early');
INSERT INTO pricing_tiers(course_type_id,min_sessions,max_sessions,price_per_session,package_price,valid_from)
  SELECT ${q(courses.kids_group)},1,NULL,700,700,'2020-01-01'
  WHERE NOT EXISTS (SELECT 1 FROM pricing_tiers WHERE course_type_id=${q(courses.kids_group)});
SELECT task10_bootstrap_catalogs_v1() WHERE EXISTS(SELECT 1 FROM task10_policy_activation WHERE state='never_activated');
UPDATE task10_policy_activation SET state='active',effective_at=clock_timestamp()-interval '1 day',pricing_enabled=true,makeup_enabled=true,expiry_enabled=true;
UPDATE booking_ux_control SET enabled=true;
UPDATE booking_bill_policy_control SET enabled=true;
COMMIT;`)

const templates = new Map()
const templateKey = (branch, date, start) => [branch, new Date(date+'T12:00:00+07:00').getUTCDay(), start].join('/')
const times = [['09:00','11:00'], ['13:00','15:00'], ['15:00','17:00'], ['17:00','19:00']]
const inserts = []
for (const branch of [cross,rama,ramintra]) for (let weekday=0;weekday<7;weekday++) for (const [start,end] of times) {
  const id = randomUUID()
  templates.set([branch,weekday,start].join('/'), id)
  inserts.push(`(${q(id)},${q(branch)},${q(courses.kids_group)},${weekday},${q(start)},${q(end)},true)`)
}
sql('INSERT INTO schedule_templates(id,branch_id,course_type_id,day_of_week,start_time,end_time,is_active) VALUES '+inserts.join(','))

async function actor(role = 'user') {
  const email = randomUUID()+'@example.invalid'
  const created = await db.auth.admin.createUser({email,password,email_confirm:true})
  assert.ifError(created.error)
  assert.ifError((await db.from('profiles').update({role,full_name:'Local QA'}).eq('id',created.data.user.id)).error)
  return {id:created.data.user.id,email}
}

function newBill(owner, { course = 'kids_group', child = null, branch, status = 'verified', minutesAgo = 0 }) {
  const id = randomUUID()
  sql(`BEGIN; SET LOCAL task10.booking_write='authorized'; SET LOCAL task10.payment_write='authorized';
    SELECT set_config('booking_ux.create',${q(JSON.stringify({package:null,participants:[child]}))},true);
    ${course === 'kids_group' ? `SELECT set_config('task10.expected_policy',task10_booking_policy_quote_v1(${q(owner.id)},${q(courses[course])},make_date(${year},${monthNumber},1),'legacy',null)->>'fingerprint',true);` : ''}
    INSERT INTO bookings(id,user_id,learner_type,child_id,branch_id,course_type_id,month,year,total_sessions,total_price,status,created_at)
    VALUES(${q(id)},${q(owner.id)},${q(child ? 'child' : 'self')},${q(child)},${q(branch)},${q(courses[course])},${monthNumber},${year},1,700,${q(status)},clock_timestamp()-make_interval(mins=>${minutesAgo}));
    COMMIT;`)
  return id
}

function newRound(bill, child, branch, date, start, status = 'scheduled') {
  const id = randomUUID()
  const end = times.find(time => time[0] === start)[1]
  const template = templates.get(templateKey(branch,date,start))
  assert.ok(template)
  sql(`BEGIN; ${writeContext}
    INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status)
    VALUES(${q(id)},${q(bill)},task10_target_slot_v1(${q(courses.kids_group)},${q(template)},${q(branch)},${q(date)},${q(start)},${q(end)}),${q(date)},${q(start)},${q(end)},${q(branch)},${q(child)},${q(status)});
    COMMIT;`)
  return id
}

const module = {exports:{}}
const source = ts.transpileModule(readFileSync('src/lib/booking-checkout-server.ts', 'utf8'), {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText
Function('module','exports','require',source)(module,module.exports,name => name === '@/lib/auth/admin' ? {getServiceRoleClient:()=>db} : {})
const { loadPreviousBookings } = module.exports
const readBranches = async (owner, course = 'kids_group') => (await loadPreviousBookings(owner.id)).find(item=>item.course===course).branchIds

const browser = await chromium.launch({headless:true})
async function open(owner) {
  const context = await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Bangkok',locale:'th-TH'})
  const cookies = new Map()
  const auth = createServerClient(env.apiUrl,env.publishableKey,{cookies:{
    getAll:()=>[...cookies.values()],
    setAll:values=>values.forEach(({name,value})=>cookies.set(name,{name,value})),
  }})
  assert.ifError((await auth.auth.signInWithPassword({email:owner.email,password})).error)
  await context.addCookies([...cookies.values()].map(cookie=>({...cookie,url:base})))
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    return [base,env.apiUrl].includes(url.origin) || ['data:','blob:'].includes(url.protocol) ? route.continue() : route.abort()
  })
  const page = await context.newPage()
  page.setDefaultTimeout(20000)
  return {context,page}
}

async function checkBooking(context, name, checkDraft = false) {
  const page = await context.newPage()
  try {
    await page.goto(base+'/dashboard/booking',{waitUntil:'networkidle'})
    const course = page.getByRole('button').filter({has:page.getByRole('heading',{name:'เด็ก (กลุ่ม)',exact:true})})
    await expect(course).toBeEnabled()
    await course.click()
    await page.getByTestId('booking-next').click()
    const branch = page.getByRole('button',{name:'เปลี่ยนสาขา',exact:true})
    await expect(branch).toContainText(name ?? 'เลือกสาขา')
    if (name) await expect(branch).toContainText('1 สาขา')
    else await expect(branch).toHaveAttribute('aria-invalid','true')
    await expect(branch).not.toContainText('345')
    if (checkDraft) {
      await branch.click()
      const picker = page.getByRole('dialog')
      await picker.getByRole('checkbox',{name:'345',exact:true}).check()
      await picker.getByRole('button',{name:/ใช้สาขาที่เลือก/}).click()
      await expect(branch).toContainText('345')
      await expect.poll(() => page.evaluate(id => Object.keys(sessionStorage)
        .some(key => key.startsWith('nabs:booking-draft:') && sessionStorage.getItem(key).includes(id)),cross)).toBe(true)
      await page.reload({waitUntil:'networkidle'})
      await expect(branch).toContainText('345')
      evidence('draft',{explicitBranchRetained:true})
    }
  } finally {
    await page.close()
  }
}

async function selectDate(page, date) {
  await page.getByRole('button',{name:String(Number(date.slice(-2))),exact:true}).click()
}
async function openReschedule(page) {
  await page.goto(base+'/dashboard/reschedule',{waitUntil:'networkidle'})
  const dialog = page.getByRole('dialog')
  await expect(async () => {
    if (!await dialog.isVisible()) await page.getByRole('button',{name:'เปลี่ยน',exact:true}).click()
    await expect(dialog).toBeVisible({timeout:1250})
  }).toPass({timeout:10000})
}
const alert = page => page.getByRole('alertdialog')
const group = (page,name) => page.getByRole('group',{name,exact:true})
const option = (page,name,start) => group(page,name).getByRole('button',{name:new RegExp('^'+start+'-')})
const submit = page => page.getByRole('button',{name:'ยืนยันการเปลี่ยน',exact:true})
const exactRound = id => read(`select to_jsonb(s) from booking_sessions s where id=${q(id)}`)
const billValue = id => read(`select to_jsonb(b) from bookings b where id=${q(id)}`)

try {
  const admin = await actor('super_admin')
  sql(`INSERT INTO branch_date_closures(branch_id,closure_date,reason,created_by,updated_by)
    VALUES(${q(rama)},${q(day(19))},'Isolated QA',${q(admin.id)},${q(admin.id)});`)
  for (const [label,home,homeName,originalStart,start,destination] of [
    ['Sky',rama,'พระราม 2','15:00','09:00',day(12)],
    ['Euro',ramintra,'รามอินทรา','13:00','17:00',day(13)],
    ['Ben',rama,'พระราม 2','09:00','09:00',day(14)],
  ]) {
    const owner = await actor()
    const child = randomUUID()
    sql(`INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(child)},${q(owner.id)},${q('Local '+label)},${q(label)});`)
    const old = newBill(owner,{branch:home,child,minutesAgo:4})
    const billId = newBill(owner,{branch:home,child,minutesAgo:2})
    const sourceId = newRound(billId,child,home,day(8),originalStart)
    newBill(owner,{branch:cross,child,status:'pending_payment'})
    const initial = billValue(billId)
    assert.deepEqual(await readBranches(owner),[home])
    const {context,page} = await open(owner)
    try {
      const posts = []
      page.on('request', request => {
        if(request.method()==='POST' && new URL(request.url()).pathname==='/api/reschedule') posts.push(request.postDataJSON())
      })
      await openReschedule(page)
      await selectDate(page,destination)
      const order = await page.getByRole('dialog').getByRole('group').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('aria-label')))
      assert.equal(order[0],homeName)
      assert.ok(order.indexOf('345')>0)
      await expect(group(page,homeName)).toContainText('สาขาเดิม')
      if(label==='Sky'){
        await selectDate(page,day(19))
        await expect(page.getByText(/สาขาเดิมไม่มีรอบในวันนี้/)).toBeVisible()
        await option(page,'345',start).click()
        await submit(page).click()
        await expect(alert(page)).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(alert(page)).toHaveCount(0)
        await selectDate(page,destination)
      }
      await selectDate(page,day(17))
      await option(page,'345',start).click()
      await submit(page).click()
      await expect(alert(page)).toContainText('ย้ายจาก '+homeName+' ไป 345')
      await expect(alert(page)).toContainText(start)
      const box = await alert(page).boundingBox()
      assert.ok(box.x >= 0 && box.x + box.width <= 390)
      await alert(page).getByRole('button',{name:'กลับไปเลือก'}).click()
      await expect(alert(page)).toHaveCount(0)
      assert.deepEqual(posts,[])
      await selectDate(page,destination)
      await option(page,'345',start).click()
      await submit(page).click()
      const resultPromise = page.waitForResponse(response=>response.url()===base+'/api/reschedule' && response.request().method()==='POST')
      await alert(page).getByRole('button',{name:'ยืนยันเปลี่ยนสาขา'}).dblclick({delay:25})
      const response = await resultPromise
      const result = await response.json()
      assert.equal(response.status(),200,JSON.stringify(result))
      assert.equal(posts.length,1)
      assert.equal(posts[0].branchId,cross)
      assert.equal(posts[0].targetDate,destination)
      const moved = exactRound(result.sessionId)
      assert.equal(moved.rescheduled_from_id,sourceId)
      assert.equal(moved.child_id,child)
      assert.equal(moved.bill_id ?? moved.booking_id,billId)
      assert.equal(moved.branch_id,cross)
      assert.equal(moved.date,destination)
      assert.equal(moved.start_time.slice(0,5),start)
      assert.equal(exactRound(sourceId).status,'rescheduled')
      assert.deepEqual(billValue(billId),initial)
      assert.deepEqual(await readBranches(owner),[home])
      await checkBooking(context,homeName,label==='Sky')
      const end = times.find(time=>time[0]===start)[1]
      const restored = await db.rpc('lesson_source_transition_v1',{
        p_actor_id:admin.id,p_operation:'admin_reschedule',p_id:result.sessionId,
        p_payload:{reason:'Isolated QA',requestId:randomUUID(),targetDate:destination,startTime:start,endTime:end,
          branchId:home,templateId:templates.get(templateKey(home,destination,start))},
      })
      assert.ifError(restored.error)
      assert.equal(exactRound(restored.data.sessionId).branch_id,home)
      assert.equal(exactRound(restored.data.sessionId).rescheduled_from_id,result.sessionId)
      assert.deepEqual(await readBranches(owner),[home])
      await checkBooking(context,homeName)
      assert.equal(sql(`select count(*) from booking_sessions where booking_id=${q(billId)} and status='scheduled'`),'1')
      assert.equal(sql(`select count(*) from booking_sessions where booking_id=${q(old)}`),'0')
      if (label === 'Ben') {
        await openReschedule(page)
        await selectDate(page,day(20))
        await option(page,homeName,start).click()
        const sameBranchResult = page.waitForResponse(value=>value.url()===base+'/api/reschedule' && value.request().method()==='POST')
        await submit(page).click()
        await expect(alert(page)).toHaveCount(0)
        const sameBranchResponse = await sameBranchResult
        const sameBranch = await sameBranchResponse.json()
        assert.equal(sameBranchResponse.status(),200,JSON.stringify(sameBranch))
        assert.equal(exactRound(sameBranch.sessionId).branch_id,home)
        assert.deepEqual(billValue(billId),initial)
        evidence('same-branch',{oneClick:true,branch:homeName,billUnchanged:true})
      }
      evidence(label,{first:homeName,cancelPosts:0,submitPosts:1,lineage:true,prefillIn345:[homeName],prefillAfterReturn:[homeName],billUnchanged:true})
    } catch (error) {
      await page.screenshot({path:resolve(root,'acceptance',label+'-failure-'+unique+'.png')}).catch(()=>{})
      throw error
    } finally { await context.close() }
  }

  const owner = await actor()
  const child = randomUUID()
  sql(`INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(child)},${q(owner.id)},'Local Branch','QA');`)
  const multi = newBill(owner,{branch:rama,child})
  newRound(multi,child,ramintra,day(10),'09:00')
  assert.deepEqual(new Set(await readBranches(owner)),new Set([rama,ramintra]))
  const redeemed = newRound(multi,child,cross,day(11),'09:00')
  sql(`INSERT INTO booking_package_units(booking_id,ordinal,participants,expires_at,status,session_ids,redeemed_at)
    VALUES(${q(multi)},1,${q(JSON.stringify([child]))}::jsonb,now()+interval '60 days','redeemed',ARRAY[${q(redeemed)}]::uuid[],now());`)
  assert.deepEqual(new Set(await readBranches(owner)),new Set([rama,ramintra]))
  newBill(owner,{course:'adult_group',branch:cross})
  assert.deepEqual(await readBranches(owner,'adult_group'),[cross])
  const batchOwner = await actor()
  const earlier = newBill(batchOwner,{branch:rama,course:'adult_group'})
  const latest = newBill(batchOwner,{branch:ramintra,course:'adult_group'})
  const scope = randomUUID(), batch = randomUUID()
  sql(`BEGIN; SET LOCAL task10.payment_write='authorized';
    INSERT INTO booking_pricing_scopes(id,user_id,course_type_id,lesson_year,lesson_month)
    VALUES(${q(scope)},${q(batchOwner.id)},${q(courses.adult_group)},${year},${monthNumber});
    INSERT INTO progressive_payment_batches(id,pricing_scope_id,user_id,status,currency,total_amount,member_count,
      member_set_fingerprint,pricing_scope_revision,prepare_idempotency_key,prepare_request_fingerprint,approved_at,approved_by)
    VALUES(${q(batch)},${q(scope)},${q(batchOwner.id)},'approved','THB',1400,2,repeat('a',64),1,gen_random_uuid(),repeat('b',64),now(),${q(admin.id)});
    INSERT INTO progressive_payment_batch_bookings(payment_batch_id,booking_id,sequence_snapshot,amount_snapshot,member_fingerprint)
    VALUES(${q(batch)},${q(earlier)},1,700,repeat('c',64)),(${q(batch)},${q(latest)},2,700,repeat('d',64));
    COMMIT;`)
  assert.deepEqual(new Set(await readBranches(batchOwner,'adult_group')),new Set([rama,ramintra]))
  const closedOwner = await actor()
  newBill(closedOwner,{course:'adult_group',branch:inactive})
  assert.deepEqual(await readBranches(closedOwner,'adult_group'),[inactive])
  const closedChild = randomUUID()
  sql(`INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(closedChild)},${q(closedOwner.id)},'Local Closed','QA');`)
  newBill(closedOwner,{child:closedChild,branch:inactive})
  const closed = await open(closedOwner)
  try {
    await checkBooking(closed.context,null)
  } finally {
    await closed.context.close()
  }
  evidence('purchase-provenance',{originalMultiBranch:true,approvedBatch:true,redeemedRootExcluded:true,courseSeparated:true,packWithoutRounds:true,inactiveBranchNeedsChoice:true})
} finally {
  await browser.close()
  writeFileSync(resolve(root,'acceptance','local-'+unique+'.json'),JSON.stringify({runId:run.runId,testSha256,sourceManifest:copied,checks},null,2),{flag:'wx'})
}

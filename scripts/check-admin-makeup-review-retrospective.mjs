import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {expect} from '@playwright/test'
import {run,sql,q,fixtures} from '../tests/admin-makeup-review/runtime.mjs'
import {adminBrowser,fixture as f} from '../tests/admin-makeup-review/browser.mjs'
const base=process.env.ADMIN_MAKEUP_REVIEW_BASE||'http://127.0.0.1:3145',root=path.join(run.outputDir,'retrospective-'+Date.now());fs.mkdirSync(root)
assert.ok(['http://127.0.0.1:3145','http://127.0.0.1:3146'].includes(base),'Owned Local app ports only')
const {browser,context,page}=await adminBrowser(base),checks=[],errors=[],scenarios=[]
const check=(v,n)=>{assert.ok(v,n);checks.push(n);fs.writeFileSync(path.join(root,'progress.json'),JSON.stringify(checks,null,2))};page.on('pageerror',e=>errors.push(e.message))
const card=id=>page.getByTestId('makeup-review-group').filter({has:page.getByTestId('review-session-'+id)})
const dialog=()=>page.getByRole('dialog')
async function open(r){await page.goto(base+`/admin/makeup?month=${f.month}&session=${r.ids[0]}`,{waitUntil:'networkidle'});await expect(card(r.ids[0])).toBeVisible({timeout:30000});return card(r.ids[0])}
async function scenario(label,assigned=true,n=2){
 const name='ทดสอบ UI '+label+' '+randomUUID().slice(0,5),r=fixtures.fixture('kids_group',false,f.parent,f.past,'15:00','16:00'),group=randomUUID(),coach=await fixtures.account('coach',name+' โค้ช')
 const ids=[r.ids[0],...Array.from({length:n-1},randomUUID)],children=[r.children[0],...Array.from({length:n-1},randomUUID)]
 sql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);UPDATE branches SET name=${q(name)} WHERE id=${q(r.branch)};
 ${ids.map((id,i)=>`${i?`INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(children[i])},${q(f.parent.id)},${q(name+' คน '+(i+1))},${q(name+' คน '+(i+1))});INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup) VALUES(${q(id)},${q(r.booking)},${q(r.slot)},${q(r.date)},${q(r.start)},${q(r.end)},${q(r.branch)},${q(children[i])},'scheduled',false);`:`UPDATE children SET full_name=${q(name+' คน 1')},nickname=${q(name+' คน 1')} WHERE id=${q(children[i])};`}`).join('\n')}
 ${assigned?`INSERT INTO coach_assignment_groups(id,schedule_slot_id,coach_id,name,created_by) VALUES(${q(group)},${q(r.slot)},${q(coach.id)},${q(name)},${q(f.sa.id)});${ids.map((id,i)=>`INSERT INTO coach_assignment_group_students(group_id,booking_session_id,student_id,student_type) VALUES(${q(group)},${q(id)},${q(children[i])},'child');`).join('\n')}`:''}COMMIT;`)
 const result={...r,name,group:assigned?group:null,coach,coachName:sql(`SELECT full_name FROM profiles WHERE id=${q(coach.id)}`),ids,children};scenarios.push(result);return result
}
async function select(combo,text){await combo.click();await page.getByRole('option',{name:text,exact:true}).click()}
try{
 const attendance=await scenario('เช็คชื่อ');let c=await open(attendance)
 await c.getByRole('button',{name:'บันทึกย้อนหลังทั้งรอบ',exact:true}).click();await expect(dialog()).toBeVisible()
 check(await dialog().getByRole('combobox').count()===2,'Retrospective attendance opens the full two-learner roster')
 check((await dialog().getByRole('combobox').allTextContents()).every(t=>t.includes('เลือกสถานะ')),'Retrospective attendance never guesses present or absent')
 check(await dialog().getByRole('button',{name:'บันทึก attendance ทั้งรอบ',exact:true}).isDisabled(),'Missing statuses and reason block attendance save')
 await select(dialog().getByRole('combobox').nth(0),'มาเรียน');await select(dialog().getByRole('combobox').nth(1),'ขาดเรียน');await dialog().locator('textarea').fill('ตรวจสอบหลักฐานเฉพาะฐาน Local ของงานนี้')
 await dialog().getByRole('button',{name:'บันทึก attendance ทั้งรอบ',exact:true}).click();await expect(dialog()).toHaveCount(0,{timeout:30000});c=card(attendance.ids[0]);await expect(c.getByRole('button',{name:/^ขอหลักฐานโค้ชรอบนี้/})).toBeEnabled({timeout:30000})
 const rows=JSON.parse(sql(`SELECT jsonb_agg(jsonb_build_object('session',booking_session_id,'student',student_id,'status',status) ORDER BY booking_session_id) FROM attendance WHERE booking_session_id=ANY(ARRAY[${attendance.ids.map(q).join(',')}]::uuid[])`))
 check(rows.length===2&&rows.every(r=>attendance.children[attendance.ids.indexOf(r.session)]===r.student)&&rows.some(r=>r.status==='present')&&rows.some(r=>r.status==='absent'),'Real form writes the exact learner attendance identities and chosen statuses')
 check(await c.getByRole('button',{name:'บันทึกย้อนหลังทั้งรอบ',exact:true}).isDisabled(),'Recorded attendance still leaves the evidence workflow, without permitting overwrite')
 const replacement=await scenario('เปลี่ยนโค้ช'),replacementCoach=await fixtures.account('coach','โค้ชรับแทน '+randomUUID().slice(0,6)),replacementName=sql(`SELECT full_name FROM profiles WHERE id=${q(replacementCoach.id)}`)
 c=await open(replacement);await c.getByRole('button',{name:'เปลี่ยนโค้ชย้อนหลัง',exact:true}).click();await expect(dialog()).toBeVisible();check(await dialog().getByRole('button',{name:'เปลี่ยนโค้ชและขอหลักฐาน',exact:true}).isDisabled(),'Coach replacement retains coach/reason validation')
 await dialog().getByRole('combobox').click();await page.getByRole('option').filter({hasText:replacementName}).click();await dialog().locator('textarea').fill('โค้ชรับแทนสอนจริงในข้อมูล Local ทดสอบ')
 await dialog().getByRole('button',{name:'เปลี่ยนโค้ชและขอหลักฐาน',exact:true}).click();await expect(dialog()).toHaveCount(0,{timeout:30000});await expect(card(replacement.ids[0])).toContainText(replacementName,{timeout:30000})
 check(sql(`SELECT coach_id FROM coach_assignment_groups WHERE id=${q(replacement.group)}`)===replacementCoach.id,'Actual coach replacement reconciles the new group from the authoritative response')
 await expect(card(replacement.ids[0]).getByRole('button',{name:'เปลี่ยนโค้ชย้อนหลัง',exact:true})).toBeEnabled({timeout:30000});checks.push('Replacement group unlocks only after scoped fresh reconciliation')
 const destination=await scenario('กลุ่มปลายทาง'),orphan=await scenario('ผู้เรียนตกหล่น',false,1)
 sql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);UPDATE bookings SET branch_id=${q(destination.branch)},course_type_id=${q(destination.course)} WHERE id=${q(orphan.booking)};UPDATE booking_sessions SET branch_id=${q(destination.branch)},schedule_slot_id=${q(destination.slot)} WHERE id=${q(orphan.ids[0])};COMMIT;`)
 c=await open(orphan);check(await c.getByRole('button',{name:'ย้ายเข้ากลุ่มโค้ชในรอบเดียวกัน',exact:true}).isVisible(),'Unassigned member sees the existing same-slot destination action')
 await c.getByRole('button',{name:'ย้ายเข้ากลุ่มโค้ชในรอบเดียวกัน',exact:true}).click();await expect(dialog()).toBeVisible();check(await dialog().getByRole('combobox').count()===2,'Move form keeps exact learner and target group selectors')
 await dialog().getByRole('combobox').nth(1).click();await page.getByRole('option').filter({hasText:destination.coachName}).click();await dialog().locator('textarea').fill('ตรวจย้ายเฉพาะสมาชิกทดสอบเข้ากลุ่มเดิม')
 await dialog().getByRole('button',{name:'ย้ายผู้เรียนเข้ากลุ่ม',exact:true}).click();await expect(dialog()).toHaveCount(0,{timeout:30000});await expect(card(orphan.ids[0])).toContainText(destination.coachName,{timeout:30000});await expect(card(orphan.ids[0]).locator('[data-testid^="review-session-"]')).toHaveCount(3)
 check(sql(`SELECT group_id FROM coach_assignment_group_students WHERE booking_session_id=${q(orphan.ids[0])}`)===destination.group,'Moved learner joins the complete three-person target group without a stale orphan card')
 const assign=await scenario('มอบหมายใหม่',false);c=await open(assign);await c.getByRole('button',{name:'มอบหมายโค้ชใหม่',exact:true}).click();await expect(dialog()).toBeVisible()
 check((await dialog().getByRole('combobox').first().innerText()).includes('มอบหมายโค้ช'),'Unassigned round opens the existing assign-only mode')
 await dialog().getByRole('button',{name:'ยกเลิก',exact:true}).click();await expect(dialog()).toHaveCount(0);checks.push('Unassigned form can cancel without changing its round')
 await c.getByRole('button',{name:'มอบหมายโค้ชใหม่',exact:true}).click();await dialog().getByRole('combobox').nth(1).click();await page.getByRole('option').filter({hasText:assign.coachName}).click();await dialog().locator('textarea').fill('มอบหมายโค้ชจริงเฉพาะข้อมูล Local โดยไม่เช็คชื่อ')
 await dialog().getByRole('button',{name:'มอบหมายโค้ชให้รอบนี้',exact:true}).click();await expect(dialog()).toHaveCount(0,{timeout:30000});c=card(assign.ids[0]);await expect(c).toContainText(assign.coachName,{timeout:30000});await expect(c.getByRole('button',{name:/^ส่งให้โค้ชตรวจสอบรอบนี้/})).toBeEnabled({timeout:30000})
 check(await c.locator('[data-testid^="review-session-"]').count()===2&&sql(`SELECT count(*) FROM attendance WHERE booking_session_id=ANY(ARRAY[${assign.ids.map(q).join(',')}]::uuid[])`)==='0','Assign-only reconciles the complete new group and preserves missing attendance')
 // Three-person close: one commit, an injected unknown second response, then
 // readback and continuation of only the remaining members.
 const closing=await scenario('ปิดเคสบางส่วน',true,3);c=await open(closing);let stop=true;let closePosts=0
 await context.route('**/api/admin/makeup/review-close',async route=>{const body=route.request().postDataJSON();if(!body.readOnly){closePosts++;if(closePosts===2&&stop)return route.fulfill({status:503,json:{error:'จำลองยังยืนยันผลปิดเคสไม่ได้',definitive:false}})}return route.continue()})
 await c.getByRole('button',{name:'ปิดเคสทั้งรอบ',exact:true}).click();await expect(dialog().getByRole('heading',{name:'ยืนยันปิดเคสทั้งรอบ'})).toBeVisible();check(await dialog().getByText(/ไม่ลบรอบเรียน/).count()>0,'Close confirmation retains its protected impact explanation')
 await dialog().getByRole('button',{name:'ยืนยันปิดเคส 3 คน',exact:true}).click();await expect(dialog().getByRole('heading',{name:'ยังยืนยันผลปิดเคสไม่ครบ'})).toBeVisible({timeout:30000})
 check(sql(`SELECT count(*) FROM activity_logs WHERE action='attendance_gap_closed_no_action' AND entity_id=ANY(ARRAY[${closing.ids.map(q).join(',')}]::uuid[])`)==='1','Only the confirmed first member is removed after a partial close')
 stop=false;await dialog().getByRole('button',{name:'ตรวจสอบผลเดิม',exact:true}).click();await expect(dialog().getByRole('heading',{name:'ปิดเคสสำเร็จบางส่วน'})).toBeVisible({timeout:30000});await dialog().getByRole('button',{name:'ดำเนินการต่อเฉพาะที่ยังไม่ปิด (2)',exact:true}).click();await dialog().getByRole('button',{name:'ยืนยันปิดเคส 2 คน',exact:true}).click();await expect(dialog().getByRole('heading',{name:'ปิดเคสสำเร็จครบทั้งรอบ'})).toBeVisible({timeout:30000})
 await page.screenshot({path:path.join(root,'close-complete-real-app.png'),fullPage:false});await dialog().getByRole('button',{name:'ปิด',exact:true}).click()
 await expect(page.getByTestId('review-session-'+closing.ids[0])).toHaveCount(0,{timeout:30000});check(sql(`SELECT count(*) FROM activity_logs WHERE action='attendance_gap_closed_no_action' AND entity_id=ANY(ARRAY[${closing.ids.map(q).join(',')}]::uuid[])`)==='3','Close continuation creates exactly one closure audit per original learner');check(sql(`SELECT count(*) FROM booking_sessions WHERE id=ANY(ARRAY[${closing.ids.map(q).join(',')}]::uuid[])`)==='3','Closing preserves all three original booking session rows');await context.unroute('**/api/admin/makeup/review-close')
 check(errors.length===0,'No JavaScript errors across retrospective, membership and close-recovery flows')
 const output={runId:run.runId,root,checks,errors,scenarios};fs.writeFileSync(path.join(root,'result.json'),JSON.stringify(output,null,2));fs.writeFileSync(path.join(run.evidenceRoot,'retrospective-result.json'),JSON.stringify(output,null,2));console.log(JSON.stringify({passed:checks.length,root}))
}catch(error){fs.writeFileSync(path.join(root,'failure.json'),JSON.stringify({message:error.message,checks,errors,scenarios,dialog:await dialog().allTextContents()},null,2));await page.screenshot({path:path.join(root,'failure.png'),fullPage:false}).catch(()=>{});throw error}
finally{await browser.close()}

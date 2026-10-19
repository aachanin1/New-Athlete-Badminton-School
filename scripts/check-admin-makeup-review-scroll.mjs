import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {expect} from '@playwright/test'
import {run,sql,q,fixtures} from '../tests/admin-makeup-review/runtime.mjs'
import {adminBrowser,fixture as f} from '../tests/admin-makeup-review/browser.mjs'
const mode=process.argv[2]||'verify',base=process.env.ADMIN_MAKEUP_REVIEW_BASE||'http://127.0.0.1:3145',root=path.join(run.outputDir,'scroll-'+mode+'-'+Date.now());fs.mkdirSync(root)
assert.ok(['http://127.0.0.1:3145','http://127.0.0.1:3146'].includes(base),'Owned Local app ports only')
assert.ok(['probe','verify'].includes(mode))
const {browser,context,page}=await adminBrowser(base),checks=[],scenarios=[],errors=[];page.on('pageerror',e=>errors.push(e.message))
const label='ตรวจตำแหน่ง '+randomUUID().slice(0,6),n=5
async function scenario(i,assigned=true){
 const r=fixtures.fixture('kids_group',false,f.parent,f.past,'18:00','19:00'),group=randomUUID(),coach=await fixtures.account('coach',label+' โค้ช '+i)
 const ids=[r.ids[0],...Array.from({length:n-1},randomUUID)],children=[r.children[0],...Array.from({length:n-1},randomUUID)],name=label+' รอบ '+i
 sql(`BEGIN;SELECT set_config('lesson_source.write','authorized',true);SELECT set_config('task10.source_write','authorized',true);UPDATE branches SET name=${q(name)} WHERE id=${q(r.branch)};
 ${ids.map((id,k)=>k?`INSERT INTO children(id,parent_id,full_name,nickname) VALUES(${q(children[k])},${q(f.parent.id)},${q(name+' คน '+k)},${q(name+' คน '+k)});INSERT INTO booking_sessions(id,booking_id,schedule_slot_id,date,start_time,end_time,branch_id,child_id,status,is_makeup) VALUES(${q(id)},${q(r.booking)},${q(r.slot)},${q(r.date)},${q(r.start)},${q(r.end)},${q(r.branch)},${q(children[k])},'scheduled',false);`:`UPDATE children SET full_name=${q(name+' คน 0')},nickname=${q(name+' คน 0')} WHERE id=${q(children[k])};`).join('\n')}
 ${assigned?`INSERT INTO coach_assignment_groups(id,schedule_slot_id,coach_id,name,created_by) VALUES(${q(group)},${q(r.slot)},${q(coach.id)},${q(name)},${q(f.sa.id)});INSERT INTO coach_assignment_group_students(group_id,booking_session_id,student_id,student_type) VALUES${ids.map((id,k)=>`(${q(group)},${q(id)},${q(children[k])},'child')`).join(',')};`:''}COMMIT;`)
 const result={...r,group:assigned?group:null,coach,coachName:sql(`SELECT full_name FROM profiles WHERE id=${q(coach.id)}`),ids,children,name};scenarios.push(result);return result
}
const card=id=>page.getByTestId('makeup-review-group').filter({has:page.getByTestId('review-session-'+id)})
const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
const state=async()=>page.evaluate(()=>({scroll:document.scrollingElement.scrollTop,height:document.scrollingElement.scrollHeight,order:[...document.querySelectorAll('[data-review-anchor]')].map(el=>el.getAttribute('data-review-anchor')),active:{tag:document.activeElement?.tagName,text:document.activeElement?.textContent?.slice(0,120)}}))
async function openList(){await page.goto(base+'/admin/makeup?month='+f.month,{waitUntil:'networkidle'});await page.getByPlaceholder('ค้นหานักเรียน, ผู้ปกครอง, โค้ช, สาขา...').fill(label);await expect(page.getByTestId('makeup-review-group')).toHaveCount(6);assert.ok(!new URL(page.url()).searchParams.has('session'))}
async function position(c){await c.evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));await settle();return c.boundingBox()}
async function sampleStart(){await page.evaluate(()=>{window.__reviewGeometry=[];window.__reviewObserve=true;const tick=()=>{if(!window.__reviewObserve)return;window.__reviewGeometry.push({at:performance.now(),scroll:document.scrollingElement.scrollTop,order:[...document.querySelectorAll('[data-review-anchor]')].map(el=>el.getAttribute('data-review-anchor')),dialog:Boolean(document.querySelector('[role=dialog]')),focus:document.activeElement?.tagName});requestAnimationFrame(tick)};requestAnimationFrame(tick)})}
async function sampleStop(){return page.evaluate(()=>{window.__reviewObserve=false;return window.__reviewGeometry})}
async function replacement(target,coachName,filename){
 const c=card(target.ids[0]),before=await position(c),beforeState=await state();await page.screenshot({path:path.join(root,filename+'-before.png')});await sampleStart()
 await c.getByRole('button',{name:'เปลี่ยนโค้ชย้อนหลัง',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await dialog.getByRole('combobox').click();await page.getByRole('option').filter({hasText:coachName}).click();await dialog.locator('textarea').fill('ทดสอบตำแหน่งหลังเปลี่ยนผู้รับผิดชอบในฐาน Local')
 await dialog.getByRole('button',{name:'เปลี่ยนโค้ชและขอหลักฐาน',exact:true}).click();await expect(dialog).toHaveCount(0,{timeout:30000});await expect(c).toContainText(coachName,{timeout:30000});await expect(c.getByRole('button',{name:'เปลี่ยนโค้ชย้อนหลัง',exact:true})).toBeEnabled({timeout:30000});await settle()
 const after=await c.boundingBox(),afterState=await state(),geometry=await sampleStop(),output={before,after,beforeState,afterState,delta:after.y-before.y,scrollDelta:afterState.scroll-beforeState.scroll,geometry}
 fs.writeFileSync(path.join(root,filename+'.json'),JSON.stringify(output,null,2));await page.screenshot({path:path.join(root,filename+'-after.png')});return output
}
try{
 for(let i=0;i<6;i++)await scenario(i,i!==5)
 const replacementCoach=await fixtures.account('coach',label+' ผู้รับแทน'),replacementName=sql(`SELECT full_name FROM profiles WHERE id=${q(replacementCoach.id)}`)
 const coach2=await fixtures.account('coach',label+' ผู้รับแทนจอแคบ'),name2=sql(`SELECT full_name FROM profiles WHERE id=${q(coach2.id)}`)
 const mobileCoach=await fixtures.account('coach',label+' ผู้รับแทนมือถือ'),mobileName=sql(`SELECT full_name FROM profiles WHERE id=${q(mobileCoach.id)}`)
 await openList();let order=await page.getByTestId('makeup-review-group').evaluateAll(elements=>elements.map(el=>el.getAttribute('data-review-anchor')))
 const firstAssigned=order.map(id=>scenarios.find(r=>r.ids.includes(id))).find(r=>r.group),result=await replacement(firstAssigned,replacementName,'replace-desktop')
 if(mode==='probe'){
  assert.ok(Math.abs(result.delta)>50||Math.abs(result.scrollDelta)>50,'Reported replacement scroll jump must reproduce on the normal list');checks.push('Existing candidate reproduces the scroll jump without a deep-link target')
 }else{
  assert.ok(Math.abs(result.delta)<3,'Replacement must preserve the original card viewport anchor');assert.deepEqual(result.afterState.order,result.beforeState.order,'Replacement must preserve normal-list round order');for(const frame of result.geometry)assert.deepEqual(frame.order,result.beforeState.order,'No intermediate render may move the round to the bottom');checks.push('Normal-list replacement keeps viewport and round order on every sampled frame')
  const c=card(firstAssigned.ids[0]),before=await position(c);await c.getByRole('button',{name:'เปลี่ยนโค้ชย้อนหลัง',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'ยกเลิก',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await settle();assert.ok(Math.abs((await c.boundingBox()).y-before.y)<3);checks.push('Cancelling replacement keeps the original round position')
  await page.setViewportSize({width:1124,height:903});const another=scenarios.find(r=>r.group&&r!==firstAssigned),narrow=await replacement(another,name2,'replace-narrow');assert.ok(Math.abs(narrow.delta)<3);assert.deepEqual(narrow.afterState.order,narrow.beforeState.order);checks.push('Replacement at the browser width shown in the clip keeps viewport and order')
  await page.setViewportSize({width:390,height:1000});const mobileTarget=scenarios.find(r=>r.group&&r!==firstAssigned&&r!==another),mobile=await replacement(mobileTarget,mobileName,'replace-mobile');assert.ok(Math.abs(mobile.delta)<3);assert.deepEqual(mobile.afterState.order,mobile.beforeState.order);checks.push('Mobile replacement preserves the round anchor and order')
  await page.setViewportSize({width:1124,height:903})
  const unassigned=scenarios[5],unassignedCard=card(unassigned.ids[0]),beforeAssign=await position(unassignedCard),orderBeforeAssign=(await state()).order
  await page.screenshot({path:path.join(root,'assign-before.png')});await unassignedCard.getByRole('button',{name:'มอบหมายโค้ชใหม่',exact:true}).click();const d=page.getByRole('dialog');await d.getByRole('combobox').nth(1).click();await page.getByRole('option').filter({hasText:unassigned.coachName}).click();await d.locator('textarea').fill('ทดสอบการเปลี่ยนกลุ่มจากไม่มีโค้ชโดยคงตำแหน่ง');const beforeAssignConfirm=await unassignedCard.boundingBox();await d.getByRole('button',{name:'มอบหมายโค้ชให้รอบนี้',exact:true}).click();await expect(d).toHaveCount(0,{timeout:30000});await expect(unassignedCard).toContainText(unassigned.coachName,{timeout:30000});await settle();const afterAssign=await unassignedCard.boundingBox();fs.writeFileSync(path.join(root,'assign.json'),JSON.stringify({before:beforeAssign,beforeConfirm:beforeAssignConfirm,after:afterAssign,delta:afterAssign.y-beforeAssign.y},null,2));await page.screenshot({path:path.join(root,'assign-after.png')});assert.ok(Math.abs(afterAssign.y-beforeAssign.y)<3);assert.deepEqual((await state()).order,orderBeforeAssign);checks.push('Assign-only also keeps viewport and order across its changing group key')
  assert.equal(sql(`SELECT count(*) FROM attendance WHERE booking_session_id=ANY(ARRAY[${scenarios.flatMap(r=>r.ids).map(q).join(',')}]::uuid[])`),'0');checks.push('Coach changes and assign-only leave all thirty attendance records unrecorded')
  const sendCard=card(firstAssigned.ids[0]),beforeSend=await position(sendCard),sendOrder=(await state()).order;await sendCard.getByRole('button',{name:/^ส่งให้โค้ชตรวจสอบรอบนี้/}).click();await expect(sendCard.getByTestId('review-round-result')).toContainText('สำเร็จ',{timeout:30000});await expect(sendCard.getByRole('button',{name:/^ส่งให้โค้ชตรวจสอบรอบนี้/})).toBeEnabled({timeout:30000});await settle();assert.ok(Math.abs((await sendCard.boundingBox()).y-beforeSend.y)<3);assert.deepEqual((await state()).order,sendOrder);checks.push('Sending a replaced round still preserves the normal-list position and every other round')
 }
 assert.equal(errors.length,0);checks.push('No JavaScript exceptions in normal-list coach workflows')
 const output={mode,root,runId:run.runId,label,checks,scenarios,errors,build:JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'app-runtime.json'))).app};fs.writeFileSync(path.join(root,'result.json'),JSON.stringify(output,null,2));fs.writeFileSync(path.join(run.evidenceRoot,'scroll-'+mode+'-result.json'),JSON.stringify(output,null,2));console.log(JSON.stringify({passed:checks.length,root,delta:result.delta,scrollDelta:result.scrollDelta}))
}catch(error){fs.writeFileSync(path.join(root,'failure.json'),JSON.stringify({message:error.message,checks,scenarios,errors,dialog:await page.getByRole('dialog').allTextContents()},null,2));await page.screenshot({path:path.join(root,'failure.png')}).catch(()=>{});throw error}finally{await context.close();await browser.close()}

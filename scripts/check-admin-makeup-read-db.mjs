import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {run,sql,q} from '../tests/branch-closure/isolated-runtime.mjs'
import {account,fixture} from '../tests/branch-closure/fixtures.mjs'
const dir=path.join(run.evidenceRoot,'refinement'),f=JSON.parse(fs.readFileSync(path.join(dir,'fixture.json'))),checks=[]
const check=(v,n)=>{assert.ok(v,n);checks.push(n)}
const query=(mode,search='ค้นเร็ว',page=1,user=null,child=null)=>JSON.parse(sql(`SELECT admin_makeup_lookup_v1(${q(f.sa.id)},${q(f.f.date.slice(0,7)+'-01')},'kids_group',${q(search)},NULL,${page},${q(mode)},${q(user)},${q(child)},NULL);`))
const one=query('learners'),two=query('learners','ค้นเร็ว',2)
check(one.items.length===10&&one.total===600,'Search is server limited to ten exact learner identities')
check(one.items.every(a=>!two.items.some(b=>b.learner_key===a.learner_key)),'Second lookup page has no duplicate identities')
const person=one.items[0],rounds=query('sessions','',1,person.user_id,person.child_id)
check(rounds.items.length===1&&rounds.items[0].child_id===person.child_id,'Session lookup selects only requested child under requested parent')
const family=query('families','ครอบครัวปริมาณ')
check(family.total===30&&family.items.length===10,'Families paged before state calculation')
assert.throws(()=>query('learners',''),/LESSON_SOURCE_INVALID_REQUEST/);checks.push('Empty broad lookup rejected in database')
assert.throws(()=>JSON.parse(sql(`SELECT admin_makeup_lookup_v1(${q(f.parent.id)},${q(f.f.date.slice(0,7)+'-01')},'kids_group','ค้นเร็ว');`)),/UNAUTHORIZED/);checks.push('Real parent denied even with forged API role fields')
const summary=JSON.parse(sql(`SELECT admin_branch_closure_overview_v1(${q(f.sa.id)},${q(f.f.date.slice(0,7)+'-01')},NULL);`));check(Array.isArray(summary),'Closure overview returns aggregate only')
const hashes=JSON.parse(sql("SELECT jsonb_object_agg(proname||'('||pg_get_function_identity_arguments(oid)||')',md5(pg_get_functiondef(oid))) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f';")),before=JSON.parse(fs.readFileSync(path.join(dir,'baseline-benchmark.json'))).functions
check(Object.entries(before).every(([k,v])=>hashes[k]===v),'Every baseline public function body unchanged')
check(Object.keys(hashes).length===Object.keys(before).length+2,'Exactly two additive read helpers')
const grant=JSON.parse(sql("SELECT jsonb_object_agg(r,has_function_privilege(r,'public.admin_makeup_lookup_v1(uuid,date,text,text,uuid,integer,text,uuid,uuid,uuid)','EXECUTE')) FROM unnest(ARRAY['anon','authenticated','service_role'])r;"))
check(!grant.anon&&!grant.authenticated&&grant.service_role,'Read helper is service-only')
const namelessParent=await account('user','ทดสอบชื่อว่าง '+Date.now()),nameless=fixture('kids_group',false,namelessParent,f.future)
sql(`UPDATE children SET full_name=' ',nickname=' ' WHERE id=${q(nameless.children[0])}`)
const missing=query('sessions','',1,namelessParent.id,nameless.children[0])
check(missing.items[0].learner_name==='ไม่ระบุชื่อผู้เรียน','Known child without names never displays the parent as the learner')
const named=query('learners','ทดสอบชื่อว่าง')
check(named.items.some(x=>x.child_id===nameless.children[0]&&x.learner_name==='ไม่ระบุชื่อผู้เรียน'),'Parent search preserves the nameless child identity and placeholder')
const cohort=fixture('private',true,namelessParent,f.future)
sql(`UPDATE children SET full_name='ชื่อเดียวกัน',nickname='ชื่อเดียวกัน' WHERE id IN (${cohort.children.filter(Boolean).map(q).join(',')})`)
const privateResult=JSON.parse(sql(`SELECT admin_makeup_lookup_v1(${q(f.sa.id)},${q(f.f.date.slice(0,7)+'-01')},'private','',NULL,1,'sessions',${q(namelessParent.id)},NULL,${q(cohort.booking)});`))
check(privateResult.items.length===1&&privateResult.items[0].learner_name.endsWith(' · 3 คน')&&!privateResult.items[0].learner_name.includes('ชื่อเดียวกัน - ชื่อเดียวกัน'),'Private unit retains its three real identities even when two learners share a name')
fs.writeFileSync(path.join(dir,'read-db-probe-'+Date.now()+'.json'),JSON.stringify({checks,rows:{learners:one.total,families:family.total},beforeFunctions:Object.keys(before).length,afterFunctions:Object.keys(hashes).length},null,2),{flag:'wx'})
console.log(JSON.stringify({passed:checks.length}))

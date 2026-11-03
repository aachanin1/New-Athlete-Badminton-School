import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createServerClient} from '@supabase/ssr'
import {chromium} from '@playwright/test'
import {run,env,fixtures,sql,q} from '../tests/admin-makeup-2/runtime.mjs'
const root=path.join(run.outputDir,'http-performance-'+Date.now());fs.mkdirSync(root,{recursive:true})
const {sa}=JSON.parse(fs.readFileSync('.playwright/admin-makeup-2/accounts.private.json')),fixtureRoot=fs.readdirSync(run.outputDir).filter(n=>n.startsWith('browser-')&&fs.existsSync(path.join(run.outputDir,n,'result.json'))).sort().at(-1),{parent}=JSON.parse(fs.readFileSync(path.join(run.outputDir,fixtureRoot,'fixture.private.json'))),seed=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'performance-fixture.private.json'))),month=seed.date.slice(0,7)
async function login(a){const jar=new Map(),auth=createServerClient(env.apiUrl,env.publishableKey,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:items=>items.forEach(x=>jar.set(x.name,x.value))}});assert.ifError((await auth.auth.signInWithPassword({email:a.email,password:fixtures.password})).error);return jar}
const admin=await login(sa),user=await login(parent),bases={baseline:'http://127.0.0.1:3182',candidate:'http://127.0.0.1:'+Number(process.argv[2]||3181)},cookie=jar=>[...jar].map(([k,v])=>k+'='+v).join('; '),results=[],noiseBandMs=JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'baseline-performance.json'))).noiseBandMs
const stats=samples=>{const warm=samples.slice(1).map(x=>x.ms).sort((a,b)=>a-b);return{coldMs:samples[0].ms,medianMs:warm[15],p95Ms:warm[28],samples}}
try{
 const flows=[...[[10,'AM2 Perf Small'],[100,'AM2 Perf ']].flatMap(([size,search])=>[{id:'browse-'+size,size,search,kind:'browse'},{id:'review-'+size,size,search,kind:'review'}]),{id:'User-Wallet',kind:'wallet'},{id:'Finance-November',kind:'finance'}]
 for(const flow of flows){const samples={baseline:[],candidate:[]}
  for(let i=0;i<31;i++)for(const variant of i%2?['candidate','baseline']:['baseline','candidate']){
   const query=new URLSearchParams({month,course:'kids_group',search:flow.search||'',branch:'all',status:'all',page:'1'}),route=flow.kind==='browse'?'/api/admin/makeup/'+(variant==='baseline'?'browse':'workspace')+'?'+query:flow.kind==='review'?'/api/admin/makeup/queue?'+query:flow.kind==='wallet'?'/api/booking-wallet?inventory=2':'/admin/finance?year='+month.slice(0,4)+'&month='+Number(month.slice(5))
   const start=performance.now(),r=await fetch(bases[variant]+route,{headers:{Cookie:cookie(flow.kind==='wallet'?user:admin)},cache:'no-store'}),body=await r.text();assert.equal(r.status,200,body.slice(0,200));const ms=performance.now()-start
   if(flow.kind==='browse')assert.equal(JSON.parse(body).total,flow.size)
   samples[variant].push({ms,bytes:Buffer.byteLength(body)})
  }
  results.push({flow:flow.id,baseline:stats(samples.baseline),candidate:stats(samples.candidate)});fs.writeFileSync(path.join(root,'samples.json'),JSON.stringify(results,null,2));console.log('measured '+flow.id)
 }
 const family=JSON.parse(sql(`SELECT task10_family_makeup_state_v1(${q(sa.id)},${q(seed.people[0].id)},${q(seed.date)});`)),sourceChildIndex=family.children.findIndex(c=>c.id===seed.cases[0].children[0]);assert.ok(sourceChildIndex>=0);
 const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000},locale:'th-TH',timezoneId:'Asia/Bangkok'});await context.addCookies([...admin].map(([name,value])=>({name,value,domain:'127.0.0.1',path:'/',sameSite:'Lax'})))
 try{const samples={baseline:[],candidate:[]}
  for(const variant of ['baseline','candidate']){const page=await context.newPage();await page.goto(bases[variant]+'/admin/makeup?tab=makeup&month='+month,{waitUntil:'networkidle'});await page.getByRole('textbox',{name:'ค้นหาเพิ่มเติม'}).fill('AM2 Perf Small');await page.getByText('AM2 Perf Small 0 user',{exact:false}).first().waitFor();const card=page.locator('[data-testid^="'+(variant==='baseline'?'kids-family-':'makeup-card-')+'"]').filter({hasText:'AM2 Perf Small 0 user'}),open=card.getByRole('button',{name:'เลือกวันชดเชย',exact:true});await open.waitFor();const requests=[];page.on('request',r=>{if(r.url().includes('/api/admin/makeup/'))requests.push(r.url())})
   for(let i=0;i<31;i++){requests.length=0;const start=performance.now();await open.click();if(variant==='baseline'){await page.getByRole('combobox',{name:'เด็กที่มาเรียนจริง',exact:true}).click();await page.getByRole('option').nth(sourceChildIndex).click()}await page.getByRole('dialog').locator('[data-testid^="makeup-day-"]').first().waitFor();samples[variant].push({ms:performance.now()-start,requests:requests.map(u=>new URL(u).pathname)});await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden'})}await page.close()
  }results.push({flow:'open-dialog-until-calendar-ready',baseline:stats(samples.baseline),candidate:stats(samples.candidate)})
 }finally{await browser.close()}
 fs.writeFileSync(path.join(root,'samples.json'),JSON.stringify(results,null,2))
 for(const flow of results)for(const metric of ['medianMs','p95Ms'])assert.ok(flow.candidate[metric]<=flow.baseline[metric]+noiseBandMs,flow.flow+' '+metric+': '+flow.candidate[metric]+' > '+flow.baseline[metric]+' + '+noiseBandMs)
 const dialog=results.at(-1);assert.ok(Math.max(...dialog.candidate.samples.map(x=>x.requests.length))<=Math.max(...dialog.baseline.samples.map(x=>x.requests.length)),'dialog request count increased')
 fs.writeFileSync(path.join(root,'result.json'),JSON.stringify({passed:true,results,noiseBandMs,bases,runId:run.runId,definitionSha256:createHash('sha256').update(fs.readFileSync(import.meta.filename)).digest('hex')},null,2));console.log(JSON.stringify({root,passed:true}))
}catch(e){fs.writeFileSync(path.join(root,'failure.json'),JSON.stringify({error:e.stack},null,2));console.error(root);throw e}

const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({browser,baseURL,fixture,session,run,kind})=>{
 const results=[],errors=[];
 const create=async(auth=true)=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.route('**/*',async route=>{const u=new URL(route.request().url());if(!['127.0.0.1','fonts.googleapis.com','fonts.gstatic.com'].includes(u.hostname)){errors.push('Unexpected external '+u.hostname);await route.abort();return;}await route.continue();});
  if(auth)await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session(fixture.sessionUser))).toString('base64url'),url:baseURL,httpOnly:false,sameSite:'Lax'}]);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return{context,page};
 };
 fixture.authDelay=35;fixture.profileDelay=35;
 const times=[],counts=[];
 for(let i=0;i<12;i++){
  const {context,page}=await create();fixture.requests=[];const start=Date.now();await page.goto(baseURL,{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'ไปแดชบอร์ด',exact:true}).waitFor();
  times.push(Date.now()-start);counts.push({auth:fixture.requests.filter(r=>r.path==='/auth/v1/user').length,profile:fixture.requests.filter(r=>r.path==='/rest/v1/profiles').length});await context.close();
 }
 results.push('normal authenticated readiness');
 const sorted=[...times].sort((a,b)=>a-b);const performance={runs:times.length,ms:times,median:sorted[Math.floor(sorted.length/2)],p95:sorted[Math.ceil(sorted.length*.95)-1],counts};
 fs.writeFileSync(path.join(run,'performance-'+(process.env.PUBLIC_AUTH_BROWSER||'chromium')+'-'+Date.now()+'.json'),JSON.stringify(performance,null,2));
 fs.writeFileSync(path.join(run,'performance.json'),JSON.stringify(performance,null,2));
 if(kind==='baseline'){
  fixture.authDelay=2200;fixture.profileDelay=35;
  const {context,page}=await create();await page.goto(baseURL,{waitUntil:'domcontentloaded'});await page.waitForTimeout(450);
  const blank=await page.getByRole('button',{name:'ไปแดชบอร์ด',exact:true}).count()===0&&await page.getByRole('button',{name:'สมัครเรียนเลย',exact:true}).count()===0;
  assert.equal(blank,true,'Original blank action should reproduce');
  await page.screenshot({path:path.join(run,'baseline-blank.png')});results.push('original blank main action reproduced');await context.close();
 } else {
  await require('./candidate-cases.cjs')({create,fixture,baseURL,run,results,session});
 }
 assert.deepEqual(errors,[],'No client errors or unexpected external calls');
 return{kind,results,performance,clientErrors:errors};
};

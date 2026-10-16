const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async({create,fixture,baseURL,run,results,session})=>{
 const reset=()=>{fixture.role='user';fixture.authDelay=35;fixture.profileDelay=35;fixture.failProfiles=0;fixture.authStatus=200;fixture.profileMissing=false;fixture.refreshStatus=200;fixture.sessionUser='11111111-1111-4111-8111-111111111111';};
 reset();
 for(const role of ['user','coach','head_coach','admin','super_admin']){
  fixture.role=role;const {context,page}=await create();await page.goto(baseURL);await page.getByRole('button',{name:'ไปแดชบอร์ด',exact:true}).waitFor();
  await page.locator('header button[aria-haspopup="dialog"]').click();
  await page.getByRole('dialog',{name:'Website navigation'}).getByText('Synthetic '+role,{exact:true}).waitFor();
  await page.getByRole('button',{name:'แดชบอร์ด',exact:true}).click();
  const target=role==='user'?'/dashboard':role.includes('coach')?'/coach':'/admin';
  await page.waitForURL(url=>url.pathname===target,{timeout:20000});
  await page.waitForLoadState('domcontentloaded');
  assert.equal(await page.getByTestId('public-brand-loading').count(),0);
  results.push('role '+role+' arrives at '+target);await context.close();
 }
 reset();
 {
  const {context,page}=await create(false);await page.goto(baseURL);await page.getByRole('button',{name:'สมัครเรียนเลย',exact:true}).waitFor();
  await page.getByRole('button',{name:'สมัครเรียนเลย',exact:true}).click();await page.getByRole('dialog',{name:'สมัครสมาชิก',exact:true}).waitFor();
  results.push('anonymous registration remains usable');await context.close();
 }
 {
  fixture.authDelay=1800;const {context,page}=await create();await page.goto(baseURL,{waitUntil:'domcontentloaded'});
  assert.ok(await page.getByRole('button',{name:'เข้าใช้งาน',exact:true}).count()>0,'Main action exists before identity ready');
  await page.getByTestId('public-brand-loading').waitFor();await page.screenshot({path:path.join(run,'brand-loading-mobile.png')});
  await page.getByRole('button',{name:'ไปแดชบอร์ด',exact:true}).waitFor();
  await page.getByTestId('public-brand-loading').waitFor({state:'detached'});results.push('slow auth shows brand and finishes on readiness');await context.close();
 }
 reset();
 {
  fixture.failProfiles=1;const {context,page}=await create();await page.goto(baseURL);await page.getByRole('button',{name:'ไปแดชบอร์ด',exact:true}).waitFor({timeout:12000});
  results.push('transient profile failure retries automatically');await context.close();
 }
 reset();
 {
  fixture.profileMissing=true;const {context,page}=await create();await page.goto(baseURL);await page.getByText('กำลังเชื่อมต่อ…',{exact:true}).waitFor({timeout:10000});
  assert.equal(await page.getByRole('button',{name:'สมัครเรียนเลย',exact:true}).count(),0,'Missing role is not a guest');
  fixture.profileMissing=false;await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await page.getByRole('button',{name:'ไปแดชบอร์ด',exact:true}).waitFor({timeout:10000});results.push('missing role recovers without pretending signed out');await context.close();
 }
 reset();
 {
  fixture.authDelay=7000;const {context,page}=await create();await page.goto(baseURL,{waitUntil:'domcontentloaded'});
  await page.getByText('กำลังเชื่อมต่อ…',{exact:true}).waitFor({timeout:10000});
  assert.equal(await page.getByTestId('public-brand-loading').count(),0,'Public page not blocked forever');
  fixture.authDelay=35;await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await page.getByRole('button',{name:'ไปแดชบอร์ด',exact:true}).waitFor({timeout:12000});results.push('hanging auth aborts, releases public page and recovers');await context.close();
 }
 reset();
 {
  const {context,page}=await create();await page.goto(baseURL);await page.getByRole('button',{name:'ไปแดชบอร์ด',exact:true}).waitFor();
  await context.setOffline(true);fixture.failProfiles=1;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.waitForTimeout(200);
  assert.ok(await page.getByRole('button',{name:'ไปแดชบอร์ด',exact:true}).count(),'Verified identity retained during background outage');
  assert.equal(await page.getByTestId('public-brand-loading').count(),0,'Background refresh does not block screen');
  fixture.failProfiles=0;await context.setOffline(false);await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.waitForTimeout(300);
  results.push('background outage retains UI and reconnects');await context.close();
 }
 reset();
 {
  const {context,page}=await create();await page.goto(baseURL);await page.getByRole('button',{name:'ไปแดชบอร์ด',exact:true}).waitFor();
  fixture.profileDelay=1500;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.waitForTimeout(150);
  await page.locator('header button[aria-haspopup="dialog"]').click();await page.getByRole('button',{name:'ออกจากระบบ',exact:true}).click();
  await page.getByRole('button',{name:'สมัครเรียนเลย',exact:true}).waitFor({timeout:10000});await page.waitForTimeout(1800);
  assert.equal(await page.getByRole('button',{name:'ไปแดชบอร์ด',exact:true}).count(),0,'Old profile cannot restore logged-out identity');
  results.push('logout beats stale profile response');await context.close();
 }
 reset();
 {
  const {context,page}=await create(false);await page.goto(baseURL);await page.getByRole('button',{name:'สมัครเรียนเลย',exact:true}).waitFor();
  await page.locator('header button[aria-haspopup="dialog"]').click();await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();
  const modal=page.getByRole('dialog',{name:'เข้าสู่ระบบ',exact:true});await modal.getByLabel('อีเมล',{exact:true}).fill('synthetic@example.test');await modal.getByLabel('รหัสผ่าน',{exact:true}).fill('synthetic-password');
  await modal.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();await page.waitForURL(url=>url.pathname==='/dashboard',{timeout:20000});
  results.push('one login submits and continues to verified role destination');await context.close();
 }
 reset();
 {
  const {context,page}=await create(false);await page.goto(baseURL+'/auth/login');await page.getByLabel('อีเมล',{exact:true}).fill('synthetic@example.test');await page.getByLabel('รหัสผ่าน',{exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click();
  await page.waitForURL(url=>url.pathname==='/dashboard',{timeout:20000});results.push('direct login continues automatically');await context.close();
 }
 reset();
 {
  const {context,page}=await create();await page.goto(baseURL);await page.getByRole('button',{name:'ไปแดชบอร์ด',exact:true}).waitFor();
  await page.emulateMedia({reducedMotion:'reduce'});fixture.authDelay=600;await page.reload({waitUntil:'domcontentloaded'});await page.getByTestId('public-brand-loading').waitFor();
  const animations=await page.getByTestId('public-brand-loading').locator('span').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).animationName));assert.ok(animations.every(x=>x==='none'));
  await page.getByRole('button',{name:'ไปแดชบอร์ด',exact:true}).waitFor();results.push('reduced motion and reload');await context.close();
 }
 reset();
 {
  fixture.authDelay=0;fixture.profileDelay=0;const {context,page}=await create();
  await page.addInitScript(()=>{window.sawBrandLoading=false;new MutationObserver(()=>{if(document.querySelector('[data-testid="public-brand-loading"]'))window.sawBrandLoading=true;}).observe(document,{childList:true,subtree:true});});
  await page.goto(baseURL);await page.getByRole('button',{name:'ไปแดชบอร์ด',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.sawBrandLoading),false,'Fast identity does not wait for animation');results.push('fast identity skips full-screen animation');await context.close();
 }
 reset();
 {
  const {context,page}=await create();const expired={...session(fixture.sessionUser),expires_at:Math.floor(Date.now()/1000)-120};
  await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(expired)).toString('base64url'),url:baseURL}]);
  await page.goto(baseURL);await page.getByRole('button',{name:'ไปแดชบอร์ด',exact:true}).waitFor({timeout:12000});results.push('expired session refreshes automatically');await context.close();
 }
 reset();
 {
  fixture.refreshStatus=400;const {context,page}=await create();const expired={...session(fixture.sessionUser),expires_at:Math.floor(Date.now()/1000)-120};
  await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(expired)).toString('base64url'),url:baseURL}]);
  await page.goto(baseURL);await page.getByRole('button',{name:'สมัครเรียนเลย',exact:true}).waitFor({timeout:12000});results.push('ended refresh session settles as signed out');await context.close();
 }
 reset();
 {
  fixture.authStatus=401;const {context,page}=await create();await page.goto(baseURL);await page.getByRole('button',{name:'สมัครเรียนเลย',exact:true}).waitFor();results.push('invalid server identity settles without a fake role');await context.close();
 }
 reset();
 {
  const {context,page}=await create();await page.goto(baseURL);await page.getByRole('button',{name:'ไปแดชบอร์ด',exact:true}).waitFor();
  await context.setOffline(true);await page.getByRole('button',{name:'ไปแดชบอร์ด',exact:true}).click();await page.waitForTimeout(400);
  assert.equal(new URL(page.url()).pathname,'/');await context.setOffline(false);await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await page.waitForURL(url=>url.pathname==='/dashboard',{timeout:20000});results.push('one offline entry continues on reconnect');await context.close();
 }
 reset();
 {
  fixture.profileMissing=true;const {context,page}=await create();await page.goto(baseURL);await page.getByText('กำลังเชื่อมต่อ…',{exact:true}).waitFor();
  await page.locator('#hero').getByRole('button',{name:'เข้าใช้งาน',exact:true}).click();await page.waitForTimeout(4300);
  await page.locator('header button[aria-haspopup="dialog"]').click();await page.getByRole('dialog',{name:'Website navigation'}).getByRole('link',{name:'คอร์สเรียน & ราคา',exact:true}).click();
  fixture.profileMissing=false;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.getByRole('button',{name:'ไปแดชบอร์ด',exact:true}).waitFor();await page.waitForTimeout(700);
  assert.equal(new URL(page.url()).pathname,'/');assert.equal(new URL(page.url()).hash,'#pricing');results.push('another destination cancels unresolved entry intent');await context.close();
 }
 reset();
 {
  const {context,page}=await create();await page.goto(baseURL);await page.getByRole('button',{name:'ไปแดชบอร์ด',exact:true}).waitFor();
  fixture.profileDelay=1400;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.waitForTimeout(150);
  fixture.sessionUser='22222222-2222-4222-8222-222222222222';fixture.role='coach';fixture.profileDelay=35;
  const next=session(fixture.sessionUser);await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(next)).toString('base64url'),url:baseURL}]);
  await page.evaluate(value=>{const channel=new BroadcastChannel('sb-127-auth-token');channel.postMessage({event:'SIGNED_IN',session:value});setTimeout(()=>channel.close(),200);},next);
  await page.waitForTimeout(1800);await page.locator('header button[aria-haspopup="dialog"]').click();await page.getByRole('dialog',{name:'Website navigation'}).getByText('Synthetic coach',{exact:true}).waitFor();
  assert.equal(await page.getByRole('dialog',{name:'Website navigation'}).getByText('Synthetic user',{exact:true}).count(),0);results.push('account switch wins over old profile read');await context.close();
 }
 reset();
 {
  const {context,page}=await create();await page.goto(baseURL);await page.getByRole('button',{name:'ไปแดชบอร์ด',exact:true}).waitFor();
  const requests=[];page.on('request',request=>{if(new URL(request.url()).pathname==='/dashboard')requests.push(request.url());});
  await page.getByRole('button',{name:'ไปแดชบอร์ด',exact:true}).evaluate(button=>{button.click();button.click();});
  await page.waitForURL(url=>url.pathname==='/dashboard',{timeout:20000});assert.equal(requests.length,1);results.push('repeated entry click emits one navigation');await context.close();
 }
 reset();
 {
  fixture.role='coach';fixture.failProfiles=1;const {context,page}=await create();await page.goto(baseURL+'/auth/login');
  await page.waitForURL(url=>url.pathname==='/coach',{timeout:20000});results.push('direct entry recovers role read instead of guessing user');await context.close();
 }
 reset();
 {
  const {context,page}=await create();await page.goto(baseURL);await page.getByRole('button',{name:'ไปแดชบอร์ด',exact:true}).waitFor();
  const denied=await context.request.get(baseURL+'/admin',{maxRedirects:0});assert.equal(denied.status(),307);assert.equal(new URL(denied.headers().location,baseURL).pathname,'/dashboard');results.push('user remains barred from admin route');await context.close();
  const guest=await create(false);const response=await guest.context.request.get(baseURL+'/coach',{maxRedirects:0});assert.equal(response.status(),307);assert.equal(new URL(response.headers().location,baseURL).pathname,'/auth/login');
  const api=await guest.context.request.get(baseURL+'/api/coach/assignment-groups');assert.equal(api.status(),401);results.push('anonymous protected page and API still reject');await guest.context.close();
 }
 reset();
 {
  fixture.profileDelay=1400;const {context,page}=await create();const oldRead=page.waitForRequest(request=>new URL(request.url()).pathname==='/rest/v1/profiles');await page.goto(baseURL,{waitUntil:'domcontentloaded'});await oldRead;
  fixture.sessionUser='22222222-2222-4222-8222-222222222222';fixture.role='coach';fixture.profileDelay=35;const next=session(fixture.sessionUser);
  await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(next)).toString('base64url'),url:baseURL}]);
  await page.evaluate(value=>{const channel=new BroadcastChannel('sb-127-auth-token');channel.postMessage({event:'SIGNED_IN',session:value});setTimeout(()=>channel.close(),200);},next);
  await page.getByRole('button',{name:'ไปแดชบอร์ด',exact:true}).waitFor();await page.waitForTimeout(1500);await page.locator('header button[aria-haspopup="dialog"]').click();await page.getByRole('dialog',{name:'Website navigation'}).getByText('Synthetic coach',{exact:true}).waitFor();
  results.push('account switch during initial read discards old identity');await context.close();
 }
 reset();
 {
  const {context,page}=await create();const expired={...session(fixture.sessionUser),expires_at:Math.floor(Date.now()/1000)-120};
  await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(expired)).toString('base64url'),url:baseURL}]);fixture.requests=[];
  await page.goto(baseURL+'/auth/login');await page.waitForURL(url=>url.pathname==='/dashboard');
  assert.equal(fixture.requests.filter(request=>request.path==='/auth/v1/token').length,1,'Redirect must preserve refreshed session cookie');
  results.push('direct entry retains refreshed cookie without another refresh');await context.close();
 }
 reset();
 {
  const {context,page}=await create();await page.goto(baseURL);await page.getByRole('button',{name:'ไปแดชบอร์ด',exact:true}).waitFor();
  fixture.authDelay=4000;await page.getByRole('button',{name:'ไปแดชบอร์ด',exact:true}).click();await page.waitForTimeout(4250);
  await page.locator('header button[aria-haspopup="dialog"]').click();await page.getByRole('dialog',{name:'Website navigation'}).getByRole('link',{name:'คอร์สเรียน & ราคา',exact:true}).click();
  await page.waitForTimeout(8500);assert.equal(new URL(page.url()).pathname,'/');assert.equal(new URL(page.url()).hash,'#pricing');results.push('section choice cancels an already pending dashboard navigation');await context.close();
 }
 reset();
 {
  const {context,page}=await create();await page.goto(baseURL);await page.getByRole('button',{name:'ไปแดชบอร์ด',exact:true}).waitFor();
  fixture.authDelay=4500;const requests=[];page.on('request',request=>{if(new URL(request.url()).pathname==='/dashboard')requests.push(request.url());});
  await page.getByRole('button',{name:'ไปแดชบอร์ด',exact:true}).click();await page.waitForURL(url=>url.pathname==='/dashboard',{timeout:25000});assert.equal(requests.length,1);
  results.push('slow in-flight navigation is allowed to finish without duplicate requests');await context.close();
 }
 reset();
 fs.writeFileSync(path.join(run,'case-results.json'),JSON.stringify(results,null,2));
};

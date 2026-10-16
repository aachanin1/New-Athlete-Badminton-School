const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=process.cwd(),kind=process.argv[2]||'candidate',stamp=new Date().toISOString().replace(/[:.]/g,'-');
if(!['baseline','candidate'].includes(kind))throw Error('Expected baseline or candidate');
const reuse=process.env.PUBLIC_AUTH_REUSE_RUN;
const run=reuse?path.resolve(reuse):path.join(root,'.playwright/public-auth-1',kind+'-'+stamp),app=path.join(run,'app');
if(!run.startsWith(path.join(root,'.playwright/public-auth-1')+path.sep))throw Error('Invalid run directory');
fs.mkdirSync(app,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const configs=['package.json','package-lock.json','next.config.mjs','tsconfig.json','tailwind.config.ts','postcss.config.mjs','eslint.config.mjs'];
const sourceHead=cp.execFileSync('git',['rev-parse',kind==='baseline'?'d920865dd83cb0d5819d597c0c9e28132fd19c8c':'HEAD'],{encoding:'utf8'}).trim();
const files=kind==='baseline'
 ?cp.execFileSync('git',['ls-tree','-r','--name-only',sourceHead],{encoding:'utf8'}).trim().split(/\r?\n/).filter(file=>/^(src|public)\//.test(file)||configs.includes(file)).sort()
 :cp.execFileSync('rg',['--files','src','public'],{encoding:'utf8'}).trim().split(/\r?\n/).concat(configs.filter(f=>fs.existsSync(f))).sort();
const manifest={};
if(!reuse){for(const file of files){const to=path.join(app,file);fs.mkdirSync(path.dirname(to),{recursive:true});const buffer=kind==='baseline'?cp.execFileSync('git',['show',sourceHead+':'+file],{maxBuffer:40e6}):fs.readFileSync(file);fs.writeFileSync(to,buffer);manifest[file.replaceAll('\\','/')]=hash(buffer);}
fs.symlinkSync(path.join(root,'node_modules'),path.join(app,'node_modules'),'junction');}
const fixture={role:'user',authDelay:35,profileDelay:35,failProfiles:0,requests:[],rejected:[],sessionUser:'11111111-1111-4111-8111-111111111111'};
const user=id=>({id,aud:'authenticated',role:'authenticated',email:'synthetic@example.test',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'});
const token=id=>['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',Buffer.from(JSON.stringify({sub:id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic-signature'].join('.');
const session=id=>({access_token:token(id),refresh_token:'synthetic-refresh',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user:user(id)});
const backend=http.createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','*');res.setHeader('Access-Control-Allow-Methods','GET,HEAD,OPTIONS,POST');res.setHeader('Content-Type','application/json');
 if(req.method==='OPTIONS'){res.end();return;}
 const u=new URL(req.url,'http://localhost');const id=fixture.sessionUser;const role=fixture.role;const roleDelay=fixture.profileDelay;
 const record={method:req.method,path:u.pathname,at:Date.now()};fixture.requests.push(record);
 if(req.method==='GET'&&u.pathname==='/auth/v1/user'){await new Promise(r=>setTimeout(r,fixture.authDelay));res.statusCode=fixture.authStatus||200;res.end(JSON.stringify(res.statusCode===200?user(id):{message:'Synthetic invalid session'}));return;}
 if(req.method==='POST'&&u.pathname==='/auth/v1/token'){res.statusCode=fixture.refreshStatus||200;res.end(JSON.stringify(res.statusCode===200?session(id):{code:'refresh_token_not_found',message:'Synthetic refresh token ended'}));return;}
 if(req.method==='POST'&&u.pathname==='/auth/v1/logout'){res.statusCode=204;res.end();return;}
 if((req.method==='GET'||req.method==='HEAD')&&u.pathname.startsWith('/rest/v1/')){
   if(u.pathname==='/rest/v1/profiles'){
    await new Promise(r=>setTimeout(r,roleDelay));
    if(fixture.failProfiles>0){fixture.failProfiles--;res.statusCode=503;res.end(JSON.stringify({message:'Synthetic transient profile outage'}));return;}
    if(fixture.profileMissing){res.end('[]');return;}
    const data={id,full_name:'Synthetic '+role,role,avatar_url:null,phone:null,branch_id:null};
    res.end(JSON.stringify((req.headers.accept||'').includes('object')?data:[data]));return;
   }
   res.setHeader('Content-Range','*/0');res.end('[]');return;
 }
 fixture.rejected.push(record);res.statusCode=405;res.end(JSON.stringify({message:'Synthetic fixture rejects business mutations'}));
});
let server,env,browser;
const step=(name,args)=>new Promise((resolve,reject)=>{const fd=fs.openSync(path.join(run,name+'.log'),'w');const child=cp.spawn(process.execPath,args,{env,windowsHide:true,stdio:['ignore',fd,fd]});child.on('error',reject);child.on('exit',code=>{fs.closeSync(fd);console.log(name+': '+code);if(code){console.log(fs.readFileSync(path.join(run,name+'.log'),'utf8').slice(-6000));reject(Error(name+' failed'));}else resolve();});});
(async()=>{
 const prior=reuse?JSON.parse(fs.readFileSync(path.join(run,'source-manifest.json'))):null;
 if(prior)for(const [file,digest]of Object.entries(prior.files))if(hash(fs.readFileSync(path.join(app,file)))!==digest)throw Error('Snapshot drift '+file);
 await new Promise((r,j)=>{backend.once('error',j);backend.listen(prior?Number(new URL(prior.backendURL).port):0,'127.0.0.1',r)});const backendURL='http://127.0.0.1:'+backend.address().port;
 env={...process.env,NEXT_PUBLIC_SUPABASE_URL:backendURL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_public_auth_fixture',NEXT_PUBLIC_SUPABASE_ANON_KEY:'sb_publishable_public_auth_fixture',SUPABASE_SERVICE_ROLE_KEY:'synthetic-not-a-real-service-key',NEXT_TELEMETRY_DISABLED:'1'};
 if(!reuse)fs.writeFileSync(path.join(run,'source-manifest.json'),JSON.stringify({base:sourceHead,kind,backendURL,files:manifest,isolation:'fresh app copy, no .env, synthetic keys, loopback fixture, no database'},null,2));
 console.log('RUN '+run);
 if(!reuse)await step('build',[path.join(root,'node_modules/next/dist/bin/next'),'build',app,'--webpack']);
 const probe=require('node:net').createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const fd=fs.openSync(path.join(run,'server-'+stamp+'.log'),'w');server=cp.spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start',app,'--hostname','127.0.0.1','--port',String(port)],{env,windowsHide:true,stdio:['ignore',fd,fd]});
 const baseURL='http://127.0.0.1:'+port;let ready=false;
 for(let i=0;i<80;i++){try{if((await fetch(baseURL)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
 if(!ready)throw Error('Isolated runtime not ready');
 const engine=process.env.PUBLIC_AUTH_BROWSER||'chromium';if(!['chromium','webkit'].includes(engine))throw Error('Unsupported acceptance browser');
 const browserType=require(path.join(root,'node_modules/@playwright/test'))[engine];browser=await browserType.launch({headless:true});
 const evidenceRun=path.join(run,'acceptance-'+engine+'-'+stamp);fs.mkdirSync(evidenceRun,{recursive:true});
 const out=await require('./verify.cjs')({browser,baseURL,backendURL,fixture,user,session,run:evidenceRun,kind});out.evidenceRun=evidenceRun;
 await browser.close();
 if(kind==='candidate'&&!process.env.PUBLIC_AUTH_SKIP_NAV){
  env.PUBLIC_AUTH_BASE_URL=baseURL;env.PUBLIC_AUTH_OUTPUT=path.join(run,'public-navigation-'+stamp);
  await step('public-navigation-'+stamp,[path.join(root,'node_modules/playwright/cli.js'),'test','--config=playwright.public-auth.config.ts']);
  const stats=JSON.parse(fs.readFileSync(path.join(env.PUBLIC_AUTH_OUTPUT,'report.json'))).stats;
  if(stats.expected!==34||stats.unexpected||stats.skipped||stats.flaky)throw Error('Public navigation regression did not pass');
  out.protectedNavigation=stats;
 }
 if(fixture.rejected.length)throw Error('Unexpected fixture mutation '+JSON.stringify(fixture.rejected));
 const final={at:new Date().toISOString(),engine,buildId:fs.readFileSync(path.join(app,'.next/BUILD_ID'),'utf8'),...out,rejected:fixture.rejected};
 fs.writeFileSync(path.join(run,'result-'+engine+'-'+stamp+'.json'),JSON.stringify(final,null,2));
 fs.writeFileSync(path.join(run,'result.json'),JSON.stringify(final,null,2));
 console.log(JSON.stringify(out));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();fs.writeFileSync(path.join(run,'requests-'+stamp+'.json'),JSON.stringify(fixture.requests,null,2));if(server)server.kill();backend.close();});

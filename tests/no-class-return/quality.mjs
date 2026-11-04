import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
const dir=path.resolve('.playwright/no-class-return-1/acceptance/quality-'+Date.now());fs.mkdirSync(dir,{recursive:true});
const definitions=['tests/no-class-return/contracts.mjs','tests/no-class-return/teaching-contracts.mjs','scripts/check-coach-teaching-hours-completeness.mjs','scripts/check-admin-payroll-performance.mjs','scripts/check-lesson-wallet-regression.mjs','scripts/check-mojibake.js'];
const source=['src/app/api/admin/makeup/return-round/route.ts','src/app/api/admin/coach-payouts/route.ts','src/components/admin/makeup-client.tsx','src/components/admin/no-class-return-dialog.tsx','src/lib/no-class-return.ts','src/lib/no-class-return-server.ts','src/lib/no-class-return-release.ts','src/lib/coach-teaching-hours.ts'];
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');const hashes=Object.fromEntries([...definitions,...source,import.meta.filename].map(f=>[f,sha(f)])),checks=[];
try{
 for(const file of definitions){const output=execFileSync(process.execPath,['--no-warnings',file],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe'],maxBuffer:4*1024*1024});const log=path.basename(file)+'.log';fs.writeFileSync(path.join(dir,log),output);checks.push({name:file,passed:true,log})}
 const lint=execFileSync(process.execPath,['node_modules/eslint/bin/eslint.js',...source,'scripts/prepare-no-class-return-local.mjs','scripts/build-no-class-return-local.mjs','scripts/verify-lesson-source-test-target.mjs','--max-warnings=0'],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']});fs.writeFileSync(path.join(dir,'lint.log'),lint);checks.push({name:'focused source and runtime lint without warnings',passed:true});
 execFileSync('git',['diff','--check'],{windowsHide:true,stdio:['ignore','pipe','pipe']});checks.push({name:'diff whitespace check',passed:true});
 assert.deepEqual(Object.fromEntries(Object.keys(hashes).map(f=>[f,sha(f)])),hashes,'Source/definitions changed during checks');fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify({passed:true,at:new Date().toISOString(),checks,hashes},null,2));console.log(JSON.stringify({dir,passed:checks.length}))
}catch(e){fs.writeFileSync(path.join(dir,'failure.json'),JSON.stringify({checks,error:e.stack,stderr:e.stderr?.toString()},null,2));console.error(e.stderr?.toString()||e);process.exitCode=1}

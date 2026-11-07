import fs from 'node:fs'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import assert from 'node:assert/strict'
import {run} from './runtime.mjs'
import {evidence,hashFile} from './helpers.mjs'
const checks=[]
for(const [label,args] of [['typescript',['node_modules/typescript/bin/tsc','--noEmit','--incremental','false']],['lint',['node_modules/eslint/bin/eslint.js','src','--max-warnings=0']],['thai-encoding',['scripts/check-mojibake.js']]]){
 const result=spawnSync(process.execPath,args,{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024})
 const file=path.join(run.outputDir,label+'-'+Date.now()+'.log');fs.writeFileSync(file,(result.stdout||'')+(result.stderr||''),{flag:'wx'})
 assert.ifError(result.error);assert.equal(result.status,0,label+' failed; '+file)
 checks.push({name:label,exitCode:result.status,log:file});console.log(label+' passed')
}
const file=evidence('quality-pass',{checks,suiteHash:hashFile('tests/booking-makeup-scope/quality.mjs')});console.log(JSON.stringify({passed:checks.length,evidence:file}))

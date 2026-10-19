import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {run,sql} from '../tests/admin-makeup-browse/runtime.mjs'
const root=path.join(run.outputDir,'v9')
fs.mkdirSync(root,{recursive:true})
const files=execFileSync('git',['ls-files','-co','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(f=>f&&fs.existsSync(f)&&fs.statSync(f).isFile()).sort()
const hashes=Object.fromEntries(files.map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]))
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()
assert.equal(head,'bd71ec58ed26721eab76b5e92ad2eeebe858ec3a')
assert.equal(execFileSync('git',['diff','--cached','--name-only'],{encoding:'utf8'}).trim(),'')
for(const [file,hash]of Object.entries(JSON.parse(fs.readFileSync(path.join(run.evidenceRoot,'pre-existing-dirty-hashes.json')))))assert.equal(hashes[file].toUpperCase(),hash)
const functions=JSON.parse(sql("SELECT jsonb_object_agg(oid::regprocedure::text,pg_get_functiondef(oid)) FROM pg_proc WHERE pronamespace='public'::regnamespace AND prokind='f';"))
fs.writeFileSync(path.join(root,'baseline-functions.json'),JSON.stringify(functions,null,2),{flag:'wx'})
fs.writeFileSync(path.join(root,'baseline-source.json'),JSON.stringify({runId:run.runId,head,hashes,authority:'Owner approved v9 implementation and Local synthetic verification; no publishing/Production/BOOKING-UX-1'},null,2),{flag:'wx'})
for(const [name,url]of Object.entries({changelog:'https://supabase.com/changelog.md',functions:'https://supabase.com/docs/guides/database/functions.md',rls:'https://supabase.com/docs/guides/database/postgres/row-level-security.md'})){
 const r=await fetch(url);assert.equal(r.status,200);const content=await r.text();fs.writeFileSync(path.join(root,'docs-'+name+'.md'),content)
 console.log(JSON.stringify({documentation:name,bytes:content.length,breakingTags:content.match(/^.*breaking.change.*$/gim)?.slice(0,8)||[]}))
}
console.log(JSON.stringify({captured:true,files:files.length,functions:Object.keys(functions).length,root,cli:run.cli}))

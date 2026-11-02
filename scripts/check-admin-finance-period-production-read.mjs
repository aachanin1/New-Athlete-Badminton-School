// Production read-only reconciliation. No auth/transaction/customer writes.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import ts from 'typescript'
import * as readers from '../src/lib/admin-finance-read.ts'
import * as periodHelpers from '../src/lib/admin-finance-period.ts'

assert.equal(process.env.FINANCE_PRODUCTION_READ_ONLY, '1', 'explicit read-only target required')
const envFile = process.env.FINANCE_PRODUCTION_ENV_FILE, evidence = process.env.FINANCE_PERIOD_EVIDENCE
assert.ok(envFile && evidence && path.isAbsolute(envFile) && path.isAbsolute(evidence))
const env = {}
for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (match) env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
}
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, 'https://tvnhholicwjtxdhlxfqs.supabase.co')
assert.ok(env.SUPABASE_SERVICE_ROLE_KEY)
const requests = {}
const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: async (input, options) => {
    const url = new URL(typeof input === 'string' ? input : input.url), method = options?.method || 'GET'
    assert.equal(url.origin, env.NEXT_PUBLIC_SUPABASE_URL)
    assert.ok(['GET','HEAD'].includes(method), 'Production mutations are forbidden')
    assert.match(url.pathname, /^\/rest\/v1\/(bookings|payments|finance_expenses|coach_weekly_teaching_summaries|branches|payment_ledger_allocations_v1)$/)
    requests[url.pathname] = (requests[url.pathname] || 0) + 1
    return fetch(input, options)
  } },
})
const require=createRequire(import.meta.url), module={exports:{}}, root=process.cwd()
const source=fs.readFileSync(path.join(root,'src/app/(admin)/admin/finance/page.tsx'),'utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText
vm.runInNewContext(compiled,{module,exports:module.exports,Date,require(name){
  if(name==='@/lib/auth/admin')return{getServiceRoleClient:()=>client,requireAdminPageAccess:async()=>({supabase:client}),requireAdminMenuAccess:async()=>({ok:true})}
  if(name==='@/lib/progressive-pricing-feature')return{isProgressivePaymentReviewEnabled:()=>true}
  if(name==='@/components/admin/finance-client')return{FinanceClient:'FinanceClient'}
  if(name==='@/lib/admin-finance-read')return readers
  if(name==='@/lib/admin-finance-period')return periodHelpers
  if(name==='next/navigation')return{redirect:()=>{throw new Error('Unexpected redirect in read harness')}}
  if(name==='react/jsx-runtime')return require(name)
  throw new Error('Unexpected dependency: '+name)
}})
const result={startedAt:new Date().toISOString(),target:'tvnhholicwjtxdhlxfqs',mode:'GET/HEAD-only service read harness, not authenticated Production UI',periods:{}}
for(const period of [{mode:'month',year:2026,month:11},{mode:'month',year:2026,month:10},{mode:'year',year:2026,month:11},{mode:'month',year:2025,month:11}]){
  const params=Object.fromEntries(Object.entries(period).map(([k,v])=>[k,String(v)]))
  const props=(await module.exports.default({searchParams:Promise.resolve(params)})).props
  const approved=props.payments.filter(p=>p.status==='approved'), values=new Map(approved.map(p=>[p.booking_id,p.booking_net_value]))
  result.periods[`${period.mode}-${period.year}-${period.month}`]={
    revenue:approved.reduce((s,p)=>s+p.amount,0),approvedCount:new Set(approved.map(p=>p.transaction_id)).size,
    allocations:approved.length,bookingValue:[...values.values()].reduce((s,v)=>s+v,0),
    pending:props.payments.filter(p=>p.status==='pending').reduce((s,p)=>s+p.amount,0),
    rejected:props.payments.filter(p=>p.status==='rejected').length,
    coach:props.coachSummaries.reduce((s,p)=>s+p.payable_amount,0),expenses:props.expenses.reduce((s,p)=>s+p.amount,0),
  }
  assert.ok(props.payments.every(p=>p.booking_year===period.year&&(period.mode==='year'||p.booking_month===period.month)))
}
result.finishedAt=new Date().toISOString();result.requests=requests
result.sourceHashes=Object.fromEntries(['src/app/(admin)/admin/finance/page.tsx','src/lib/admin-finance-read.ts','src/lib/admin-finance-period.ts'].map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]))
fs.writeFileSync(path.join(evidence,'production-read-results.json'),JSON.stringify(result,null,2))
console.log(JSON.stringify(result,null,2))

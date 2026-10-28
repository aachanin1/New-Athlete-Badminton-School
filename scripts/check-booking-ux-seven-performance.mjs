import fs from 'node:fs'
import assert from 'node:assert/strict'
import {performance} from 'node:perf_hooks'
import {auth} from './check-booking-ux-seven.mjs'
import {sql,q} from '../tests/booking-ux/runtime.mjs'
const root='.playwright/booking-ux-1/ux-seven-20261022',actor=JSON.parse(fs.readFileSync(root+'/actor.json','utf8')),cookie=await auth(actor)
const bases={before:'http://127.0.0.1:3152',after:'http://127.0.0.1:3153'}
const repeat=process.argv[2]==='repeat',sampleCount=repeat?60:30
const pages=repeat?['/dashboard/history','/api/booking-checkout']:['/dashboard/booking','/dashboard/payments','/dashboard/history','/api/booking-checkout']
const roster=sql(`SELECT md5(jsonb_build_object('children',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM children c WHERE parent_id=${q(actor.id)}),'branches',(SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id) FROM branches b WHERE is_active),'bookings',(SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id) FROM bookings b WHERE user_id=${q(actor.id)}))::text)`)
const counts=JSON.parse(sql(`SELECT jsonb_build_object('learners',(SELECT count(*) FROM children WHERE parent_id=${q(actor.id)}),'branches',(SELECT count(*) FROM branches WHERE is_active),'bookings',(SELECT count(*) FROM bookings WHERE user_id=${q(actor.id)}))`))
const results=[]
for(const page of pages){
 const series={before:[],after:[]},sizes={before:[],after:[]}
 for(let n=0;n<sampleCount+5;n++)for(const name of n%2?['after','before']:['before','after']){
  const started=performance.now(),r=await fetch(bases[name]+page,{headers:{Cookie:cookie},redirect:'manual'}),bytes=await r.arrayBuffer(),ms=performance.now()-started
  assert.equal(r.status,200,page+' '+name);if(n>=5){series[name].push(ms);sizes[name].push(bytes.byteLength)}
 }
 const stat=xs=>{xs=[...xs].sort((a,b)=>a-b);return {median:Math.round(xs[Math.floor(xs.length/2)]),p95:Math.round(xs[Math.ceil(xs.length*.95)-1])}}
 const entry={page,before:stat(series.before),after:stat(series.after),bytes:{before:stat(sizes.before).median,after:stat(sizes.after).median},samples:sampleCount,raw:series};results.push(entry);console.log(JSON.stringify(entry))
}
assert.equal(sql(`SELECT md5(jsonb_build_object('children',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM children c WHERE parent_id=${q(actor.id)}),'branches',(SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id) FROM branches b WHERE is_active),'bookings',(SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id) FROM bookings b WHERE user_id=${q(actor.id)}))::text)`),roster)
fs.writeFileSync(root+(repeat?'/performance-repeat.json':'/performance.json'),JSON.stringify({at:new Date().toISOString(),metric:'Authenticated full HTTP response, same current isolated schema/data; not browser rendering or a Production benchmark',counts,roster,alternatingOrder:true,warmup:5,samples:sampleCount,results},null,2))

import http from 'node:http'
import fs from 'node:fs'
import {sql,q} from '../tests/booking-ux/runtime.mjs'
const root='.playwright/booking-ux-1/wallet-local-20261023',actor=JSON.parse(fs.readFileSync(root+'/kids-ui-fixture.json')).actor
const allowed=JSON.parse(sql(`SELECT jsonb_agg(u.id) FROM booking_package_units u JOIN bookings b ON b.id=u.booking_id WHERE b.user_id=${q(actor.id)} AND u.status='available'`))
let armed=true
const server=http.createServer(async(req,res)=>{try{
 const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks),headers={...req.headers,host:'127.0.0.1:3153'};delete headers['content-length'];if(headers.origin==='http://127.0.0.1:3150')headers.origin='http://127.0.0.1:3153'
 const response=await fetch('http://127.0.0.1:3153'+req.url,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:body,redirect:'manual'}),bytes=Buffer.from(await response.arrayBuffer())
 let command;try{command=JSON.parse(body)}catch{}
 if(armed&&req.url==='/api/booking-wallet'&&req.method==='POST'&&response.status===200&&command.picks.every(p=>allowed.includes(p.id))){armed=false;fs.writeFileSync(root+'/lost-response.json',JSON.stringify({requestId:command.requestId,picks:command.picks,result:JSON.parse(bytes)},null,2));res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Local ทดสอบ: คำตอบขาดหลังบันทึกแล้ว ตรวจผลเดิมก่อนใช้ซ้ำ'}));return}
 res.writeHead(response.status,Object.fromEntries([...response.headers].filter(([k])=>!['content-length','content-encoding','transfer-encoding'].includes(k))));res.end(bytes)
 }catch(e){res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:String(e)}))}})
server.listen(3150,'127.0.0.1',()=>{fs.writeFileSync(root+'/fault-runtime.json',JSON.stringify({pid:process.pid,port:3150,actor:actor.id}));console.log('Wallet lost-response test: 3150 -> 3153')});setTimeout(()=>server.close(),600000)

// Local API fault fixture. Browser interaction stays in CUA. No hosted target.
import http from 'node:http'
import fs from 'node:fs'
import {run} from '../tests/booking-ux/runtime.mjs'
const root=run.evidenceRoot+'/ux-seven-20261022',configuration=root+'/fault.json',target='http://127.0.0.1:3153'
const server=http.createServer(async(req,res)=>{
 try{
  const chunks=[];let bytes=0;for await(const c of req){bytes+=c.length;if(bytes>2*1024*1024)throw Error('request too large');chunks.push(c)}const body=Buffer.concat(chunks)
  const headers={...req.headers,host:'127.0.0.1:3153'};delete headers['content-length'];if(headers.origin==='http://127.0.0.1:3150')headers.origin=target
  const r=await fetch(target+req.url,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:body,redirect:'manual'}),response=Buffer.from(await r.arrayBuffer())
  let config=null;try{config=JSON.parse(fs.readFileSync(configuration,'utf8'))}catch{}
  let command=null;try{command=JSON.parse(body.toString('utf8'))}catch{}
  if(config?.armed&&req.url==='/api/booking-checkout'&&command?.action==='set'&&!command.preview&&r.status===200
    &&JSON.stringify([...command.input.bookingIds].sort())===JSON.stringify([...config.bookingIds].sort())){
   fs.writeFileSync(configuration,JSON.stringify({...config,armed:false,requestId:command.requestId,committed:JSON.parse(response.toString('utf8'))},null,2))
   res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({definitive:false,error:'Local ทดสอบ: การตอบกลับขาดหลังบันทึกแล้ว กรุณาตรวจผลคำขอเดิม'}));return
  }
  const out=Object.fromEntries([...r.headers].filter(([k])=>!['content-length','content-encoding','transfer-encoding'].includes(k)));res.writeHead(r.status,out);res.end(response)
 }catch(e){res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}
})
server.listen(3150,'127.0.0.1',()=>console.log('Owned Local fault fixture:3150 ->3153; automatic close in ten minutes'))
setTimeout(()=>server.close(),10*60*1000)

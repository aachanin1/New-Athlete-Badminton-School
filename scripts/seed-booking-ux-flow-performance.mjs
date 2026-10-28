import fs from 'node:fs'
import {randomUUID}from'node:crypto'
import {run,sql,q,fixtures}from'../tests/booking-ux/runtime.mjs'
const file=run.evidenceRoot+'/flow-performance-fixture.json';if(fs.existsSync(file))throw Error('Preserve immutable flow dataset')
const actors={oldSmall:await fixtures.account('user','ผู้ปกครองวัดเวลาจอง'),newSmall:await fixtures.account('user','ผู้ปกครองวัดเวลาจอง'),oldLarge:JSON.parse(fs.readFileSync(run.evidenceRoot+'/performance-large-fixture.json')).parent,newLarge:JSON.parse(fs.readFileSync(run.evidenceRoot+'/performance-large-candidate-fixture.json')).parent}
for(const actor of Object.values(actors)){actor.child=randomUUID();sql(`INSERT INTO children(id,parent_id,full_name,nickname)VALUES(${q(actor.child)},${q(actor.id)},'นักเรียนวัดเวลา','น้องวัดเวลา')`)}
fs.writeFileSync(file,JSON.stringify({runId:run.runId,actors},null,2),{flag:'wx'});console.log(JSON.stringify({seeded:4,file}))

import assert from 'node:assert/strict'
import {makeupOverlap,makeupCardDestinations} from '../src/lib/admin-makeup-workspace.ts'
const date='2026-11-26',busy=[{date,start:'09:00:00',end:'10:00:00',childId:'child'}],checks=[]
function check(name,actual,expected){assert.deepEqual(actual,expected);checks.push(name)}
check('adjacent end is free across HH:mm and HH:mm:ss',makeupOverlap(busy,date,'10:00','11:00'),false)
check('adjacent start is free across HH:mm and HH:mm:ss',makeupOverlap(busy,date,'08:00','09:00'),false)
check('partial overlap is blocked',makeupOverlap(busy,date,'09:30','10:30'),true)
check('contained period is blocked',makeupOverlap(busy,date,'09:15','09:45'),true)
check('containing period is blocked',makeupOverlap(busy,date,'08:00','11:00'),true)
check('different date is free',makeupOverlap(busy,'2026-11-27','09:00','10:00'),false)
const destinations=[{id:'one',additional:true,grantId:'same',childName:'ผู้ใหญ่'},{id:'two',additional:true,grantId:'same',childName:'เด็กหนึ่ง'},{id:'three',additional:true,grantId:'same',childName:'เด็กสอง'},{id:'absence',additional:false,childName:'เด็กหนึ่ง'}],before=structuredClone(destinations)
check('Private grant is one visible unit with every member',makeupCardDestinations({course:'private',destinations}).map(d=>d.childName),['ผู้ใหญ่ · เด็กหนึ่ง · เด็กสอง','เด็กหนึ่ง'])
check('grouping never changes original records',destinations,before)
check('Kids individual destinations remain individual',makeupCardDestinations({course:'kids_group',destinations}).length,4)
console.log(JSON.stringify({passed:checks.length,checks}))

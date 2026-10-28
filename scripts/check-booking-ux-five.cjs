const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript'),assert=require('node:assert/strict')
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),original=Module._resolveFilename
Module._resolveFilename=function(id,...args){return original.call(this,id.startsWith('@/')?path.resolve('src',id.slice(2)):id,...args)}
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file)
const {bookingReference,historyBookingIds,bookingHistoryHref}=require('../src/lib/booking-reference.ts')
const {BookingOrderReferences}=require('../src/components/dashboard/booking-order-references.tsx')
const checks=[],check=(value,name)=>{assert.ok(value,name);checks.push(name)}
const a='7bdba9eb-3385-4019-9f8d-04a3e7ad98a4',b='7bdba9eb-3385-4019-9f8d-04a3e7ad98a5',c='8f21c60a-98d4-4019-9f8d-04a3e7ad98a4'
check(bookingReference(a)==='BK-7BDB-A9EB-3385','Existing UUID gives deterministic short display')
check(bookingReference(a,[b,a])!==bookingReference(b,[a,b]),'Colliding prefixes extend through the differing full UUID suffix')
check(bookingReference(a,[a])===bookingReference(a.toUpperCase(),[a]),'Capitalization does not change identity')
check(historyBookingIds(a+','+a.toUpperCase()).length===1,'Full IDs normalize and deduplicate')
check(historyBookingIds(a+',<script>').length===0&&historyBookingIds([a]).length===0,'Invalid and multi-value parameters do not select any record')
check(historyBookingIds(Array(101).fill(a).join(',')).length===0,'Target list has a strict bound')
check(decodeURIComponent(bookingHistoryHref([a,c])).includes(a+','+c),'Combined history link retains every exact full ID')
check(bookingHistoryHref(['javascript:alert(1)'])==='/dashboard/history','Invalid route input never becomes a navigation payload')
const ids=Array.from({length:20},(_,i)=>a.slice(0,-2)+String(i).padStart(2,'0'))
const markup=renderToStaticMarkup(React.createElement(BookingOrderReferences,{ids}))
check(markup.includes('ดูอีก 17 รหัสรายการ')&&markup.includes('<details'),'Many bill references stay compact and remain accessible')
check(ids.every(id=>markup.includes(bookingReference(id,ids))),'Every original bill remains in expanded reference list')
fs.writeFileSync('.playwright/booking-ux-1/ux-five-20261023/reference-checks.json',JSON.stringify({passed:checks.length,checks},null,2));console.log(JSON.stringify({passed:checks.length}))

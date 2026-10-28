import {getBangkokDateKey} from './date-format'

export function adminMakeupCurrentMonth(now=new Date()) {
  return getBangkokDateKey(now)?.slice(0,7)||''
}

export function adminMakeupShiftMonth(month:string,delta:number) {
  if(!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(month)||!Number.isInteger(delta))return ''
  const index=Number(month.slice(0,4))*12+Number(month.slice(5))-1+delta
  const year=Math.floor(index/12),number=index%12+1
  return year>=1&&year<=9999?String(year).padStart(4,'0')+'-'+String(number).padStart(2,'0'):''
}

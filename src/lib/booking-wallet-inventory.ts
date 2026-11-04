import type {KidsFamilyMakeupState} from './kids-family-makeup'

export interface WalletInventorySource {
  id:string;bookingId:string;kind:'wallet'|'package';course:'kids_group'|'adult_group'|'private'
  participants:Array<string|null>;expires:string;policy:string;normal:boolean;groupId:string
  originalMonth:string|null;originalDate:string|null;validityMonths:number|null;makeupMonth:string|null
  quantity?:number
}
export interface WalletInventory {
  serverNow:string
  groups:Array<{key:string;total:number;source:WalletInventorySource}>
  sources:WalletInventorySource[]
  makeup:KidsFamilyMakeupState[]
}

/** A count is authoritative only when it belongs to this exact group. */
export function walletGroupBalance(group:{total:number},picked:number) {
  return Math.max(0,group.total-picked)
}

// One legacy Wallet source is redeemed as one continuous round. Family members
// share its duration; package sources remain one hour each.
export function walletSourceQuantity(source:{quantity?:number}) {
  return source.quantity ?? 1
}
export function walletDurationMatches(source:{course:string;quantity?:number},start:string,end:string) {
  if(source.course!=='private')return true
  const minutes=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(3,5))
  return minutes(end)-minutes(start)===walletSourceQuantity(source)*60
}

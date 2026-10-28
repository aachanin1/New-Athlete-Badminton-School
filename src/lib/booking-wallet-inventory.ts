import type {KidsFamilyMakeupState} from './kids-family-makeup'

export interface WalletInventorySource {
  id:string;bookingId:string;kind:'wallet'|'package';course:'kids_group'|'adult_group'|'private'
  participants:Array<string|null>;expires:string;policy:string;normal:boolean;groupId:string
  originalMonth:string|null;originalDate:string|null;validityMonths:number|null;makeupMonth:string|null
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

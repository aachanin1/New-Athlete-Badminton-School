export interface BranchDateClosure {
  id: string
  branch_id: string
  closure_date: string
  reason: string
  is_active: boolean
  updated_at: string
}

export function isBranchDateClosed(closures: Pick<BranchDateClosure, 'branch_id' | 'closure_date' | 'is_active'>[], branchId: string, date: string) {
  return closures.some(row => row.is_active && row.branch_id === branchId && row.closure_date === date)
}

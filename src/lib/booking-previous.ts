export interface PreviousBooking {
  course: string
  branchIds: string[]
  quantity: number
  packageId: string | null
  participants: Array<string | null>
}

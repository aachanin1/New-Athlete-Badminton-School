import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error: 'Admin booking on behalf of users is disabled. Users must create bookings and complete payment themselves.',
    },
    { status: 410 }
  )
}

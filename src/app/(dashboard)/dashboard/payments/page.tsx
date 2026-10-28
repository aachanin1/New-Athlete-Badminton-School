import { BookingPaymentClient } from '@/components/dashboard/booking-payment-client'
export default async function PendingPaymentPage({searchParams}:{searchParams:Promise<{legacy?:string}>}) { const query=await searchParams;return <BookingPaymentClient bulkIds={query.legacy?.split(',')}/> }

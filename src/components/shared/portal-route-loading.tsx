import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface PortalRouteLoadingProps {
  title?: string
  className?: string
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200', className)} />
}

export function PortalRouteLoading({
  title = 'กำลังโหลดข้อมูล...',
  className,
}: PortalRouteLoadingProps) {
  return (
    <div className={cn('space-y-5', className)} role="status" aria-live="polite">
      <div className="flex items-center gap-3 rounded-md border border-[#2748bf]/15 bg-white px-4 py-3 text-sm font-medium text-[#153c85] shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin text-[#f57e3b]" />
        <span>{title}</span>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="rounded-lg shadow-sm">
            <CardContent className="space-y-3 p-4">
              <SkeletonBlock className="h-4 w-2/3" />
              <SkeletonBlock className="h-8 w-1/2" />
              <SkeletonBlock className="h-3 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-lg shadow-sm">
        <CardContent className="space-y-4 p-4 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <SkeletonBlock className="h-5 w-48" />
              <SkeletonBlock className="h-3 w-64 max-w-full" />
            </div>
            <SkeletonBlock className="h-9 w-32" />
          </div>

          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="grid gap-3 rounded-md border border-slate-100 p-3 md:grid-cols-[1.2fr_.8fr_.8fr_120px]">
                <SkeletonBlock className="h-4 w-full" />
                <SkeletonBlock className="h-4 w-3/4" />
                <SkeletonBlock className="h-4 w-2/3" />
                <SkeletonBlock className="h-7 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

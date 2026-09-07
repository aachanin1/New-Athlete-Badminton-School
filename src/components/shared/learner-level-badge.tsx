import { Badge, type BadgeProps } from '@/components/ui/badge'
import { getLevelDisplay, UNASSESSED_LEVEL_BADGE_CLASS } from '@/constants/levels'
import { cn } from '@/lib/utils'

interface LearnerLevelBadgeProps extends BadgeProps {
  level: number | null | undefined
}

/** Keep each assessed-level presentation; centralize only the unassessed label. */
export function LearnerLevelBadge({ level, children, className, ...props }: LearnerLevelBadgeProps) {
  const display = getLevelDisplay(level)
  const unassessed = display.level === 0
  return (
    <Badge {...props} className={cn(className, unassessed && UNASSESSED_LEVEL_BADGE_CLASS)}>
      {unassessed ? display.label : children}
    </Badge>
  )
}

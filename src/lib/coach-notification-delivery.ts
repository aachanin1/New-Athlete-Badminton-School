interface NotificationError {
  message: string
}

interface AssignmentReviewNotificationInput {
  title: string
  message: string
  linkUrl: string
}

interface HeadCoachAssignmentReviewNotificationInput extends AssignmentReviewNotificationInput {
  branchId: string
}

interface CoachNotificationInput {
  userId: string
  title: string
  message: string
  type?: string
  linkUrl?: string | null
}

interface HeadCoachBranchRow {
  coach_id: string
  profiles?: { role: string | null } | null
}

type QueryChain<T> = PromiseLike<T> & {
  eq: (column: string, value: string) => QueryChain<T>
  in: (column: string, values: readonly string[]) => QueryChain<T>
  is: (column: string, value: null) => QueryChain<T>
  limit: (count: number) => QueryChain<T>
}

interface NotificationDeliveryClient {
  from: (table: string) => {
    select: (columns: string) => QueryChain<{
      data: { id: string }[] | HeadCoachBranchRow[] | null
      error: NotificationError | null
    }>
    insert?: (values: Record<string, unknown>) => PromiseLike<{
      error: NotificationError | null
    }>
  }
}

export interface CoachNotificationDeliveryResult {
  userId: string
  success: boolean
  skipped: boolean
  stage: 'existence_check' | 'insert' | 'complete'
  error: NotificationError | null
}

export interface AssignmentReviewNotificationReport {
  success: boolean
  recipientIds: string[]
  recipientLookupError: NotificationError | null
  recipientEmpty: boolean
  deliveries: CoachNotificationDeliveryResult[]
}

export type AssignmentReviewAudience =
  | 'admin'
  | 'new_branch_head_coach'
  | 'old_branch_head_coach'

export interface AssignmentReviewAudienceReport {
  audience: AssignmentReviewAudience
  report: AssignmentReviewNotificationReport
}

export interface AssignmentReviewNotificationFailure {
  audience: AssignmentReviewAudience | 'context' | 'unexpected'
  stage:
    | 'recipient_lookup'
    | 'recipient_empty'
    | 'existence_check'
    | 'insert'
    | 'context_lookup'
    | 'unexpected'
  message: string
  userId?: string
}

export interface RescheduleAssignmentNotificationSummary {
  success: boolean
  requiredAudienceCount: number
  recipientCount: number
  attemptCount: number
  successfulRecipientCount: number
  skippedCount: number
  failedRecipientCount: number
  audienceFailureCount: number
  failureCount: number
  failures: AssignmentReviewNotificationFailure[]
}

function normalizeError(error: unknown, fallback: string): NotificationError {
  return { message: error instanceof Error ? error.message : fallback }
}

async function notificationExists(
  client: NotificationDeliveryClient,
  notification: CoachNotificationInput,
) {
  let query = client
    .from('notifications')
    .select('id')
    .eq('user_id', notification.userId)
    .eq('title', notification.title)
    .eq('message', notification.message)

  query = notification.linkUrl
    ? query.eq('link_url', notification.linkUrl)
    : query.is('link_url', null)

  const { data, error } = await query.limit(1)
  return { exists: Boolean(data?.length), error }
}

export async function deliverCoachNotificationOnce(
  clientInput: unknown,
  notification: CoachNotificationInput,
): Promise<CoachNotificationDeliveryResult> {
  const client = clientInput as NotificationDeliveryClient
  let lookup: Awaited<ReturnType<typeof notificationExists>>
  try {
    lookup = await notificationExists(client, notification)
  } catch (error) {
    return {
      userId: notification.userId,
      success: false,
      skipped: false,
      stage: 'existence_check',
      error: normalizeError(error, 'Unknown notification existence-check failure'),
    }
  }

  if (lookup.error) return {
    userId: notification.userId,
    success: false,
    skipped: false,
    stage: 'existence_check',
    error: lookup.error,
  }
  if (lookup.exists) return {
    userId: notification.userId,
    success: true,
    skipped: true,
    stage: 'complete',
    error: null,
  }

  const notificationTable = client.from('notifications')
  if (!notificationTable.insert) return {
    userId: notification.userId,
    success: false,
    skipped: false,
    stage: 'insert',
    error: { message: 'Notification insert is unavailable' },
  }

  try {
    const { error } = await notificationTable.insert({
      user_id: notification.userId,
      title: notification.title,
      message: notification.message,
      type: notification.type || 'system',
      link_url: notification.linkUrl || null,
    })
    return {
      userId: notification.userId,
      success: !error,
      skipped: false,
      stage: error ? 'insert' : 'complete',
      error,
    }
  } catch (error) {
    return {
      userId: notification.userId,
      success: false,
      skipped: false,
      stage: 'insert',
      error: normalizeError(error, 'Unknown notification insert failure'),
    }
  }
}

async function deliverAssignmentReviewRecipients(
  client: NotificationDeliveryClient,
  recipientIds: string[],
  input: AssignmentReviewNotificationInput,
): Promise<AssignmentReviewNotificationReport> {
  const deliveries = await Promise.all(recipientIds.map((userId) => (
    deliverCoachNotificationOnce(client, {
      userId,
      title: input.title,
      message: input.message,
      type: 'schedule',
      linkUrl: input.linkUrl,
    })
  )))

  return {
    success: recipientIds.length > 0 && deliveries.every((delivery) => delivery.success),
    recipientIds,
    recipientLookupError: null,
    recipientEmpty: recipientIds.length === 0,
    deliveries,
  }
}

function recipientLookupFailure(error: NotificationError): AssignmentReviewNotificationReport {
  return {
    success: false,
    recipientIds: [],
    recipientLookupError: error,
    recipientEmpty: false,
    deliveries: [],
  }
}

export async function deliverAdminAssignmentReviewNotifications(
  clientInput: unknown,
  input: AssignmentReviewNotificationInput,
): Promise<AssignmentReviewNotificationReport> {
  const client = clientInput as NotificationDeliveryClient
  let result: {
    data: { id: string }[] | null
    error: NotificationError | null
  }
  try {
    result = await client
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'super_admin']) as typeof result
  } catch (error) {
    return recipientLookupFailure(normalizeError(error, 'Unknown Admin recipient lookup failure'))
  }

  if (result.error) return recipientLookupFailure(result.error)

  const recipientIds = Array.from(new Set(
    (result.data || []).map((row) => row.id).filter(Boolean),
  ))
  return deliverAssignmentReviewRecipients(client, recipientIds, input)
}

export async function deliverHeadCoachAssignmentReviewNotifications(
  clientInput: unknown,
  input: HeadCoachAssignmentReviewNotificationInput,
): Promise<AssignmentReviewNotificationReport> {
  const client = clientInput as NotificationDeliveryClient
  let result: {
    data: HeadCoachBranchRow[] | null
    error: NotificationError | null
  }
  try {
    result = await client
      .from('coach_branches')
      .select('coach_id, profiles!coach_branches_coach_id_fkey(role)')
      .eq('branch_id', input.branchId) as typeof result
  } catch (error) {
    return recipientLookupFailure(normalizeError(error, 'Unknown Head Coach recipient lookup failure'))
  }

  if (result.error) return recipientLookupFailure(result.error)

  const headCoachIds = Array.from(new Set(
    (result.data || [])
      .filter((row) => row.profiles?.role === 'head_coach')
      .map((row) => row.coach_id)
      .filter(Boolean),
  ))
  return deliverAssignmentReviewRecipients(client, headCoachIds, input)
}

export function summarizeAssignmentReviewNotifications(
  audienceReports: AssignmentReviewAudienceReport[],
  initialFailures: AssignmentReviewNotificationFailure[] = [],
  requiredAudienceCount = audienceReports.length,
): RescheduleAssignmentNotificationSummary {
  const failures = [...initialFailures]
  let recipientCount = 0
  let attemptCount = 0
  let successfulRecipientCount = 0
  let skippedCount = 0
  let failedRecipientCount = 0

  audienceReports.forEach(({ audience, report }) => {
    recipientCount += report.recipientIds.length
    attemptCount += report.deliveries.length
    successfulRecipientCount += report.deliveries.filter((delivery) => delivery.success).length
    skippedCount += report.deliveries.filter((delivery) => delivery.skipped).length
    failedRecipientCount += report.deliveries.filter((delivery) => !delivery.success).length

    if (report.recipientLookupError) failures.push({
      audience,
      stage: 'recipient_lookup',
      message: report.recipientLookupError.message,
    })
    if (report.recipientEmpty) failures.push({
      audience,
      stage: 'recipient_empty',
      message: `Required ${audience} recipient set is empty`,
    })
    report.deliveries.forEach((delivery) => {
      if (!delivery.success) failures.push({
        audience,
        stage: delivery.stage === 'insert' ? 'insert' : 'existence_check',
        message: delivery.error?.message || 'Unknown notification delivery failure',
        userId: delivery.userId,
      })
    })
  })

  return {
    success: failures.length === 0,
    requiredAudienceCount,
    recipientCount,
    attemptCount,
    successfulRecipientCount,
    skippedCount,
    failedRecipientCount,
    audienceFailureCount: failures.length - failedRecipientCount,
    failureCount: failures.length,
    failures,
  }
}

export function buildRescheduleSuccessResponse(
  sessionId: string,
  scheduleSlotId: string,
  notificationSummary: RescheduleAssignmentNotificationSummary,
) {
  return {
    success: true as const,
    sessionId,
    scheduleSlotId,
    warning: notificationSummary.success
      ? null
      : {
          code: 'ASSIGNMENT_REVIEW_NOTIFICATION_FAILED' as const,
          message: 'เปลี่ยนรอบสำเร็จแล้ว แต่การแจ้งเตือนผู้ตรวจการมอบหมายส่งไม่ครบ กรุณาตรวจหน้าจัดกลุ่มโค้ช',
        },
  }
}

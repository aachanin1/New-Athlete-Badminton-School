// Recovery artifacts change this literal through the reviewed deterministic
// overlay. This is enforced by the server, independently of client payloads.
export const reviewRequestsReadOnly = false

export function isLegacyReviewSend(action: unknown): boolean {
  return action === 'request_coach_review' || action === 'request_coach_evidence'
}

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  COACH_ASSIGNMENT_SAVE_TEMPORARILY_DISABLED,
  COACH_ASSIGNMENT_SAVE_TEMPORARILY_DISABLED_MESSAGE,
  CONTAINED_ADMIN_MAKEUP_ASSIGNMENT_ACTIONS,
  getCoachAssignmentWriteContainmentPayload,
  isCoachAssignmentWriteContainmentEnabled,
  isContainedAdminMakeupAssignmentAction,
} from '../src/lib/coach-assignment-write-containment.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const headCoachRoute = read('src/app/api/coach/assignment-groups/route.ts')
const adminMakeupRoute = read('src/app/api/admin/makeup/route.ts')

let passed = 0
function check(name, action) {
  action()
  passed += 1
  console.log(`PASS ${passed}: ${name}`)
}

check('containment response contract is stable and explicit', () => {
  assert.deepEqual(getCoachAssignmentWriteContainmentPayload(), {
    code: 'COACH_ASSIGNMENT_SAVE_TEMPORARILY_DISABLED',
    error: 'ปิดการบันทึกกลุ่มชั่วคราวเพื่อปรับปรุงความปลอดภัย ข้อมูลเดิมยังคงอยู่ กรุณาอย่าสร้างหรือมอบหมายกลุ่มซ้ำ',
  })
  assert.equal(COACH_ASSIGNMENT_SAVE_TEMPORARILY_DISABLED, 'COACH_ASSIGNMENT_SAVE_TEMPORARILY_DISABLED')
  assert.equal(COACH_ASSIGNMENT_SAVE_TEMPORARILY_DISABLED_MESSAGE.includes('ข้อมูลเดิมยังคงอยู่'), true)
  assert.equal(isCoachAssignmentWriteContainmentEnabled(), true)
})

check('Head Coach authentication and branch authorization remain before containment', () => {
  const authIndex = headCoachRoute.indexOf('const manager = await requireAssignmentManager(supabase)')
  const unauthorizedIndex = headCoachRoute.indexOf("if (!manager) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })")
  const branchAuthorizationIndex = headCoachRoute.indexOf(".from('coach_branches')")
  const containmentIndex = headCoachRoute.indexOf('if (isCoachAssignmentWriteContainmentEnabled())')
  assert.ok(authIndex >= 0 && authIndex < unauthorizedIndex)
  assert.ok(unauthorizedIndex < branchAuthorizationIndex)
  assert.ok(branchAuthorizationIndex < containmentIndex)
})

check('Head Coach containment is before the first assignment mutation', () => {
  const containmentIndex = headCoachRoute.indexOf('if (isCoachAssignmentWriteContainmentEnabled())')
  const groupDeleteIndex = headCoachRoute.indexOf(".from('coach_assignment_groups')", containmentIndex)
  const legacyDeleteIndex = headCoachRoute.indexOf(".from('coach_assignments')", containmentIndex)
  assert.ok(containmentIndex >= 0 && containmentIndex < groupDeleteIndex)
  assert.ok(containmentIndex < legacyDeleteIndex)
})

check('only the four approved Admin Makeup assignment actions are blocked globally', () => {
  assert.deepEqual([...CONTAINED_ADMIN_MAKEUP_ASSIGNMENT_ACTIONS], [
    'move_learner_to_existing_coach_group',
    'replace_coach_for_past_round',
    'assign_coach_to_round',
    'resolve_unassigned_round',
  ])
  for (const action of CONTAINED_ADMIN_MAKEUP_ASSIGNMENT_ACTIONS) {
    assert.equal(isContainedAdminMakeupAssignmentAction(action), true)
  }
  for (const action of ['confirm_absent', 'request_coach_review', 'request_coach_evidence', 'close_review', 'return_entitlement', 'mark_attendance']) {
    assert.equal(isContainedAdminMakeupAssignmentAction(action), false)
  }
})

check('Admin Makeup menu authorization remains before the assignment-action lock', () => {
  const authIndex = adminMakeupRoute.indexOf("const access = await requireAdminMenuAccess('makeup')")
  const deniedIndex = adminMakeupRoute.indexOf('if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status })')
  const containmentIndex = adminMakeupRoute.indexOf('if (isContainedAdminMakeupAssignmentAction(action))')
  const firstBlockedActionIndex = adminMakeupRoute.indexOf("if (action === 'move_learner_to_existing_coach_group')")
  assert.ok(authIndex >= 0 && authIndex < deniedIndex)
  assert.ok(deniedIndex < containmentIndex)
  assert.ok(containmentIndex < firstBlockedActionIndex)
})

check('mark_attendance is blocked only when it would create a retrospective exact group', () => {
  const predicate = "if (!hasAssignedCoach && action === 'mark_attendance')"
  const predicateIndex = adminMakeupRoute.indexOf(predicate)
  const containmentIndex = adminMakeupRoute.indexOf(
    'return NextResponse.json(getCoachAssignmentWriteContainmentPayload(), { status: 503 })',
    predicateIndex
  )
  const assignmentMutationIndex = adminMakeupRoute.indexOf('retrospectiveGroupId = await ensureRetrospectiveAssignment', predicateIndex)
  assert.ok(predicateIndex >= 0)
  assert.ok(predicateIndex < containmentIndex)
  assert.ok(containmentIndex < assignmentMutationIndex)
})

check('both containment responses are explicit HTTP 503 responses', () => {
  assert.equal((headCoachRoute.match(/getCoachAssignmentWriteContainmentPayload\(\), \{ status: 503 \}/g) || []).length, 1)
  assert.equal((adminMakeupRoute.match(/getCoachAssignmentWriteContainmentPayload\(\), \{ status: 503 \}/g) || []).length, 2)
})

console.log(`Coach assignment write containment checks passed: ${passed}`)

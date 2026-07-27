import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  createCoachAttendanceGapNotifications,
  createCoachCheckinWindowNotifications,
  notifyAssignedCoachesForSlot,
  notifyCoachCheckinAttendanceReminder,
  notifyCoachOnce,
} from '../src/lib/coach-notifications.ts'
import {
  addCalendarDaysToDateKey,
  formatNotificationSlotDateTime,
  getBangkokDateKey,
} from '../src/lib/date-format.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const dateFormatUrl = pathToFileURL(path.join(root, 'src/lib/date-format.ts')).href

let passed = 0
async function check(name, action) {
  await action()
  passed += 1
  console.log(`PASS ${passed}: ${name}`)
}

class FakeQuery {
  constructor(client, table) {
    this.client = client
    this.table = table
    this.filters = []
  }

  select() { return this }
  eq(column, value) { this.filters.push(['eq', column, value]); return this }
  is(column, value) { this.filters.push(['is', column, value]); return this }
  gte(column, value) { this.filters.push(['gte', column, value]); return this }
  lte(column, value) { this.filters.push(['lte', column, value]); return this }
  in(column, value) { this.filters.push(['in', column, value]); return this }
  limit() { return this }

  insert(values) {
    this.client.mutations.push({ table: this.table, operation: 'insert' })
    const rows = Array.isArray(values) ? values : [values]
    this.client.inserted[this.table] ||= []
    this.client.inserted[this.table].push(...rows.map((row, index) => ({
      id: `inserted-${this.client.inserted[this.table].length + index + 1}`,
      ...row,
    })))
    return Promise.resolve({ error: null })
  }

  then(resolve, reject) {
    try {
      this.client.queries.push({ table: this.table, filters: this.filters })
      let data = this.table === 'notifications'
        ? this.client.inserted.notifications || []
        : this.client.rows[this.table] || []

      for (const [operator, column, value] of this.filters) {
        if (operator === 'eq' && !column.includes('.')) data = data.filter((row) => row[column] === value)
        if (operator === 'is') data = data.filter((row) => row[column] === value)
        if (operator === 'in') data = data.filter((row) => value.includes(row[column]))
      }

      resolve({ data, error: null })
    } catch (error) {
      reject(error)
    }
  }
}

class FakeSupabase {
  constructor(rows = {}) {
    this.rows = rows
    this.inserted = { notifications: [] }
    this.queries = []
    this.mutations = []
  }

  from(table) {
    return new FakeQuery(this, table)
  }
}

const slot = {
  id: 'slot-2026-07-26-17-19',
  date: '2026-07-26',
  start_time: '17:00:00',
  end_time: '19:00:00',
  branches: { name: 'รามอินทรา' },
  course_types: { name: 'Kids Group' },
}

const group = {
  id: 'group-1',
  coach_id: 'coach-1',
  schedule_slot_id: slot.id,
  schedule_slots: slot,
  coach_assignment_group_students: [
    { booking_session_id: 'session-1', student_id: 'student-1' },
    { booking_session_id: 'session-2', student_id: 'student-2' },
    { booking_session_id: 'session-3', student_id: 'student-3' },
  ],
}

function runFormatterInTimezone(timeZone) {
  const script = `import { formatNotificationSlotDateTime } from ${JSON.stringify(dateFormatUrl)}; process.stdout.write(formatNotificationSlotDateTime('2026-07-26','17:00:00','19:00:00'))`
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: root,
    env: { ...process.env, TZ: timeZone, NODE_NO_WARNINGS: '1' },
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout
}

await check('date-only slot renders as 26 ก.ค. 69 under TZ=UTC', () => {
  assert.equal(runFormatterInTimezone('UTC'), '26 ก.ค. 69 17:00-19:00')
})

await check('date-only slot renders identically under TZ=Asia/Bangkok', () => {
  assert.equal(runFormatterInTimezone('Asia/Bangkok'), '26 ก.ค. 69 17:00-19:00')
})

await check('calendar lookback subtracts 14 date-key days without UTC shift', () => {
  assert.equal(addCalendarDaysToDateKey('2026-07-27', -14), '2026-07-13')
})

await check('assignment notification message and link keep the same slot date', async () => {
  const fake = new FakeSupabase()
  await notifyAssignedCoachesForSlot(fake, { coachIds: ['coach-1'], slot, groupCount: 1, studentCount: 3 })
  const [notification] = fake.inserted.notifications
  assert.match(notification.message, /26 ก\.ค\. 69 17:00-19:00/)
  assert.doesNotMatch(notification.message, /25 ก\.ค\. 69/)
  assert.equal(notification.link_url, '/coach/today?date=2026-07-26')
  assert.equal(notification.link_url.slice(-10), slot.date)
})

await check('check-in-success notification uses the Bangkok slot date', async () => {
  const fake = new FakeSupabase()
  await notifyCoachCheckinAttendanceReminder(fake, 'coach-1', slot)
  const [notification] = fake.inserted.notifications
  assert.equal(notification.title, 'เช็คอินสำเร็จ อย่าลืมเช็คชื่อ')
  assert.match(notification.message, /26 ก\.ค\. 69 17:00-19:00/)
  assert.equal(notification.link_url, `/coach/attendance?date=${slot.date}&slot=${slot.id}`)
})

await check('check-in-window notification uses the Bangkok slot date', async () => {
  const fake = new FakeSupabase({
    coach_assignment_groups: [group],
    coach_checkins: [],
  })
  await createCoachCheckinWindowNotifications(fake, 'coach-1', {
    now: new Date('2026-07-26T09:55:00.000Z'),
  })
  const [notification] = fake.inserted.notifications
  assert.equal(notification.title, 'ถึงเวลาเช็คอินรอบสอน')
  assert.match(notification.message, /26 ก\.ค\. 69 17:00-19:00/)
})

await check('attendance-gap notification uses the correct date and missing count', async () => {
  const fake = new FakeSupabase({
    coach_assignment_groups: [group],
    coach_checkins: [{ coach_id: 'coach-1', schedule_slot_id: slot.id }],
    attendance: [{ booking_session_id: 'session-1', student_id: 'student-1' }],
  })
  await createCoachAttendanceGapNotifications(fake, 'coach-1', {
    lookbackDays: 14,
    now: new Date('2026-07-27T05:00:00.000Z'),
  })
  const [notification] = fake.inserted.notifications
  assert.equal(notification.title, 'ยังเช็คชื่อนักเรียนไม่ครบ')
  assert.match(notification.message, /26 ก\.ค\. 69 17:00-19:00/)
  assert.match(notification.message, /ขาดการเช็คชื่อ 2 คน/)
  assert.equal(notification.link_url, `/coach/attendance?date=${slot.date}&slot=${slot.id}`)
  const groupQuery = fake.queries.find((query) => query.table === 'coach_assignment_groups')
  assert.ok(groupQuery.filters.some(([operator, column, value]) => operator === 'gte' && column === 'schedule_slots.date' && value === '2026-07-13'))
})

await check('fresh identical Coach notification generation remains idempotent', async () => {
  const fake = new FakeSupabase()
  const input = {
    userId: 'coach-1',
    title: 'ทดสอบการแจ้งเตือน',
    message: '26 ก.ค. 69 17:00-19:00',
    type: 'reminder',
    linkUrl: '/coach/today?date=2026-07-26',
  }
  const first = await notifyCoachOnce(fake, input)
  const second = await notifyCoachOnce(fake, input)
  assert.equal(first.skipped, false)
  assert.equal(second.skipped, true)
  assert.equal(fake.inserted.notifications.length, 1)
})

await check('Bangkok early-morning today boundary ignores the previous UTC date key', () => {
  const now = new Date('2026-07-26T18:30:00.000Z')
  const todayDateKey = getBangkokDateKey(now)
  const createdAtValues = [
    '2026-07-26T16:59:59.000Z',
    '2026-07-26T17:00:00.000Z',
    '2026-07-26T18:00:00.000Z',
  ]
  assert.equal(todayDateKey, '2026-07-27')
  assert.equal(createdAtValues.filter((value) => getBangkokDateKey(value) === todayDateKey).length, 2)
})

await check('Coach Attendance absent/late label uses the shared Bangkok formatter', () => {
  const route = read('src/app/api/coach/attendance/route.ts')
  assert.equal(formatNotificationSlotDateTime('2026-07-26', '17:00:00', '19:00:00'), '26 ก.ค. 69 17:00-19:00')
  assert.match(route, /formatNotificationSlotDateTime\(slot\.date, slot\.start_time, slot\.end_time\)/)
  assert.match(route, /const slotLabel = authContext\.slotLabel/)
})

await check('Lesson Wallet old and new round labels use Bangkok date-only values', () => {
  const route = read('src/app/api/lesson-wallet/route.ts')
  assert.equal(formatNotificationSlotDateTime('2026-07-26', '17:00:00', '19:00:00'), '26 ก.ค. 69 17:00-19:00')
  assert.equal(formatNotificationSlotDateTime('2026-07-27', '17:00:00', '19:00:00'), '27 ก.ค. 69 17:00-19:00')
  assert.match(route, /const oldLabel = slotLabel\(credit\.original_date/)
  assert.match(route, /const newLabel = slotLabel\(targetDate/)
  assert.match(route, /return formatNotificationSlotDateTime\(date, startTime, endTime\)/)
})

await check('unsafe notification date patterns are absent from the scoped producers', () => {
  for (const relativePath of [
    'src/lib/coach-notifications.ts',
    'src/app/api/coach/attendance/route.ts',
    'src/app/api/lesson-wallet/route.ts',
    'src/components/dashboard/notifications-client.tsx',
  ]) {
    const source = read(relativePath)
    assert.doesNotMatch(source, /T00:00:00\+07:00.*toLocaleDateString/s, relativePath)
    assert.doesNotMatch(source, /toISOString\(\)\.split\('T'\)\[0\]/, relativePath)
  }
})

await check('formatter regression exercises no business-table mutation', async () => {
  const fake = new FakeSupabase()
  await notifyAssignedCoachesForSlot(fake, { coachIds: ['coach-1'], slot, groupCount: 1, studentCount: 3 })
  assert.deepEqual(Array.from(new Set(fake.mutations.map((mutation) => mutation.table))), ['notifications'])
  for (const forbidden of ['attendance', 'booking_sessions', 'bookings', 'lesson_wallet_credits', 'payments', 'coach_assignment_groups']) {
    assert.equal(fake.mutations.some((mutation) => mutation.table === forbidden), false)
  }
})

console.log(`\nNotification Bangkok date consistency checks passed: ${passed}`)

import assert from 'node:assert/strict'
import {bangkokMonthKey,packageExpiryAt,packageRoundWithinExpiry,packageValidityDescription} from '../src/lib/booking-package-validity.ts'
const terms=months=>({quantity:10,validity_months:months})
const cases=[
 ['2026-10-26T00:00:00Z',6,'2027-03-31T16:59:59.999Z'],
 ['2026-10-31T16:59:59.999Z',6,'2027-03-31T16:59:59.999Z'],
 ['2026-10-31T17:00:00Z',6,'2027-04-30T16:59:59.999Z'],
 ['2026-10-26T00:00:00Z',10,'2027-07-31T16:59:59.999Z'],
 ['2026-10-26T00:00:00Z',12,'2027-09-30T16:59:59.999Z'],
 ['2027-09-15T00:00:00Z',6,'2028-02-29T16:59:59.999Z'],
 ['2026-09-15T00:00:00Z',6,'2027-02-28T16:59:59.999Z'],
 ['2026-10-01T00:00:00Z',120,'2036-09-30T16:59:59.999Z'],
]
for(const [reference,months,expected]of cases)assert.equal(packageExpiryAt(terms(months),reference),expected)
const expiry=cases[0][2]
assert.equal(packageRoundWithinExpiry(expiry,'2027-03-31','23:59'),true)
assert.equal(packageRoundWithinExpiry(expiry,'2027-04-01','00:00'),false)
assert.equal(packageExpiryAt({quantity:1,validity_months:1},cases[0][0]),null)
assert.throws(()=>packageExpiryAt(terms(0),cases[0][0]))
assert.equal(bangkokMonthKey('2026-10-31T17:00:00Z'),'2026-11')
assert.match(packageValidityDescription(terms(6),cases[0][0]),/31 มี.ค. 2570/)
assert.match(packageValidityDescription(terms(6),cases[0][0],expiry),/ใช้ได้ถึง 31 มี.ค. 2570/)
assert.ok(!packageValidityDescription(terms(6),cases[0][0],expiry).includes('หาก'))
console.log(JSON.stringify({passed:16,coverage:'Bangkok month boundary; inclusive expiry; leap years; per-bill term; confirmed/estimated copy'}))

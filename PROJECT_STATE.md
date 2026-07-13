# PROJECT_STATE.md - Current Project Snapshot

Last updated: 2026-07-13
Source: local source/git/docs audit plus read-only Vercel CLI and Production
Supabase read-model verification. Items not confirmed are marked
`Unknown / Need verification`.

## Current Source of Truth

New Athlete Badminton School is a multi-portal badminton school management app.
The repo currently uses Next.js 16.2.6 App Router, React 18, TypeScript 5,
TailwindCSS 3.4, shadcn/Radix UI, Supabase, and SlipOK.

### Owner Policy

- Owner confirmed on 2026-07-12 that Progressive replaces Legacy for general Kids
  Group Production traffic. Deploy, environment/flag/allowlist changes, Production
  UAT writes, and Production data repair were not approved in that audit round; the
  later one-row repair approval is recorded separately below.
- Owner-approved Progressive Kids Group pricing is booking-level pricing, not
  Legacy monthly true-up:
  - `previousActiveSessions` = active entitlement sessions ordered before the new booking.
  - `cumulativeAfter = previousActiveSessions + newBookingSessions`.
  - `grossBookingPrice = newBookingSessions * rateOf(cumulativeAfter)`.
  - Apply the current booking's coupon after gross pricing; do not retroactively
    reprice prior bookings or create a monthly price-difference credit.
- Historical review and any future repair proposal are limited to genuinely unpaid
  Kids Group bookings. Paid, approved-payment, and verified bookings must not be
  reopened or repriced in this round.
- Owner-approved one-row Production repair for unpaid booking
  `d6dad7aa-3e20-4f78-93e0-a7638fc1bb40`, `550 -> 625`, completed on 2026-07-13
  after a fresh dependency audit. No paid or verified booking was reopened.
- Confirmed examples from the supplied Owner instruction and executable Progressive
  scenario checks:
  - one booking of 10 sessions = `5,000`;
  - split `5+5` = `3,125 + 2,500 = 5,625`;
  - ten separate one-session bookings = `5,825`.
- Evidence: `src/lib/progressive-booking-pricing.ts`,
  `scripts/check-progressive-booking-pricing.js`, and the 2026-07-12 Owner
  documentation-reconciliation instruction. A separately named design document
  containing “Formula And Ordering / Scenario Matrix” was not present in the repo:
  `Unknown / Need verification`.

### Legacy Runtime

- Legacy Kids Group pricing remains a different monthly true-up formula in
  `src/lib/pricing.ts` and `src/lib/booking-pricing.ts`:
  - count only settled `paid` and `verified` bookings for existing history;
  - `cumulativeAfter = existingSettledSessions + newSessions`;
  - `targetMonthlyTotal = cumulativeAfter * rateOf(cumulativeAfter)`;
  - `charge = max(0, targetMonthlyTotal - existingSettledTotal)`;
  - an overpaid result becomes `creditDifference`; it is not the Progressive formula.
- With the fallback tier examples used by deterministic tests:
  - Legacy `5+5` = `3,125 + 1,875 = 5,000`;
  - Legacy ten settled one-session bookings total `5,000` after true-up/credit effects;
  - Legacy `8+8` = `4,000 + 2,496 = 6,496`.
- DB `pricing_tiers` remains price authority; the figures above are verified test
  examples, not permission to hardcode Production tiers.
- Verified Production entry state (2026-07-12): the Progressive source is deployed,
  but all Progressive control variables and the UUID allowlist variable are absent,
  so general users and Adult/Private bookings still enter Legacy.

### Progressive Runtime

- Current general-traffic gating source commit is
  `5c8cee1e8a81f928b870e643a78e1d2baf39fa06`, committed and pushed to
  `origin/spike/next-major-security-upgrade`.
- Current source entry decision is server-only and default deny:
  - Entry disabled -> all new bookings remain Legacy.
  - Entry enabled + server-resolved `kids_group` -> Progressive for general users;
    no per-user UUID allowlist is required.
  - Entry enabled + missing pricing-write, coupon-lifecycle, or payment-batch
    dependency -> typed `503`, no Legacy fallback or partial write.
  - `adult_group` and `private` -> Legacy.
  - Existing Progressive edit/cancel remains routed by stored `pricing_scope_id`.
    Payment prepare/upload/submit/status/cancel uses authenticated ownership and
    dependency readiness, so existing bookings can drain after Entry is disabled.
- UUID allowlist parsing remains available as staged/test infrastructure, but it is
  not a general-customer eligibility or authorization boundary.
- Source complete: **yes** for general Kids Group gating.
- Committed: **yes**, `5c8cee1`. Pushed: **yes**.
- Deployed for the new general gating source: **yes**. Production currently runs
  `5c8cee1` in rollback deployment `dpl_F2gfntqNX8ZiR5yr5dPB6UdeX8Fe`.
- Dependency controls enabled: **yes** for pricing writes, coupon lifecycle,
  payment batch, and payment review. Entry is explicitly `false` after the
  approved primary rollback.
- Allowlisted: **no**; `PROGRESSIVE_PAYMENT_ALLOWED_USER_IDS` is absent. No UUID
  values were read or exposed.
- Production active for new general Kids Group entry: **no**, because Entry was
  rolled back off. UAT Stage A passed. Stage B created one Progressive test booking
  and one prepared batch, but payment completion is blocked by Chrome file-upload
  permission and is not passed.
- Local verification passed: booking entry `23`, pricing `17`, transactions `33`,
  coupon `38`, payment batches `39`, payment integration `18`, shared SlipOK `6`,
  Legacy pricing `14`, TypeScript, ESLint, mojibake, and Production build. Post-build
  dev/browser/static-asset verification also passed.
- Five Progressive migrations and all four capability RPCs are deployed/Ready.

### Production

- Current deployment: `dpl_F2gfntqNX8ZiR5yr5dPB6UdeX8Fe`, Ready, created
  2026-07-13 09:54 ICT, functional source SHA
  `5c8cee1e8a81f928b870e643a78e1d2baf39fa06`.
- Production aliases: `https://www.newathleteschool.com`,
  `https://new-athlete-badminton-school.vercel.app`,
  `https://new-athlete-badminton-school-aachanin1s-projects.vercel.app`, and
  `https://new-athlete-badminton-school-aachanin1-aachanin1s-projects.vercel.app`.
- Production controls: pricing writes `true`, coupon lifecycle `true`, payment
  batch `true`, payment review `true`, Entry `false`. The UUID allowlist remains
  absent and was not read. Entry was enabled only for controlled UAT, then disabled
  through the approved primary rollback when browser upload permission blocked
  payment completion.
- Shared Owner-approved payment policy remains server-side
  `SLIPOK_TEST_MODE=true` for both Legacy and Progressive. A successful upload uses
  the normal auto-approve/verify transition and makes no live SlipOK request.

### Pricing Reconciliation Status

**BLOCKER — ENTRY DISABLED; PROGRESSIVE ROLLOUT ROLLED BACK SAFELY**

- Owner policy, Progressive formula, pushed source, and the approved one-row repair
  agree. The earlier scoped `PASS` covered source readiness and that data repair,
  not the incomplete Production rollout.
- New source `5c8cee1` is deployed and dependency-ready, but Entry is disabled, so
  new general Production traffic currently returns to Legacy while the created
  Progressive UAT booking can drain by stored scope.
- Data repaired: **yes**, exactly one unpaid booking. Source/deploy/activation state
  did not change during the repair.
- `DOCUMENTATION DRIFT` was found: the previous snapshot said `56daabf` was not
  deployed and current Vercel state was unknown. Read-only CLI verification proves
  it is deployed, while enabled/allowlisted/Production-active states remain false.
- UAT rows preserved: booking `89533cdf-76cf-4ee5-bb66-ce7bf7bbf5fe`, pricing
  scope `f4acca6c-86b9-44da-88cc-86d8222f28c3`, session
  `34ad024d-59f3-409d-b431-36e2765f9737`, and prepared batch
  `eb5a1c73-fceb-4fd1-b6e6-414fc3fe1410`. No slip, attempt, allocation, payment,
  coupon, or ledger row was created.

### 2026-07-12 Read-Only Unpaid Kids Group Audit

- Exact scope: all `454` Production Kids Group bookings across 2026-05 through
  2026-08; status counts were `415 verified`, `33 cancelled`, and
  `6 pending_payment`. Dependencies checked for every pending candidate:
  `payments`, `coupon_usages`, `progressive_coupon_reservations`,
  `lesson_wallet_credits`, `booking_sessions`, `attendance`, Progressive payment
  batch links/allocations, `payment_ledger_allocations_v1`, and `pricing_tiers`.
- All six candidates are genuinely unpaid: zero payment/ledger evidence, coupons,
  wallet rows, attendance, batch links, or allocations. Their booking sessions are
  still `scheduled`. Legacy rows have no Progressive pricing snapshots, so expected
  amounts were reconstructed from current authoritative Production `pricing_tiers`
  and active ordering by `created_at`, then booking id.

| Booking | Period/order | Sessions | Legacy | Progressive | Difference | Dependency result |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `e63fd262-fa64-4d8c-96ae-e0ff979a29e3` | 2026-06, #1 | 4 | `2,500` | `2,500` | `0` | 4 scheduled sessions; all checked dependencies `0` |
| `fbdf5523-0cb6-4a4f-985d-f5c5cea4abd7` | 2026-06, #1 | 7 | `3,500` | `3,500` | `0` | 7 scheduled sessions; all checked dependencies `0` |
| `4b0813ef-f386-4e6f-9b8d-1b11f861ec5c` | 2026-07, #1 | 2 | `1,250` | `1,250` | `0` | 2 scheduled sessions; all checked dependencies `0` |
| `d6dad7aa-3e20-4f78-93e0-a7638fc1bb40` | 2026-07, #2 after one verified session | 1 | `550` | `625` | Repaired `+75` on 2026-07-13 | 1 scheduled session; all checked dependencies `0` |
| `9634dca8-d3ce-4922-aaa4-f743edf3dd86` | 2026-07, #1 | 2 | `1,250` | `1,250` | `0` | 2 scheduled sessions; all checked dependencies `0` |
| `6be6b3cf-f072-4e65-8a27-2656fcfd3390` | 2026-07, #1 | 6 | `3,750` | `3,750` | `0` | 6 scheduled sessions; all checked dependencies `0` |

- Original candidate totals were Legacy `12,800` versus Progressive `12,875`.
  After the one-row repair, all six audited unpaid candidates match Progressive;
  current stored total is `12,875`.
- Excluded: all `415` verified Kids Group bookings have direct `approved` payment
  rows and are out of scope. There are no Kids Group bookings in `paid` status.
  The `33 cancelled` rows are inactive and also excluded. Approved payments were
  not reopened or repriced.
- The previously proposed deploy scope was performed under later Owner approval;
  current rollout state and the safe Entry rollback are recorded above.
- Completed data repair: exactly `d6dad7aa...` changed from `550` to `625`; status
  and sessions were preserved. Activity log
  `98359d52-4da1-4ef2-bc75-a9b3a29db830` records the Owner approval, formula,
  dependency audit, deployed/source state, and no-deploy/no-activation result.
- Post-write verification found payments, coupon usage/reservations, wallet,
  attendance, Progressive batches/allocations, finance ledger, and refund/credit/
  accounting dependencies still `0`. The other five unpaid candidates, all paid/
  verified bookings, and pricing tiers were fingerprint-unchanged.
- Customer impact: the unpaid amount due increased by `75`; no cash was received or
  refunded. Financial impact: booking receivable/net value increased by `75`, while
  payment ledger/cash/accounting allocations remain unchanged.
- Recorded rollback, not executed: `625 -> 550` only if no later payment, coupon,
  wallet, attendance, refund, credit, entitlement, or accounting dependency exists.

### Production Repair History

All rows below are **historical data-repair records**, not proof of current booking
status. Each repair used the then-active **Legacy settled-history monthly true-up**,
not Progressive booking-level pricing.

| Booking | Old -> repaired | Historical state/dependencies | Progressive-policy impact |
| --- | ---: | --- | --- |
| `ff0728dd-066a-417a-aeaa-0049fed6b931` | `3,248 -> 2,496` | `pending_payment`; no payment/coupon rows; sessions unchanged | For the documented second `8` in an `8+8` sequence, Progressive would charge `3,248`; the Legacy repair is `752` lower. |
| `5d1d9a43-afcd-4d26-8817-68ab948443f2` | `2,800 -> 1,169` | July repair; payment evidence preserved; no payment/refund/coupon row created; sessions unchanged | `Unknown / Need verification` without the original ordered entitlement/pricing snapshots. |
| `3f95767e-8418-4b0b-b87d-2cd18811825b` | `14,700 -> 13,600` | Same repair constraints as above | `Unknown / Need verification`. |
| `f565a552-65f3-44e0-8826-22a4c9cb0dbb` | `1,299 -> 763` | Same repair constraints as above | `Unknown / Need verification`. |
| `ff9cf27f-6415-444d-90b6-89ab05fc2d47` | `2,000 -> 1,500` | Same repair constraints as above | `Unknown / Need verification`. |
| `9112a5cb-006c-4fdd-838d-5534c15b6fb1` | `0 -> 500` | `pending_payment`; payments/coupons/wallet/attendance `0`; sessions unchanged | Documented `8 + 1` sequence is also `500` under current Progressive tiers; no formula difference for this case. |
| `60779d60-ac26-4eaf-a34f-703157a32300` | `196 -> 500` | Same dependency state as the preceding row | Same documented `8 + 1` result: `500`. |

- Current row statuses, later payments, coupon/wallet/accounting actions, and whether
  any rollback condition has since changed: `Unknown / Need verification`.
- Do not rewrite these rows again from documentation alone. Any future repair needs
  a read-only exact-row report, the explicitly selected formula, dependency impact,
  and separate Owner approval before Production write.

### Operational Snapshot

Observed scripts:

- `npm run dev`: Next dev with webpack.
- `npm run build`: Next build with webpack.
- `npm run lint`: ESLint against `src` with max warnings 0.
- `npm run check:mojibake`: Thai copy/mojibake guard.
- `npm run prod:check`: read-only production readiness checker.
- `npm run attendance:reconcile:dry-run`: attendance/session status drift report.
- `npm run attendance:reconcile:write`: repair tool. Requires owner confirmation before production write.

## Historical Records

The dated sections below preserve audit history. They are superseded for current
pricing/rollout status by **Current Source of Truth** above unless a section is
explicitly cited as the latest verified evidence. Historical `PASS` labels apply
only to their stated scope and date, not to the current policy-vs-Production result.

## 2026-07-12 - Progressive Normal Booking Entry (Kids Group Only)

- Final status: `PASS` for source integration and disposable local runtime. Source commit `56daabf30ad60c07b3c3ccb98fe42028e33de1be` was pushed to `spike/next-major-security-upgrade`. No deploy or Production UAT was performed.
- Normal Booking now uses a server-only decision: Entry flag off or user not allowlisted keeps every course on Legacy; allowlisted `kids_group` uses Progressive only when pricing-write, coupon-lifecycle, and payment-batch dependencies are ready; a missing dependency returns typed `503` with no Legacy fallback. Allowlisted `adult_group` and `private` remain Legacy and do not call Progressive pricing/write helpers.
- A read-only `/api/bookings/preview` path uses the Progressive kids calculator and current scope revision. Progressive create recomputes atomically in the existing RPC and returns authoritative booking id, total, pending status, scope id, revision, and source kind. Client mode/user/price fields are not authority.
- Progressive edit/cancel routing is selected only from DB `bookings.pricing_scope_id`. Existing Progressive bookings can still edit/cancel/drain when only the Entry flag is later disabled. Legacy edit/cancel remains unchanged.
- Create request UUIDs persist in the session draft. Existing mutation receipts restore the original expected revision for timeout/refresh retries; the RPC fingerprint rejects reuse of the same key with different input, and advisory/scope locks serialize concurrent duplicates.
- Disposable local Supabase runtime passed 9 scenarios: flags off Legacy; non-allowlisted Legacy; adult/private Legacy; Progressive create with scope/snapshots/sessions and no payment artifacts; edit; soft cancel; dependency fail-closed/no write; concurrent duplicate one-booking result; and History/payment-prepare eligibility. Local shadow audit found 2/2 active bookings `MATCH`, with 0 entitlement drift and 0 missing tiers. Containers were stopped afterward.
- Verification passed: booking entry 18, pricing 17, transactions 33, coupon 38, payment batches 39, payment integration 18, shared SlipOK mode 6, local shadow audit, TypeScript, ESLint, mojibake, production build, and `git diff --check`. Local attendance reconciliation reported 0 mismatches. `prod:check` was intentionally pointed at the empty disposable DB and therefore reported expected fixture blockers (no branches/templates/tiers/core buckets), not a Production readiness result.
- Post-build dev restart passed: home 200, generated `_next/static` CSS 200, unauthenticated booking preview 401, meaningful home HTML, and no Next error-overlay marker. Visual automation was unavailable because the agent-browser CLI/browser-control runtime was not installed.
- No migration was added/changed/applied remotely; no environment or feature flag changed; no Production/remote DB write/read, deploy, Production UAT, live SlipOK call, general-user enablement, Adult/Private pricing change, direct implementation SQL shortcut, or force push occurred.

## 2026-07-11 - Shared SlipOK Test Mode Corrective Production Release

- Final status: `PASS`. Corrective source commit `0fbf98fe7a03f71ecb61642ebb20458e4a6480de` was pushed and deployed as Production deployment `dpl_P5BQcazfbWjReuuLkGXkZpGoG1Gz`, Ready and aliased to `https://www.newathleteschool.com`.
- Current Owner-approved Production policy is global server-side `SLIPOK_TEST_MODE=true`, shared by Legacy and Progressive. Successful slip upload auto-approves/verifies through each flow, and the current Production policy makes no live SlipOK network call.
- The Progressive-only SlipOK Test Mode flag was removed. Client mode overrides are not accepted. Live verification must wait for a future Owner policy after branch-specific receiving accounts are designed.
- Progressive infrastructure remains preparation for future use. All Progressive feature flags and the UUID allowlist are unset; general users cannot enter the flow. The five remote Progressive migrations remain applied and capability RPC reports Ready.
- Corrective tests passed: pricing 17, transactions 33, coupon 38, payment batch 39, integration 18, shared SlipOK mode 6, pricing shadow, mojibake, TypeScript, ESLint, production build, production readiness, and attendance reconciliation with 0 mismatches.
- Production smoke passed: home/login/static 200, protected routes redirected to login, Legacy verification route loaded, and unauthenticated Progressive prepare failed closed with 403.
- Read-only before/after reconciliation was unchanged: profiles 309; children 291; bookings 503 (`cancelled` 38, `pending_payment` 8, `verified` 457); booking sessions 2736; payments 457 approved; approved cash 1,248,238. Progressive batches/attempts/allocations/locks/storage objects remained 0.
- Known Legacy booking `d6dad7aa-3e20-4f78-93e0-a7638fc1bb40` remains `pending_payment` with `total_price = 550`; no booking repair, payment creation, slip upload, UAT, migration write, or live SlipOK call occurred.
- This section supersedes earlier readiness notes that described Production Test Mode as a warning or required live SlipOK mode; those older entries are historical records only.

## 2026-07-11 - Slice 4B Progressive Payment FAST-TRACK MVP

- Scope completed locally: additive integration migration, default-deny server controls/UUID allowlist, private progressive slip storage, 30-minute prepared TTL/lazy expiry, durable verification attempts, Test Mode result recovery, Parent History contiguous-prefix flow, Admin whole-batch review, Standard Admin amount omission, and progressive Finance/Notifications reads.
- Progressive user routes are separate from legacy `/api/verify-slip`: prepare, upload, submit, status, and cancel. The legacy verification route and `src/lib/slipok.ts` were not changed.
- Feature controls are server-only: `PROGRESSIVE_PAYMENT_ENTRY_ENABLED`, `PROGRESSIVE_PAYMENT_REVIEW_ENABLED`, and `PROGRESSIVE_PAYMENT_ALLOWED_USER_IDS`. Existing pricing/coupon/batch flags are still required. Default or malformed values deny access. Entry and drain/review controls remain separate.
- Progressive slips use private bucket `progressive-payment-slips`, deterministic user/batch/SHA-256 paths, server-side JPEG/PNG/WebP magic-byte validation, a 5 MB limit, and five-minute signed URLs. Retention is centralized in `progressive_payment_retention_config`: approved 84 months, rejected/under-review 180 days, orphan policy 7 days; no scheduled deletion worker was added.
- Prepared batches expire after 30 minutes through lazy API expiry, become cancelled, release the pricing-scope lock, keep bookings `pending_payment`, and do not release coupon reservations.
- One durable verification attempt is allowed per batch. Test Mode performs no SlipOK network call, stores deterministic `TEST-{attemptId}` evidence, and uses the same atomic batch approval RPC as future live resolution. Resolved retries reuse the stored attempt/result.
- Admin Payments combines legacy rows and progressive batches. Progressive actions approve/reject the whole batch only. Standard Admin serializers omit amount/total-price fields; Super Admin receives batch/allocation amounts. Admin Notifications uses the same visibility rule and no longer exposes the legacy pending total to Standard Admin.
- Finance treats `cash_received` and `booking_net_value` separately. Progressive cash comes only from approved allocations and transaction count uses distinct progressive batch IDs; batch headers are not added to allocation totals.
- Full local migration chain compiled twice against disposable Supabase. Synthetic runtime transaction passed prepare, upload metadata, submit, resolved-attempt replay, atomic approval, under-review lock, Admin rejection, TTL expiry/unlock, private bucket checks, and ledger reconciliation (`1325` cash, one distinct batch), then rolled back. Local Supabase containers were stopped.
- Verification passed: TypeScript, ESLint, production build, mojibake guard, pricing 17, transactions 33, coupon 38, Slice 4B integration 18, and the local migration/runtime gates. Slice 4A payment-batch check was updated only to stop treating the newly authorized Admin/History integration files as forbidden; legacy verify-slip/SlipOK immutability remains enforced.
- Browser smoke passed for public content, no Next error overlay, home/static asset HTTP 200, and unauthenticated redirects for History, Admin Payments, and Finance. Authenticated allowlisted browser UAT remains pending because no confirmed local allowlisted identity was supplied; synthetic DB runtime covers the critical transaction path.
- No production DB write, remote migration, deploy, production environment/feature-flag change, live SlipOK call, booking repair, or hardcoded production user/booking exception was performed. Known legacy booking `d6dad7aa-3e20-4f78-93e0-a7638fc1bb40` remains untouched.

## 2026-07-10 - Owner-Approved Kids Group Pricing Booking Repair

- Final classification: `PASS` for the production DB repair. Exact affected-booking UI verification remains `NEED REVIEW` because no authenticated session for the affected parent was available; this does not invalidate the DB repair.
- Repair completed at `2026-07-10 09:35 ICT` for exactly two owner-approved `kids_group` bookings:
  - `9112a5cb-006c-4fdd-838d-5534c15b6fb1`: `total_price` `0 -> 500`.
  - `60779d60-ac26-4eaf-a34f-703157a32300`: `total_price` `196 -> 500`.
- Pre-write checks passed for both rows: status was `pending_payment`, course was `kids_group`, each booking contained one session for child `1723ca34-71cf-4af5-a459-fcd1f0f4773d` at branch `aa77eba0-d05e-4539-9606-f55fe8a530ca` (แจ้งวัฒนะ), payment rows were 0, coupon usage rows were 0, lesson-wallet rows were 0, and attendance rows were 0. The original `updated_at` matched `created_at`, so no later manual correction was observed.
- Deployed source recalculation was confirmed against current production pricing data for each target: settled history was 8 sessions / `4000`, the target added 1 session, the 7-10 tier was `500` per session, target monthly total was `4500`, and corrected charge was `500`.
- The booking repair used one PostgREST PATCH filtered to the exact two IDs. It returned exactly 2 updated rows, so both booking price changes ran in one database transaction. Status stayed `pending_payment`; normal DB `updated_at` changed to `2026-07-10T02:35:12.033883+00:00`.
- Post-write verification passed: both exact IDs now have `total_price = 500`; the targeted read found no remaining `0` or `196` value; all other booking fields were unchanged; booking-session, payment, coupon-usage, lesson-wallet, attendance, profile, and child fingerprints were unchanged. Related counts stayed sessions 2, payments 0, coupon usages 0, wallet rows 0, and attendance rows 0.
- Activity log `5dc4dc45-8083-4033-86fc-d048150c3d34` was created with action `owner_pricing_booking_repair`. It records owner approval, both old/new amounts, source fix commit `1701a0474ae1fdcf742f6db4c3e3c8c26d39ec2b`, production deployment `dpl_2FKH4GbJ1wa3fSn4xnsxehW6pRdB`, preserved `pending_payment` status, and unchanged related-table scope.
- Production Admin read-only smoke passed on `/admin/logs`: the new activity-log row and full JSON details rendered for Super Admin with browser console warnings/errors 0. No upload, payment, booking submit, or admin write action was clicked. The affected parent's booking cards were not visually verified because that user session was unavailable.
- Exact rollback record, not executed: booking `9112a5cb-006c-4fdd-838d-5534c15b6fb1` `500 -> 0`; booking `60779d60-ac26-4eaf-a34f-703157a32300` `500 -> 196`.
- Local pre-write/write/post-write evidence is stored under ignored backup folder `backups/pricing-booking-repair-20260710T023354Z`.
- No source code, API, migration, deploy, payment/coupon/session/profile/child/wallet/attendance data, status, learner, parent, branch, schedule, course, month, or year was changed. Historical next task was Step 4.1 Homepage LV Copy Audit/Fix; **superseded by Current Source of Truth / Pricing Reconciliation**.

## 2026-07-10 - Kids Group Pricing Pending-Booking True-Up Fix

- Scope: urgent source fix for kids_group monthly pricing true-up only. No adult pricing rule, pricing tier row, DB schema, migration, SlipOK, coupon semantics, lesson wallet, reschedule, attendance, ranking/users/history/makeup, payment row, or existing booking repair was changed.
- Root cause: the booking flow counted active `pending_payment` bookings inside the kids_group monthly true-up as if they were already paid. This could subtract unpaid booking totals and undercharge future additions.
- Fix: kids_group monthly true-up now counts only settled booking statuses `paid` and `verified` for `existingSettledSessions` and `existingSettledTotal`. `pending_payment` bookings remain available for calendar/conflict display but are excluded from paid true-up math.
- Current formula after the fix:
  - `existingSettledSessions = paid/verified sessions only`
  - `existingSettledTotal = paid/verified booking totals only`
  - `totalSessionsAfter = existingSettledSessions + newSessions`
  - `targetTotal = totalSessionsAfter * rateOf(totalSessionsAfter)`
  - `charge = max(0, targetTotal - existingSettledTotal)`
- Zero-baht kids_group true-up behavior: when the source calculation returns `0`, the booking is created as `verified`, the user flow uses the "ใช้สิทธิ์เรียนรอบนี้" action, the slip-upload instructions are hidden, no coupon is applied, and no 0-baht payment row is created by `/api/bookings`.
- Booking UI explains the true-up with the title `คำนวณตามเรทราคารวมของเดือนนี้`, shows paid sessions/amount, new sessions, total-after-booking, new tier rate, target total, deducted paid total, `ยอดที่ต้องชำระเพิ่ม`, and uses `เครดิตส่วนต่าง` for overpaid true-up credit.
- Dry-run pricing proof passed with `node scripts/check-pricing-true-up.js`:
  - new kids_group 1 session = `700`
  - paid 1 session `700` + add 1 = `550`
  - paid 2 sessions `1250` + add 1 = `625`
  - paid 6 sessions `3750` + add 1 = `0` with `เครดิตส่วนต่าง` `250`
  - paid 6 sessions `3750` + add 2 = `250`
  - previous pending 1 session is ignored and does not reduce the next price
  - affected booking scenarios `9112a5cb...` and `60779d60...` recompute to `500` after excluding pending rows
  - prior 8 + 8 sibling true-up remains `4000 + 2496 = 6496`
  - adult pricing checks remain unchanged.
- Local smoke reached `/dashboard/booking` with the provided User account and previewed pricing only; no booking submit, slip upload, DB write, payment/coupon creation, or admin write action was clicked. The visible positive-charge summary showed the new true-up explanation and preserved the slip-required flow.
- The owner-approved production DB repair for `9112a5cb-006c-4fdd-838d-5534c15b6fb1` and `60779d60-ac26-4eaf-a34f-703157a32300` is complete as recorded above. Both rows now have `total_price = 500` and remain `pending_payment`.

## 2026-07-09 - Phase 3 Production Role Smoke Readiness

- Final classification: `NEED REVIEW`.
- Environment: production `https://www.newathleteschool.com`, deployment `dpl_5NrcM92CVrbu5k2BA9Le3gp9G3CC` inspected with Vercel CLI and reported Ready.
- Scope was read-only browser smoke plus docs-only closeout. No source code, API, DB, migration, package/config, deploy, booking/payment/slip/coupon/check-in/attendance/wallet/reschedule/payroll/ranking-write/user-edit action was performed.
- Pre-smoke verification passed:
  - `git status --short` was clean.
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run prod:check` with the known local `SLIPOK_TEST_MODE=true` warning.
  - `npm.cmd run attendance:reconcile:dry-run` with 0 student-scope mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
  - `git diff --check`
- Public/unauthenticated production smoke passed:
  - `/`, `/ranking`, `/auth/login`, and `/auth/register` loaded.
  - Homepage displayed `080-252-7227` and `tel:0802527227`; the old phone was absent.
  - Public `/ranking` search input was visible; `LV 67`, `Athlete`, no-match, and cleared search behavior were verified read-only.
  - Unauthenticated protected routes redirected to `/auth/login?redirect=...`.
- Authenticated production role smoke covered the provided accounts only through browser UI; passwords were not written to docs:
  - User/Parent loaded `/dashboard`, `/dashboard/schedule`, `/dashboard/history`, `/dashboard/booking`, `/dashboard/reschedule`, `/dashboard/lesson-wallet`, `/dashboard/progress`, `/dashboard/children`, `/dashboard/notifications`, and `/profile`; direct `/admin` and `/coach` redirected back to `/dashboard`.
  - Coach loaded `/coach`, `/coach/today`, `/coach/checkin`, `/coach/attendance`, `/coach/students`, `/coach/levels`, `/coach/programs`, `/coach/hours`, and `/coach/notifications`; direct `/admin` redirected back to `/coach`. Direct `/dashboard` rendered a dashboard shell for this account and is an observed access behavior.
  - Head Coach loaded `/coach`, `/coach/today`, `/coach/attendance`, `/coach/assign-groups`, `/coach/hours`, `/coach/students`, `/coach/levels`, and `/coach/programs`; direct `/admin` redirected back to `/coach`.
  - Standard Admin loaded `/admin`, `/admin/schedules`, `/admin/users`, `/admin/ranking`, `/admin/payments`, `/admin/complaints`, and `/admin/notifications`; `/admin/payments` did not show baht symbols or amount wording. `/admin/coupons` redirected to `/admin`, so coupon access for this Standard Admin remains `NEED REVIEW` if it is expected.
  - Standard Admin direct checks for Super Admin-only pages mostly redirected to `/admin` or showed only the Admin shell; `/admin/makeup` and `/admin/coach-checkins` stayed on the URL with shell-only body during this smoke and should be rechecked if direct-deny UI must be explicit.
  - Super Admin loaded `/admin`, `/admin/schedules`, `/admin/makeup`, `/admin/payments`, `/admin/users`, `/admin/ranking`, `/admin/payroll`, `/admin/finance`, `/admin/notifications`, `/admin/settings`, and `/admin/logs`; `/admin/makeup` displayed makeup/review markers.
  - Admin ranking search was visible and worked in production; Super Admin verified `LV 67`, `Athlete`, no-match, and cleared search restore on `/admin/ranking`.
- Production browser console NEED REVIEW:
  - React minified error `#418` reproduced for Head Coach `/coach/programs` and `/coach`.
  - React minified error `#418` appeared during Standard Admin restricted `/admin/finance` redirect.
  - React minified error `#418` appeared on Super Admin `/admin/logs`.
- Vercel check:
  - `npx.cmd vercel inspect https://www.newathleteschool.com --scope team_gw8Y6CPd602WAKRsVFobPGCL` reported Ready deployment `dpl_5NrcM92CVrbu5k2BA9Le3gp9G3CC`.
  - `npx.cmd vercel logs https://www.newathleteschool.com --scope team_gw8Y6CPd602WAKRsVFobPGCL --since 30m` fetched recent production logs showing info-level 2xx/3xx requests only; no server error/fatal entries were visible in the fetched output.
  - Vercel connector runtime error/log endpoints were permission-blocked with 403, and connector deployment alias lookup returned 404, so CLI output is the usable Vercel source for this pass.
- No production write action was clicked. No DB write, migration, deploy, source-code change, or package/config change was performed.

## 2026-07-09 - Phase 3 React #418 Triage / Root-Cause Audit

- Final classification: `PASS` for the read-only triage: the previously reported React minified `#418` console errors did not reproduce in fresh production tabs after hard refresh.
- Scope was read-only audit plus docs-only closeout. No source code, API, DB, migration, package/config, deploy, settings save, coupon/finance/program/check-in/attendance/payment/payroll/ranking/user-edit action was performed.
- Pre-browser verification passed:
  - `git status --short` was clean.
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run prod:check` with the known local `SLIPOK_TEST_MODE=true` warning.
  - `npm.cmd run attendance:reconcile:dry-run` with 0 student-scope mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
  - `git diff --check`
- Production browser reproduction results:
  - Super Admin `/admin/logs`: rendered `Activity Log`, final URL stayed `/admin/logs`, React `#418` not present, console warning/error count 0.
  - Head Coach `/coach/programs`: rendered `โปรแกรมสอน`, final URL stayed `/coach/programs`, React `#418` not present, console warning/error count 0.
  - Head Coach `/coach`: rendered `หน้าหลักโค้ช`, final URL stayed `/coach`, React `#418` not present, console warning/error count 0.
  - Standard Admin direct `/admin/finance`: redirected to `/admin`, rendered Admin overview, React `#418` not present, console warning/error count 0.
  - Standard Admin direct `/admin/coupons`: redirected to `/admin`, rendered Admin overview, React `#418` not present, console warning/error count 0.
- Most likely explanation for the Step 2 React `#418` findings: stale or cross-tab accumulated browser console logs during the long multi-role smoke, not a currently reproducible route-level hydration failure. Confidence: medium, because the exact old browser-log source cannot be replayed after the fresh-tab retest.
- Source files inspected:
  - `src/app/(admin)/admin/logs/page.tsx`
  - `src/components/admin/logs-client.tsx`
  - `src/app/(coach)/coach/programs/page.tsx`
  - `src/components/coach/programs-client.tsx`
  - `src/app/(coach)/coach/page.tsx`
  - `src/app/(coach)/layout.tsx`
  - `src/components/layout/coach-sidebar.tsx`
  - `src/components/layout/admin-sidebar.tsx`
  - `src/components/layout/navigation-pending.ts`
  - `src/app/(admin)/layout.tsx`
  - `src/app/(admin)/admin/page.tsx`
  - `src/app/(admin)/admin/finance/page.tsx`
  - `src/app/(admin)/admin/coupons/page.tsx`
  - `src/lib/admin-navigation.ts`
  - `src/lib/auth/admin.ts`
  - `src/proxy.ts`
  - `src/lib/date-format.ts`
  - `src/lib/utils.ts`
  - `src/lib/coach-slot-display-status.ts`
- Source audit notes:
  - `/admin/logs` uses deterministic `formatThaiDateTimeWithWeekday`; remaining minor hardening candidate is replacing first-render `new Date().toISOString()` for the `วันนี้` stat/filter comparison with a shared Bangkok date key if this ever reproduces around date boundaries.
  - `/coach/programs` has timezone-less client date formatting (`toLocaleDateString('th-TH')`) in `ProgramsClient` and timezone-less server `formatSlotLabel`; this is a good source-only hardening candidate even though production did not reproduce the error.
  - `/coach` current dashboard uses server-side Bangkok date/month calculations and the client sidebar only uses `usePathname`/pending-navigation state; no active mismatch was reproduced.
  - Standard Admin restricted `/admin/finance` is handled by `src/proxy.ts` before the finance page renders, then falls back to the first allowed Admin menu href. No finance component hydration issue was reproduced for the tested Standard Admin.
  - Standard Admin `/admin/coupons` redirect is expected for the tested production permission set: the sidebar did not show Coupon access and `src/proxy.ts` redirects disallowed Admin menu paths via `isAdminMenuPathAllowed(...)`.
  - Important future safety note: `src/app/(admin)/admin/coupons/page.tsx` currently auto-closes expired/maxed coupons by updating rows during page render. Do not render this page under an allowed account in read-only smoke unless the owner approves that write-on-read behavior or it is refactored first.
- Local dev reproduction was not attempted because fresh production reproduction cleared every target route; local dev would not prove the previous production-only console entries.
- Recommended next source-only hardening, only if owner approves:
  - Replace `/coach/programs` client/server date formatting with shared deterministic Bangkok helpers.
  - Replace `/admin/logs` `today`/filter date key logic with shared Bangkok date helpers.
  - Review `/admin/coupons` render-time auto-close write and move it behind an explicit owner-approved Admin/API action if product policy requires read-only page load.

## 2026-07-09 - Owner-Approved Admin Coupons Controlled Smoke

- Final classification: `PASS`.
- Scope was owner-approved controlled production smoke for `/admin/coupons`, including the approved page-load write-on-read auto-close path only. No source code, API, migration, deploy, manual DB edit, coupon create/edit/delete/toggle/save action, or other write action was performed.
- Source audit confirmed:
  - Auto-close logic lives in `src/app/(admin)/admin/coupons/page.tsx` during server page render.
  - It selects active coupons and closes only rows where `valid_to < today` using the page's UTC `new Date().toISOString().split('T')[0]` date key, or where `max_uses !== null` and actual `coupon_usages` count is greater than or equal to `max_uses`.
  - The only auto-close update is `coupons.is_active = false` for matching coupon ids.
  - The render-time auto-close path does not write an activity log or notification. Manual POST/PATCH coupon API actions do log `create_coupon` / `update_coupon`, but those actions were not clicked.
  - Successful auto-close is guarded from repeated writes because inactive coupons are excluded on later page loads. If an update failed, the current source does not inspect the update error, so a still-active candidate could be retried on a later render.
  - Super Admin can open `/admin/coupons`; Standard Admin access depends on `system_settings.admin_menu_permissions` via `src/lib/admin-navigation.ts`, `src/lib/auth/admin.ts`, and `src/proxy.ts`.
- Pre-smoke read-only DB snapshot, saved locally under ignored `backups/coupons-controlled-smoke-20260709-173156/pre.json`:
  - total coupons 0, active coupons 0, inactive/disabled/closed coupons 0.
  - active expired-by-date coupons 0.
  - active maxed-by-usage coupons 0.
  - `coupon_usages` total 0.
  - auto-close candidate coupon ids: `[]`.
- Production smoke used an allowed Super Admin session on `https://www.newathleteschool.com/admin/coupons`:
  - Page loaded and rendered the coupons surface, zero-count stats, search input, status filter trigger, create button, and the expected empty state `ไม่พบคูปองตามเงื่อนไข`.
  - With zero coupon rows, edit/delete/toggle row controls were not present.
  - Search input accepted a no-match query and kept the empty-state/count display at 0 rows.
  - No create/edit/delete/save/toggle/manual coupon action was clicked.
  - React `#418` did not appear. Browser log capture contained one browser-automation clipboard bridge error from the login URL, not an application error from `/admin/coupons`; no application warning/error was observed on the coupons page.
- Post-smoke read-only DB comparison, saved locally under ignored `backups/coupons-controlled-smoke-20260709-173156/post.json`:
  - total coupons remained 0.
  - `coupon_usages` remained 0.
  - changed coupon rows: 0.
  - changed coupon ids: `[]`.
  - auto-close write occurred: no, because there were no candidate coupons.
- Vercel verification:
  - `npx.cmd vercel inspect https://www.newathleteschool.com --scope team_gw8Y6CPd602WAKRsVFobPGCL` reported production deployment `dpl_5NrcM92CVrbu5k2BA9Le3gp9G3CC` as Ready.
  - Narrow post-smoke `vercel logs --since 3m` showed `/admin/coupons` returning 200 with info-level entries only and no error-level entries.
  - The wider 30-minute log window contained one pre-coupons `/ranking` `Invalid Refresh Token` error from stale auth state, separate from the `/admin/coupons` smoke window.
- Verification before smoke passed: clean `git status --short`, `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run prod:check` with the known local `SLIPOK_TEST_MODE=true` warning, and `git diff --check`.

## 2026-07-09 - Phase 3 Deploy Readiness / Production Readiness Gate

- Final classification: `NEED REVIEW`.
- Scope was read-only production readiness. No source code, API, DB write, migration, deploy, data create/update/delete, slip upload, check-in, attendance save, booking/payment/coupon/payroll/finance/settings/Admin Makeup write action, reset password, or role change was performed.
- Local command readiness passed:
  - `git status --short` was clean before the gate.
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run prod:check` returned READY WITH WARNINGS/PASSES with the known local `SLIPOK_TEST_MODE=true` warning.
  - `npm.cmd run attendance:reconcile:dry-run` checked 2389 verified teaching sessions and 1438 attendance rows with 0 student-scope mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
  - `git diff --check`
- Production alias/deployment readiness:
  - `https://www.newathleteschool.com` resolves to Ready Vercel deployment `dpl_5NrcM92CVrbu5k2BA9Le3gp9G3CC`.
  - Vercel production env names are present without exposing values: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SLIPOK_TEST_MODE`, `SLIPOK_API_URL`, and `SLIPOK_API_KEY`.
- SlipOK readiness result:
  - Local `prod:check` still warns `SLIPOK_TEST_MODE=true`, which is acceptable only for local testing.
  - Production SlipOK env names are present in Vercel, but the encrypted value of `SLIPOK_TEST_MODE` cannot be verified without exposing/pulling secrets. Production live mode remains `NEED REVIEW` until confirmed from Vercel settings or a safe owner-approved live SlipOK test.
  - No slip upload or `/api/verify-slip` live file verification was performed.
- Remote DB migration state:
  - `npx.cmd supabase migration list --linked` could not confirm remote migration state because Supabase CLI access token/login is not available in this environment.
  - No migration command, reset, push, or DB write was run. Remote migration state remains `NEED REVIEW`.
- Public/guard production route smoke:
  - Browser smoke: `/` loaded, displayed `080-252-7227`, and exposed `tel:0802527227`.
  - Browser smoke: `/ranking` loaded and public search for `LV 67` filtered to 1 result with no console warnings/errors.
  - No-cookie HTTP checks: `/`, `/ranking`, `/auth/login`, and `/auth/register` returned 200; `/auth/login` and `/auth/register` HTML contained form signals.
  - No-cookie HTTP guard checks: `/dashboard`, `/coach`, `/admin`, and `/admin/ranking` returned 307 to `/auth/login?redirect=...`.
- Authenticated production smoke coverage:
  - Existing browser session was Super Admin only.
  - Super Admin read-only surfaces loaded without React `#418` or captured browser warning/error entries: `/admin`, `/admin/ranking`, `/admin/payments`, `/admin/users`, `/admin/logs`, and `/admin/settings`.
  - Super Admin `/admin/ranking` search was visible and `LV 67` filtered to 1 result; Admin reward controls remained visible and no achievement/write action was clicked.
  - `/admin/makeup` returned 200 in Vercel logs, but the in-browser sample was still on the loading state when captured, so visual coverage is partial and remains `NEED REVIEW` for this gate.
  - User, Coach, Head Coach, and Standard Admin role sessions were not covered in this Step 4 run. Prior Step 2/3 coverage still exists, but this gate does not claim fresh role coverage for those accounts.
- Vercel logs:
  - Post-smoke `vercel logs --since 10m` returned info-level 200/304 entries only in the fetched window. No production error-level log tied to this smoke was visible.
- Readiness issue found:
  - Production homepage currently displays `70+ ระดับพัฒนาการ` and `LV 71+` / `ชุดนักกีฬา A`; source is `src/app/page.tsx`.
  - This conflicts with the current hard production business rule that active levels are LV 0-70 unless the owner confirms LV 71+ as active behavior. No source fix was made in this read-only gate.
- Gate result rationale:
  - Commands, attendance reconciliation, core public/guard routes, Super Admin sampled routes, Vercel deployment status, and Vercel logs are healthy.
  - Gate remains `NEED REVIEW` because remote migration state is unconfirmed, production SlipOK live-mode value is not safely visible, fresh role smoke did not cover User/Coach/Head Coach/Standard Admin sessions, `/admin/makeup` visual sample was partial, and homepage LV71+ copy conflicts with the LV 0-70 production rule.

## Observed Architecture

- `src/proxy.ts` handles Supabase session refresh, role route prefixes, auth redirects, and standard Admin menu permission redirects.
- `src/lib/supabase/middleware.ts` wraps Supabase SSR session handling for proxy.
- `src/app/(dashboard)` contains User portal routes.
- `src/app/(coach)` contains Coach and Head Coach routes.
- `src/app/(admin)` contains Admin and Super Admin routes.
- `src/app/api` contains public/user/coach/admin APIs.
- Admin page access uses `src/lib/auth/admin.ts`; API-level Admin menu checks use `requireAdminMenuAccess`.
- Admin menu permissions use `src/lib/admin-navigation.ts` and `system_settings` key `admin_menu_permissions`.
- Service role access is centralized in `getServiceRoleClient()`.

## Database and Migrations Observed

Key tables/types observed in `supabase/schema.sql` and `src/types/database.ts`:

- `profiles`, `children`, `branches`, `course_types`
- `schedule_templates`, `schedule_slots`
- `pricing_tiers`, `levels`
- `bookings`, `booking_sessions`, `payments`
- `coupons`, `coupon_usages`
- `coach_assignments`, `coach_assignment_groups`, `coach_assignment_group_students`
- `attendance`, `coach_checkins`, `teaching_programs`, `coach_program_templates`
- `student_levels`, `student_achievements`
- `lesson_wallet_credits`
- `coach_teaching_hours`, `coach_payouts`, `coach_weekly_teaching_summaries`
- `notifications`, `complaints`, `activity_logs`, `system_settings`, `finance_expenses`

Observed migrations include:

- Baseline remote schema: `20260506082635_current_remote_baseline.sql`
- Schedule template seed from hardcoded schedules.
- Level expansion to 70 and LV 0 support.
- Extensible level constraints for future LV 71+.
- Coach assignment groups.
- Student achievements.
- Coach weekly teaching summaries.
- Coach program templates.
- Lesson wallet credits.

## Confirmed Business State (Historical/Observed)

Pricing and rollout statements in this section are **superseded by Current Source
of Truth**. Non-pricing observations remain historical evidence until reverified.

### Levels

- Current business state from owner and code: LV 0 through LV 70.
- LV 0 is unassessed.
- Current ranges in `src/constants/levels.ts`:
  - LV 1-34: Basic.
  - LV 35-58: Athlete C.
  - LV 59-70: Athlete B.
- Code can technically support LV 71+ after the extensibility migration, but current active production rule is 1-70 unless owner confirms otherwise.

### Attendance

- `attendance` is source of truth for present/late/absent.
- `booking_sessions.status` is kept as lifecycle/cache state and must be synced after attendance writes.
- Shared status helper: `src/lib/session-attendance-status.ts`.
- Admin shared scope/status helper: `src/lib/admin-attendance-state.ts`.
- Exact learner matching uses `booking_session_id + expected student_id`.
- Write-through helper: `src/lib/attendance-write-through.ts`.
- Coach attendance API currently calls write-through after insert/update.
- Admin makeup retrospective attendance API currently calls write-through after insert/update.
- Admin makeup attendance-gap review treats `activity_logs` action `attendance_gap_closed_no_action` as a terminal review marker. Closing a review must not mark the session `completed`.

### Booking, Payment, and Scheduling

- User booking API resolves sessions through DB `schedule_templates` and real `schedule_slots`.
- New booking sessions should persist `schedule_slot_id`.
- Admin booking on behalf of users is disabled.
- Slip upload API stores payment rows and updates booking status based on SlipOK/test-mode result.
- `SLIPOK_TEST_MODE=true` auto-approves locally; production must use real SlipOK env.
- `/admin/payments` learner display is now resilient for multi-child bookings. It still reads `bookings.child_id -> children` first for single-child bookings, then falls back to unique learner names from `booking_sessions.child_id` when `bookings.child_id` is null by design.
- Pricing reads DB `pricing_tiers` through `src/lib/booking-pricing.ts` and falls back to defaults only if rows are missing.
- Kids group combines sibling sessions for monthly tier pricing.
- Kids group incremental pricing now true-ups split bookings in the same month to the final monthly tier total. It subtracts existing persisted `bookings.total_price` for the same user/course/month/year/status scope before charging the next booking.
- User Reschedule (`/dashboard/reschedule` and `/api/reschedule`) now uses a 12-hour cutoff before the original lesson start time. The cutoff is computed against the lesson start in Asia/Bangkok (`+07:00`).

### Coach and Attendance Evidence

- Coach assignments now use assignment groups by learner/slot, with legacy assignment fallback.
- Coach check-in is per teaching slot and requires photo/GPS.
- Coach attendance is locked until check-in for the exact slot, except Admin/Super Admin retrospective paths.
- Admin Makeup displays round branch names from `booking_sessions.branch_id` / the session branch relation, not from the booking package branch.
- Coach teaching hour source rows are verified only with students, check-in, photo, location, and attendance.
- Coach teaching hour source reads must chunk large `.in()` filters. Production-scale grouped assignments can exceed Supabase/PostgREST request limits and row caps when `booking_session_id` or `schedule_slot_id` arrays are sent in one request.
- Weekly teaching summaries are stored in `coach_weekly_teaching_summaries`.

### Lesson Wallet

- `lesson_wallet_credits` exists.
- User can store verified scheduled sessions before the 48-hour cutoff when no attendance exists.
- Redemption is same-month, future-slot, no new payment.
- Walleted sessions are excluded from absence, makeup, and coach-payable evidence.
- Wallet redemption must validate against active `schedule_templates` by branch, course, day, and time. A client-provided `scheduleTemplateId` is only a hint; if it is stale or does not cover the selected time, the API must fall back to the canonical branch/course/day/time template lookup before rejecting.

## Observed Current Routes

Public:

- `/`
- `/ranking`
- `/auth/login`, `/auth/register`, `/auth/callback`

User:

- `/dashboard`, `/dashboard/booking`, `/dashboard/history`, `/dashboard/schedule`
- `/dashboard/reschedule`, `/dashboard/lesson-wallet`, `/dashboard/progress`
- `/dashboard/children`, `/dashboard/complaint`, `/dashboard/notifications`
- `/profile`

Coach/Head Coach:

- `/coach`, `/coach/today`, `/coach/checkin`, `/coach/attendance`
- `/coach/students`, `/coach/levels`, `/coach/programs`, `/coach/hours`
- `/coach/assign-groups`, `/coach/notifications`

Admin/Super Admin:

- `/admin`, `/admin/users`, `/admin/coaches`, `/admin/branches`
- `/admin/schedules`, `/admin/schedule-templates`, `/admin/payments`
- `/admin/payments/settings`, `/admin/coupons`, `/admin/complaints`
- `/admin/notifications`, `/admin/ranking`, `/admin/makeup`
- `/admin/coach-checkins`, `/admin/payroll`, `/admin/finance`
- `/admin/teaching-programs`, `/admin/settings`, `/admin/settings/pricing`
- `/admin/settings/levels`, `/admin/settings/coach-ot`
- `/admin/settings/admin-menus`, `/admin/logs`

## Historical Risk Snapshot (Superseded by Current Source of Truth)

Latest attendance reconciliation result:

- Owner confirmed production repair on 2026-06-04.
- `npm run attendance:reconcile:write` updated 1 stale row:
  - session `1b9d1b2b-2078-4c47-a042-46d74ae41fa6`
  - `booking_sessions.status`: `scheduled` -> `completed`
  - source of truth: `attendance.status=present`
- Follow-up `npm run attendance:reconcile:dry-run` reported:
  - Student-scope attendance mismatches: 0
  - Status mismatches: 0
  - Booking status without attendance: 0

Current active production risk:

- No known attendance/session status drift after the confirmed reconciliation.
- Public contact phone number is deployed as `080-252-7227` with `tel:0802527227` as of commit `983e998` (`fix(site): update contact phone number`):
  - Deployment id `dpl_5NrcM92CVrbu5k2BA9Le3gp9G3CC`; production alias `https://www.newathleteschool.com`; deployment status Ready.
  - Source scope was limited to `src/app/page.tsx`; no DB write, API change, migration, package/config change, business logic change, or deploy after docs was performed.
- `/admin/ranking` Phase 2.5 follow-up search enablement is deployed in production as of commit `67aa4f1` (`fix(ranking): enable search in admin view`):
  - Deployment id `dpl_4FCzBixNfSrEiWaiwf6xbfU9DDvL`; deployment URL `https://new-athlete-badminton-school-5olbmc8mo-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
  - Final status: PASS after owner-verified production smoke.
  - Source scope was limited to `src/app/(admin)/admin/ranking/page.tsx`.
  - Exact source change: Admin Ranking now calls `<RankingContent mode="admin" enableSearch />`, enabling the existing shared `RankingBoard` dynamic search for `/admin/ranking`.
  - Search is now enabled on both `/ranking` and `/admin/ranking`. Search implementation, fields, empty state, rank preservation, branch fallback, and Admin achievement controls remain the shared Phase 2.5 behavior.
  - Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run attendance:reconcile:dry-run`, `npm.cmd run prod:check` with the known local `SLIPOK_TEST_MODE=true` warning, and `git diff --check` with only the known Windows LF/CRLF warning for the touched admin ranking page.
  - Local authenticated smoke passed on `/ranking` and `/admin/ranking`: search input visible on both; dynamic search worked by typed name, nickname, branch, and `LV 67`; branch+search and level+search still combine on public; no-match state displayed `ไม่พบนักเรียนที่ตรงกับคำค้นหา`; whitespace/empty search restored the list; original rank `#1` stayed `#1`; Admin reward controls stayed visible; the achievement modal opened/closed read-only without submitting; browser warnings/errors were 0.
  - Production verification completed for deploy health and route reachability: Vercel inspect reported Ready, `https://www.newathleteschool.com/ranking` returned 200, unauthenticated `/admin/ranking` returned the expected 307 auth redirect, and `vercel logs --level error --since 1h` returned no logs.
  - Owner-verified production smoke completed after deploy: public `/ranking` had the search input visible and the ranking list rendered normally; authenticated Super Admin `/admin/ranking` had the search input visible, Admin sidebar/control still visible, reward/Admin controls still visible, and the ranking list rendered normally.
  - No Admin write action was clicked during owner verification. No new source deploy was needed for this docs-only PASS closeout.
  - Production deploy was run from a detached clean worktree at commit `67aa4f1`, so the then-unrelated `src/app/page.tsx` phone-number change was not included in that ranking deploy. That phone update was later completed separately in commit `983e998`. No DB write, migration, API route change, ranking sort/rank semantic change, branch fallback semantic change, student level/achievement write, booking/payment/attendance/wallet change, storage deletion, or Admin write action was performed.
- `/ranking` + `/admin/ranking` Phase 2.5 Option 1 safe read transport cleanup and public dynamic search is deployed in production as of commit `1cef3b7` (`fix(ranking): add search and range reads`):
  - Deployment id `dpl_9mvhkgVdPags1Ko5Z6W2TRXeyycA`; deployment URL `https://new-athlete-badminton-school-mnggq3uty-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
  - Source scope was limited to `src/components/shared/ranking-content.tsx`, `src/components/shared/ranking-board.tsx`, and `src/app/ranking/page.tsx`.
  - Top-level Ranking reads for `children`, paid/verified `bookings`, active `branches`, and `levels` now use explicit ranged pagination with explicit read errors.
  - Large `.in(...)` reads for parent `profiles`, `student_levels.student_id`, and active `student_achievements.student_id` now use chunked+ranged reads with id dedupe. Existing child session branch fallback remains chunked+ranged and now fails explicitly on read error.
  - At this source commit, public `/ranking` gained client search through the shared `RankingBoard` and `/admin/ranking` intentionally still had search disabled. That admin-search gap was superseded and closed by follow-up commit `67aa4f1`, so current production has search enabled on both `/ranking` and `/admin/ranking`.
  - Ranking semantics were preserved: sort order, rank maps, public/Admin visibility, branch fallback precedence, LV 0-70 behavior, student level display, and achievement write flow were not changed. Search filters the visible list but does not re-rank results.
  - Read-only post-fix counts: children 290, adult visible rows from paid/verified bookings 24, visible ranking rows 314, paid/verified bookings 439, session fallback rows 2422, `student_levels` rows 459, child latest-level rows 238/52 missing, adult latest-level rows 13/11 missing, visible level buckets LV0/Basic/Athlete C/Athlete B/LV71+ = 63/195/55/1/0, active achievements 0, active branches 7, active levels 70.
  - Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run attendance:reconcile:dry-run`, `npm.cmd run prod:check` with the known local `SLIPOK_TEST_MODE=true` warning, and `git diff --check` with only known Windows LF/CRLF warnings for touched ranking files.
  - Local smoke passed on `/ranking`: search by full name, nickname, branch, and `LV 67` worked; no-match showed the search empty state; branch+search and level+search combinations worked; rank `#1` stayed `#1`; browser warnings/errors were 0. At this commit only, local `/admin/ranking` authenticated smoke passed with the search input absent, ranking rows rendered, achievement buttons available, and the achievement modal opened/closed read-only; the later follow-up enabled admin search.
  - Production smoke passed on `https://www.newathleteschool.com/ranking` and `/admin/ranking` with the same public/admin checks; production browser warnings/errors were 0. Vercel deployment inspect reported Ready, and `vercel logs --level error --since 1h` returned no logs.
  - Production deploy was run from a detached clean worktree at commit `1cef3b7` so the then-unrelated `src/app/page.tsx` phone-number change was not included in that ranking deploy. That phone update was later completed separately in commit `983e998`. No DB write, migration, API route change, student level/achievement write, booking/payment/attendance/wallet change, storage deletion, or Admin write action was performed.
- `/dashboard/history` Phase 2.3 Option 1 safe read transport cleanup is deployed in production as of commit `3cc3ddc` (`fix(history): range large read queries`):
  - Deployment id `dpl_EXvDn6rkpRKCohjEmTcgg3XweyMM`; deployment URL `https://new-athlete-badminton-school-e3nssxdhj-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
  - Source scope was limited to `src/app/(dashboard)/dashboard/history/page.tsx` and `src/components/dashboard/history-client.tsx`.
  - Added local read helpers `readAllRangePages`, `readChunkedRangePages`, and `dedupeRowsById`.
  - Top-level `bookings` and `payments` reads now use explicit ranged pagination while preserving the existing Admin/global and User/self scopes, field selection, and created-at ordering.
  - Related reads now chunk and range `.in(...)` filters for `coupon_usages`, `booking_sessions`, `attendance`, and `lesson_wallet_credits`; rows are deduped by id where chunk/range reads can overlap.
  - Profile and payment-transfer setting reads now fail explicitly on read error instead of silently masking the problem.
  - Client optimization included: `/dashboard/history` memoizes payments by booking id and latest rejected payment by booking id, preserving `HistoryClient` props and UI behavior.
  - Read-only post-fix counts: bookings 475, booking_sessions 2669, payments 438, lesson_wallet_credits 55, attendance 1411, multi-child bookings with null `bookings.child_id` and session children 69, rescheduled rows with `rescheduled_from_id` 202, booking session statuses completed/rescheduled/walleted/scheduled/absent 1316/193/55/1011/94.
  - Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run attendance:reconcile:dry-run`, `npm.cmd run prod:check` with the known local `SLIPOK_TEST_MODE=true` warning, and `git diff --check` with only the known Windows LF/CRLF warnings for touched files.
  - Authenticated local smoke passed on `/dashboard/history` as Super Admin: August and July groups rendered, July expanded, normal detail modal opened, walleted private booking showed wallet summary/section for `onlineman2522@gmail.com`, and reschedule-heavy multi-child booking `ikqjaa@gmail.com` showed reschedule history, no-double-count copy, learners, and attendance statuses. Browser warnings/errors were 0.
  - Authenticated production smoke passed on `https://www.newathleteschool.com/dashboard/history`: same read-only list/detail/wallet/reschedule/multi-child checks passed, production browser warnings/errors were 0, and Vercel logs for the smoke window showed 200 responses with no error-level logs.
  - No API route, DB write, migration, schema change, SlipOK change, payment/slip upload action, payment/booking status transition change, pricing/coupon semantic change, lesson wallet/reschedule/attendance source-of-truth change, storage deletion, booking/payment/slip/coupon creation, or write action click was performed.
- `/admin/payments` Phase 2.2 Option 1 safe read transport cleanup is deployed in production as of commit `33161c6` (`fix(payments): range large read queries`):
  - Deployment id `dpl_5Kdb3ahBbpd89NTEs4pvv7Eq75ED`; deployment URL `https://new-athlete-badminton-school-n047jvmd6-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
  - Source scope was limited to `src/app/(admin)/admin/payments/page.tsx`.
  - Added local read helpers `readAllRangePages`, `readChunkedRangePages`, and `dedupeRowsById`.
  - Top-level `payments` and incomplete `bookings` reads now use explicit ranged pagination while preserving the existing status/order/role-specific field selection. Super Admin still receives financial amount fields; standard Admin does not receive `payments.amount` or `bookings.total_price`.
  - Multi-child learner fallback reads now chunk booking ids by 100 and range every `booking_sessions` page; fallback child-name reads and verifier profile reads are also chunked/ranged and deduped.
  - Payment transfer setting reads now fail explicitly on read error instead of silently masking the problem.
  - Read-only post-fix counts: payments 433; incomplete bookings 8; payment-scope booking ids 441; fallback session rows 2574 across chunk rows 456, 727, 299, 746, 346; unique child ids 271; child rows 271; duplicate payment booking ids 0; approved/pending/rejected payments 433/0/0.
  - Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run attendance:reconcile:dry-run`, `npm.cmd run prod:check` with the known local `SLIPOK_TEST_MODE=true` warning, and `git diff --check` with only the known Windows LF/CRLF warning for the touched file.
  - Authenticated local smoke passed on `/admin/payments` as Super Admin: list showed 433 rows, incomplete section showed 8 rows, amount visibility was preserved, search returned current-data results for `เอมี่` (1), `ภูเมธ` (2), and `Tigger` (2), and current data returned 0 for `ปันนา`; detail and slip modals opened read-only. No approve/reject/send-back/cancel/write action was clicked.
  - Local browser logs had one dev-only Next image LCP warning from the slip modal image; no functional error, hydration error, or React #418 was observed.
  - Authenticated production smoke passed on `https://www.newathleteschool.com/admin/payments`: list showed 433 rows, incomplete section showed 8 rows, amount visibility was preserved for Super Admin, search/detail/slip modal read-only checks passed, production-origin browser warnings/errors were 0, and Vercel error logs found no logs.
  - No API route, DB write, migration, schema change, client redesign, server pagination behavior change, SlipOK change, payment status/booking status/pricing/learner fallback semantic change, financial visibility regression, storage deletion, booking/payment/slip/coupon creation, or payment write action was performed.
- `/admin/payments` multi-child learner display fix is deployed in production as of commit `abe01e11324bbb1d5bc29034fe516f0bfa655220` (`fix(payments): show session learners for multi-child bookings`):
  - Deployment id `dpl_CdVyyJMkYWcSJJBZrWY6aajcZ1Mf`; deployment URL `https://new-athlete-badminton-school-fpasc3joj-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
  - Root cause: `/admin/payments` displayed `ไม่ทราบผู้เรียน` for multi-child kids_group bookings because the read model used only `bookings.child_id -> children`. Multi-child bookings intentionally have `bookings.child_id = null`, while the real learners are stored on `booking_sessions.child_id`.
  - Source scope was limited to `src/app/(admin)/admin/payments/page.tsx` and `src/components/admin/payments-client.tsx`.
  - Fix is display/read-model only: single-child booking display still uses `bookings.child_id -> children` first; multi-child display falls back to unique learner names from `booking_sessions.child_id`; search and the payment detail modal use the derived learner name.
  - Production smoke passed on `/admin/payments`: `4b0813ef...` showed `ปันนา, ปีนัง`; `5ebae341...` showed `เอมี่, เอลซ่า`; `9b7bd3f5...` showed `ภูเมธ, ซานต้า, ซันเดย์, ตุลย์`; a single-child row still showed `Tigger`; search by `ปันนา`, `เอมี่`, `ภูเมธ`, and `Tigger` worked; the detail modal for `9b7bd3f5...` showed `ผู้เรียน: ภูเมธ, ซานต้า, ซันเดย์, ตุลย์`; console errors/warnings were 0.
  - No DB changes, migrations, payment approval/reject/send-back/cancel logic changes, pricing changes, SlipOK changes, `booking_sessions`/`payments`/coupon data changes, booking/payment/slip/coupon creation, or payment write action clicks were performed.
  - Remaining risk for this display bug after production smoke: none known.
- Lesson wallet redemption fallback fix, added 2026-06-09:
  - Reported pattern: `/dashboard/lesson-wallet` could return HTTP 400 with `รอบเรียนที่เลือกไม่ตรงกับรอบเรียนประจำในระบบ` even when the selected branch/date/time/course had an active recurring template.
  - Root cause proved read-only: `/api/lesson-wallet` treated client `scheduleTemplateId` as a hard filter. A stale/mismatched id caused the canonical branch/course/day/time lookup to be skipped.
  - Scoped source fix: `src/app/api/lesson-wallet/route.ts` now first tries the provided template id, then falls back to active templates for the selected branch, course, day, and time. It still rejects when no active matching template exists.
  - Business rules unchanged: same-month redemption, future-slot requirement, duplicate learner guard, capacity guard, no new payment, and wallet status transitions remain intact.
- Continue to treat `attendance` as the source of truth and keep write-through required on every runtime attendance write path.
- `21.6.19` follow-up code now guards future child bookings by requiring child learner sessions to carry `childId` and by persisting `bookings.child_id`.
- `21.6.20` owner-confirmed exact-row historical child FK repair was run on 2026-06-04:
  - booking `080c8a56-9b67-4a83-a44b-5a0394f4b73f` updated to child `65a94ede-296e-4bbe-9bab-2aaf03b99c7e`.
  - 16 related `booking_sessions` rows updated to the same `child_id`.
  - Post-write verification found 0 target sessions with missing/wrong `child_id`.
  - No other bookings or sessions were targeted by this repair.
- Admin coach check-in audit now chunks active `booking_sessions` lookups and surfaces load errors in the UI instead of silently showing a false empty state.
- Admin makeup coach-checkin evidence now requires the exact assigned coach pair (`schedule_slot_id + coach_id`) before showing coach evidence as complete. Same-slot check-ins from other coaches must not be treated as evidence for the assigned coach.
- Admin makeup attendance-gap review now reads review request/closed metadata from `activity_logs` in chunks, hides closed review sessions from the review queue, sends coach review/evidence requests to every learner session in the selected round, and provides a round-level close action.
- Admin makeup no-coach past rounds are now resolved at round scope only. The UI hides per-learner action buttons for these rounds and opens a round-level resolution dialog. The taught path creates a retrospective `coach_assignment_groups` record, links every learner session in the round, writes attendance per learner, and syncs session status through the attendance write-through helper. Return-entitlement and close-round paths run across all eligible sessions in the selected round.
- Admin makeup Tabs + Filters MVP is deployed in production as of commit `7e1bae818e42e4bbf24368363f0821ae04b2c308`:
  - Deployment id `dpl_3wRJjCqExkPPEEqUzBxxJSC3WuCD`; production alias `https://www.newathleteschool.com`; production smoke on `/admin/makeup` passed.
  - The page is split client-side into `ต้องตรวจสอบ` and `เลือกวันชดเชย` tabs.
  - `ต้องตรวจสอบ` keeps the existing review round cards and action surfaces; `เลือกวันชดเชย` keeps the existing learner/month entitlement cards.
  - Filters are client-only and tab-specific. No API route, DB, migration, write behavior, attendance/write-through logic, wallet/return-entitlement logic, or duplicate coach group guard behavior changed.
  - Production smoke confirmed duplicate coach group UI and assigned-coach action cards remained visible, console errors/warnings were 0, the font/preload warning flood did not return, and no write action was clicked.
- Phase 1 standardized Thai date display is deployed in production as of commit `73d465ca1bef5881bb6e6a9c7f52d9046db8a08d` (`fix(ui): standardize thai date display`):
  - Deployment id `dpl_GYpjsdSxAMQfWJBjFZqhF1ZNeAUe`; deployment URL `https://new-athlete-badminton-school-hpbojsf73-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
  - Source scope was limited to `src/lib/date-format.ts`, `src/components/admin/schedules-client.tsx`, `src/components/admin/payroll-client.tsx`, `src/components/admin/makeup-client.tsx`, `src/app/(coach)/coach/today/page.tsx`, `src/app/(coach)/coach/attendance/page.tsx`, `src/app/(coach)/coach/hours/page.tsx`, and `src/components/coach/assign-groups-client.tsx`.
  - New shared display helper `src/lib/date-format.ts` centralizes deterministic Asia/Bangkok date formatting with `getBangkokDateKey`, `parseBangkokDate`, `formatThaiDateWithWeekday`, `formatThaiShortDate`, `formatThaiDateRangeWithWeekday`, `formatThaiDateTimeWithWeekday`, `formatThaiCompactDateWithWeekday`, `formatThaiMonthYear`, and `formatThaiShortMonthYear`.
  - Admin/Coach operational pages now use the same weekday date display style, for example `จันทร์ 29 มิ.ย. 69`; date ranges display weekday on both ends, for example `จันทร์ 1 มิ.ย. 69 - อาทิตย์ 7 มิ.ย. 69`.
  - This was display formatting only. It did not change query date ranges, filtering, grouping, payroll calculations, payroll Monday-Sunday week boundary logic, close API behavior, booking/reschedule/wallet/attendance logic, Admin Makeup write behavior, DB/API/migrations, or write actions.
  - Verification before deploy passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check` with only known Windows LF/CRLF warnings.
  - Production smoke passed with one `NEED REVIEW` note only for `/coach/hours` visual weekly/date rows because the smoke coach session had no row data. `/admin/schedules` showed `จันทร์ 29 มิ.ย. 69`; `/admin/payroll` coach-hours modal showed `จันทร์ 1 มิ.ย. 69 - อาทิตย์ 7 มิ.ย. 69`, `จันทร์ 8 มิ.ย. 69 - อาทิตย์ 14 มิ.ย. 69`, `จันทร์ 15 มิ.ย. 69 - อาทิตย์ 21 มิ.ย. 69`, `จันทร์ 22 มิ.ย. 69 - อาทิตย์ 28 มิ.ย. 69`, and `จันทร์ 29 มิ.ย. 69 - อาทิตย์ 5 ก.ค. 69`; `/admin/makeup` showed `อาทิตย์ 28 มิ.ย. 69` and `เสาร์ 27 มิ.ย. 69`; `/coach/today` and `/coach/attendance` showed `จันทร์ 29 มิ.ย. 69`; `/coach/assign-groups` showed `จันทร์ 29 มิ.ย. 69`, `พฤหัสบดี 18 มิ.ย. 69`, and `อาทิตย์ 14 มิ.ย. 69`.
  - Hydration/console smoke passed: hard refresh/fresh load checks on `/admin/schedules`, `/admin/payroll`, and `/coach/today` found no React #418, no hydration error, no text mismatch, and console errors/warnings 0.
  - No DB/API/migration changes, source changes after smoke, extra deploy after smoke, write action clicks, or `ปิดสัปดาห์` clicks were performed.
- Phase 2 standardized Thai date display is deployed in production as of commit `2eebfef5ee1b4dc5da9cd34f05baa2b19efa3eda` (`fix(ui): standardize remaining thai date displays`):
  - Deployment id `dpl_ED8kxqLF3aEhPBCNq4AeUADGnbQX`; deployment URL `https://new-athlete-badminton-school-6u58bndez-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
  - Source scope covered remaining User/Admin/Public/support date displays in `src/components/admin/admin-overview-schedule.tsx`, `src/components/admin/branches-client.tsx`, `src/components/admin/coach-checkins-client.tsx`, `src/components/admin/coach-ot-settings-client.tsx`, `src/components/admin/complaints-client.tsx`, `src/components/admin/coupons-client.tsx`, `src/components/admin/finance-client.tsx`, `src/components/admin/levels-settings-client.tsx`, `src/components/admin/logs-client.tsx`, `src/components/admin/notifications-admin-client.tsx`, `src/components/admin/payments-client.tsx`, `src/components/admin/teaching-programs-client.tsx`, `src/components/admin/users-client.tsx`, `src/components/dashboard/children-client.tsx`, `src/components/dashboard/complaint-client.tsx`, `src/components/dashboard/dashboard-calendar.tsx`, `src/components/dashboard/history-client.tsx`, `src/components/dashboard/lesson-wallet-client.tsx`, `src/components/dashboard/notifications-client.tsx`, `src/components/dashboard/reschedule-client.tsx`, `src/components/dashboard/schedule-calendar-client.tsx`, `src/components/shared/ranking-board.tsx`, and `src/components/shared/student-achievement-manager.tsx`.
  - The change reused the existing `src/lib/date-format.ts` helper from Phase 1. Default date display is `จันทร์ 29 มิ.ย. 69`; date-time display is `จันทร์ 29 มิ.ย. 69 14:33`; compact weekday is reserved for tight UI such as dashboard quick cards and reschedule date tiles.
  - This was display formatting only. It did not change query/filter/grouping/calendar selection, booking/reschedule/wallet/attendance/payroll logic, payroll Monday-Sunday boundary logic, close API behavior, financial visibility gating, ranking sort/filter/rank logic, low-enrollment logic, React #418 deterministic date-key logic, DB/API/migrations, or write actions.
  - Verification before deploy passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check` with only known Windows LF/CRLF warnings.
  - Production smoke passed with `NEED REVIEW` notes only where the smoke account had no real row/date data. `/dashboard/notifications` showed `จันทร์ 29 มิ.ย. 69 14:33`; `/admin/payments` showed `จันทร์ 29 มิ.ย. 69 14:33` and `เสาร์ 27 มิ.ย. 69 19:30`; `/admin/notifications` showed weekday notification dates and the low-enrollment card rendered without crashing; `/admin/ranking` and `/ranking` showed `ประเมินล่าสุด: พฤหัสบดี 25 มิ.ย. 69`; `/admin/finance` showed `จันทร์ 1 มิ.ย. 69`; `/admin/complaints` showed `พฤหัสบดี 28 พ.ค. 69 23:28`; `/admin/users` showed `สมัคร จันทร์ 29 มิ.ย. 69`; `/admin/logs` showed `จันทร์ 29 มิ.ย. 69 15:18`; `/admin/settings/levels` showed `อัปเดต พุธ 13 พ.ค. 69 18:03`.
  - Fresh-tab/cache-buster hydration checks on `/dashboard/schedule`, `/admin/payments`, `/admin/notifications`, and `/ranking` found no React #418, no hydration error, no text mismatch, and console errors/warnings 0.
  - `/dashboard/booking` was intentionally not changed in this phase because it is booking/calendar selection/write-heavy and out of scope at that time. It was closed later by the scoped booking date-display release below.
- `/dashboard/booking` Thai date display closeout is deployed in production as of commit `a9ffcf74019f69424e288a1698910444b4e58a8c` (`fix(booking): standardize thai date display`):
  - Deployment id `dpl_27LUxvWCa7UmZwwUdyZXHMZaw55W`; deployment URL `https://new-athlete-badminton-school-q05rf1358-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
  - Source scope was limited to `src/components/dashboard/booking-client.tsx` and reused the existing `src/lib/date-format.ts` helper from the Phase 1/2 date-display work.
  - This closes the final date-display path intentionally skipped from Phase 2. Standardized Thai date display is now complete across the system, including `/dashboard/booking`.
  - Display changes: raw error dates and expanded slot headers use `formatThaiDateWithWeekday(...)`; selected-session chips/badges use `formatThaiCompactDateWithWeekday(...)`; month selector and summary month/year use `formatThaiMonthYear(...)`.
  - Calendar weekday headers and calendar day cells intentionally remain compact/calendar UI (`อา จ อ พ พฤ ศ ส` and day numbers such as `30`).
  - This was display formatting only. It did not change calendar selection logic, selected date/date key logic, current month logic, past-date disabling, bookable slot logic, schedule template matching, `scheduleTemplateId`, `POST/PUT /api/bookings` payloads, booking/payment behavior, DB/API/migrations, or write actions.
  - Verification before deploy passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check` with only known Windows LF/CRLF warnings.
  - Production smoke on `https://www.newathleteschool.com/dashboard/booking` passed with a real user session and no unexpected redirect. Confirmed display examples: month selector `มิถุนายน 2569`; expanded slot header `อังคาร 30 มิ.ย. 69 — เลือกรอบเรียน:`; selected-session chip `อ. 30 มิ.ย. 69 08:00-09:00`; summary month/year `มิถุนายน 2569`; summary selected date `อ. 30 มิ.ย. 69 08:00-09:00`.
  - Production smoke also confirmed calendar weekday header `อา จ อ พ พฤ ศ ส`, day cell `30`, console errors/warnings 0, no React #418, no hydration error, and no text mismatch.
  - Smoke interaction was read-only UI selection only: `Private`, learner `A'Arm Chanin`, branch `แจ้งวัฒนะ`, date `30`, slot `08:00 - 09:00`, then summary display review. `ยืนยันการจอง` was not clicked; no booking/payment/write action was performed; no extra deploy was performed after smoke.
- User Reschedule 12-hour cutoff Phase 1 is deployed in production as of commit `c6b470dbba646f5b4db023a7dedf0df8d7b08f37`:
  - Deployment id `dpl_3gm8uhsKrmm6Zxe69R9GsBHq1yMk`; production alias `https://www.newathleteschool.com`; production smoke passed with a `NEED REVIEW` note only for live eligibility/action examples because the smoke account had no sessions.
  - `/dashboard/reschedule` displays `ล่วงหน้าอย่างน้อย 12 ชั่วโมง`, and no `24 ชั่วโมง` copy was found in the reschedule page.
  - `/api/reschedule` and the client eligibility gate both use the 12-hour cutoff and parse lesson start times as Asia/Bangkok (`+07:00`).
  - Lesson Wallet is intentionally unchanged in this phase: `/dashboard/lesson-wallet` still shows the 48-hour policy, and `/api/lesson-wallet` still uses `STORE_CUTOFF_HOURS = 48`.
  - No DB writes, migrations, write behavior changes beyond the reschedule validation threshold, Admin Makeup changes, Lesson Wallet logic changes, or production write actions were performed.
- Admin Payroll / Coach Hours Monday-Sunday teaching week boundary is deployed in production as of commit `56dc769e6b817d645f5cf08523070b64d3ce6f02` (`fix(payroll): use monday teaching weeks`):
  - Deployment id `dpl_FgzX1ZCovmSoj1q9KcL5YYknuZjE`; deployment URL `https://new-athlete-badminton-school-7fipynggk-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
  - Source scope was limited to `src/lib/coach-teaching-rules.ts`, `src/components/admin/payroll-client.tsx`, `src/app/api/admin/coach-payouts/route.ts`, `src/app/(coach)/coach/hours/page.tsx`, `src/app/(coach)/coach/page.tsx`, and `src/lib/coach-teaching-hours.ts`.
  - Teaching/payroll week boundaries now use Monday-Sunday instead of Sunday-Saturday, with deterministic Asia/Bangkok date keys shared by Admin Payroll, Coach Hours, and Coach Dashboard.
  - Expected June 2026 week mapping is now `2026-06-01 - 2026-06-07`, `2026-06-08 - 2026-06-14`, `2026-06-15 - 2026-06-21`, `2026-06-22 - 2026-06-28`, and `2026-06-29 - 2026-07-05`.
  - The coach payout close API validates client `weekStart/weekEnd` against the canonical Monday-Sunday teaching week and blocks overlapping legacy closed summaries before upsert. Existing `coach_weekly_teaching_summaries` records were not repaired, migrated, deleted, or rewritten.
  - `src/lib/coach-teaching-hours.ts` chunks `coach_checkins` reads as a read-only query transport fix for large queries; payroll rates, evidence requirements, attendance logic, and payable formula semantics were not changed beyond weekly grouping.
  - Production smoke passed for `/admin/payroll`: the `รายละเอียดชั่วโมงสอนโค้ช` modal loaded, Coach Tony NA Rama 2 showed Monday-Sunday ranges `1 มิ.ย. 69 - 7 มิ.ย. 69`, `8 มิ.ย. 69 - 14 มิ.ย. 69`, `15 มิ.ย. 69 - 21 มิ.ย. 69`, `22 มิ.ย. 69 - 28 มิ.ย. 69`, and `29 มิ.ย. 69 - 5 ก.ค. 69`; legacy ranges `31 พ.ค. 69 - 6 มิ.ย. 69` and `7 มิ.ย. 69 - 13 มิ.ย. 69` were not found.
  - Production smoke for `/coach` and `/coach/hours` loaded without crash and with console errors/warnings 0. Coach weekly visual rows remain `NEED REVIEW` only because the smoke coach session had no real weekly rows visible.
  - No DB changes, migrations, closed-summary repair/migration/delete, payroll rate changes, coach evidence requirement changes, attendance logic changes, payment/booking/wallet/Admin Makeup/SlipOK changes, write action clicks, `ปิดสัปดาห์` clicks, or extra deploys after smoke were performed.
- Admin financial visibility gating is deployed in production as of commit `846fb8097bee086c994c21b039568bc61592d08c`:
  - Deployment id `dpl_Gg64CoEQmxEuzj11bPqqCSVG1nxv`; production alias `https://www.newathleteschool.com`; deployment status Ready.
  - Source scope was limited to `src/app/(admin)/admin/page.tsx`, `src/app/(admin)/admin/payments/page.tsx`, and `src/components/admin/payments-client.tsx`.
  - Owner policy: standard Admin does not need complete per-item amount redaction; the goal is to avoid easy visibility of revenue totals, aggregate summaries, and total amounts. `payment.notes` remains visible and is not sanitized/redacted in this scope.
  - `/admin` gates the monthly revenue query/card by role. Super Admin still sees `รายได้เดือนนี้`; standard Admin does not query/render the revenue card.
  - `/admin/payments` uses server-side role gating. Standard Admin does not receive/render approved amount summaries, incomplete booking total summaries, payment row amounts, incomplete booking row amounts, or detail/review amount fields; Super Admin sees amounts as before.
  - Standard Admin still sees payment/booking status, slip, payer info, Booking ID, Payment ID, branch/course/date/time, and the existing `สลิป` / `รายละเอียด` workflow controls.
  - Production smoke passed for Super Admin and standard Admin. Super Admin saw dashboard revenue `฿591,672`, payment approved amount `฿594,872`, incomplete total `฿8,500`, row amounts, and detail amounts. Standard Admin did not see those totals/amount fields and saw `ซ่อนยอดเงินตามสิทธิ์ผู้ใช้` where applicable.
  - Console errors were 0; the only warning was the existing unrelated Next dev LCP logo warning. No DB changes, migrations, payment status logic changes, SlipOK logic changes, write action clicks, or extra deploys after smoke were performed.
- Admin notifications low-enrollment count and hydration fixes are deployed in production:
  - Low-enrollment source commit `9b88fbdf98e9146941dd5ea01c32fa6abc79bfc3` (`fix(admin): align low-enrollment alert counts`) changed `src/app/(admin)/admin/notifications/page.tsx`; deployment id `dpl_JDhvkyBxHzzSmMNqmpoUvHPJ6CqX`; production alias `https://www.newathleteschool.com`; status Ready.
  - React hydration source commit `953edc93266ea81f3b84afd0ee0fbe3cd3de3f05` (`fix(admin): stabilize notifications hydration`) changed `src/app/(admin)/admin/notifications/page.tsx` and `src/components/admin/notifications-admin-client.tsx`; deployment id `dpl_FFzuVkJqFGNrAnHFzbpBBySzc3Jz`; production alias `https://www.newathleteschool.com`; status Ready.
  - Low-enrollment root cause: the old alert counted only `booking_sessions.status === scheduled` and did not require `bookings.status = verified`, so the 2026-06-21 10:00 Ratchaphruek-Taling Chan kids_group round excluded 4 verified completed learners and counted 1 pending_payment scheduled learner.
  - Low-enrollment alert logic now counts only verified bookings, counts real learner statuses `scheduled`, `completed`, and `absent`, excludes `rescheduled`, `walleted`, `cancelled`, and non-verified bookings, groups by `schedule_slot_id` first, and falls back to `date + start_time + end_time + branch_id + course_type_id`. It also uses Asia/Bangkok-safe date logic and paginates/range-batches instead of relying on `.limit(700)`.
  - Data proof for schedule slot `02aa539d-b602-4a95-9ade-5a0285e0ae6f`: old alert count was 1, new verified real learner count is 4, and 4 is above the low-enrollment threshold of 2, so the round should not show as low-enrollment.
  - After deploying the low-enrollment fix, production `/admin/notifications` reproduced React minified error #418 on initial load. The root cause was non-deterministic client/server date rendering: `toLocaleString('th-TH')` without fixed timezone, `todayCount` using runtime `new Date().toDateString()`, and locale sorting without an explicit deterministic tie-breaker.
  - Hydration fix: notification date formatting now uses `Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', ... })`, the server sends a deterministic Bangkok `todayDateKey`, `todayCount` compares against Bangkok date keys, and sort paths use explicit `th-TH` locale plus stable id tie-breakers.
  - Verification passed before final deploy: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check` with only known Windows LF/CRLF warnings where applicable.
  - Local authenticated `/admin/notifications` smoke passed after two hard refreshes: console errors/warnings were 0, no React hydration error, no React #418, no text mismatch, and sections rendered for urgent work, recommendations, customer follow-up, and low-enrollment.
  - Production smoke after final deploy passed: `/admin/notifications` loaded with Admin session and no redirect; fresh cache-buster load, two hard refreshes, and a read-only click on the recommendations tab produced console errors/warnings 0, no React #418, no hydration error, no text mismatch, and all notification sections rendered. The old 2026-06-21 UI case is `NEED REVIEW` only because it is outside the current window; source/data proof confirms the new count is 4 and above threshold.
  - No DB changes, migrations, write actions, Admin Makeup changes, Lesson Wallet changes, SlipOK changes, payment/booking write logic changes, docs changes before smoke, or extra deploys after final smoke were performed.
- Attendance display derivation no longer treats a learner as absent merely because another learner in the same slot/group has attendance. A past session without exact learner attendance now stays in `attendance_gap_review`; `absent` requires exact attendance/source-of-truth evidence or an explicitly synced absent session.
- Admin makeup check-in evidence regression guard, added 2026-06-08:
  - The review section "ต้องตรวจสอบการเช็คชื่อก่อนสรุปขาดเรียน" must not show coach check-in evidence for a learner session unless that learner is linked to a `coach_assignment_groups` row and the `coach_checkins` row matches the exact `schedule_slot_id + coach_id`.
  - A same-slot check-in from another coach must not be displayed as evidence when the learner session still says "ยังไม่พบโค้ชในกลุ่ม".
  - If a future report shows "ยังไม่พบโค้ชในกลุ่ม" together with "ได้เช็คอินแล้ว", first run read-only debug against `booking_sessions`, `coach_assignment_groups`, `coach_assignment_group_students`, `coach_checkins`, and `attendance` before changing code or data.
  - Expected proof table should include: `booking_session_id`, learner name, `schedule_slot_id`, group id, group coach id/name, slot check-in coach id/name, exact-pair check-in result, slot-only check-in result, and attendance status.
  - Safe fix direction, if root cause is confirmed again: remove slot-only check-in evidence from the Admin makeup review display and require exact group coach evidence only; keep slot-only data as diagnostic metadata at most.
  - Read-only proof on 2026-06-08 confirmed this exact pattern for 2026-06-07 16:00-18:00 at สุวรรณภูมิ: learner session `7513b5d0-f5c4-43d8-bb61-bac051c97e09` had no `coach_assignment_group_students` link and no exact coach evidence, while the same `schedule_slot_id` had check-ins from other assigned coaches. This is a slot-only fallback contamination bug, not proof that the ungrouped learner's coach checked in.
  - Scoped source fix on 2026-06-08 removed the slot-only check-in fallback from `src/app/(admin)/admin/makeup/page.tsx`. Admin makeup now passes coach check-in evidence only when the learner session is linked to a coach assignment group and the check-in matches the exact `schedule_slot_id + coach_id`.
  - Post-fix read-only proof for session `7513b5d0-f5c4-43d8-bb61-bac051c97e09` showed `slot_only_has_checkin=true` but `new_server_would_show_checkin_for_no_group=false`.
  - Verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, and `npm run build`.
  - No DB writes, migration, commit, push, or deploy were run for this scoped fix.
- Admin schedules vs Admin makeup assignment-source regression guard, added 2026-06-08:
  - Reported pattern: `admin/schedules` can show coach names on a learner row while `admin/makeup` says the same learner session has no coach in group / no exact coach check-in.
  - This must be debugged before any source or DB change because `admin/schedules` may display slot-level or legacy coach fallback while `admin/makeup` intentionally requires exact learner-group evidence.
  - Required invariant: learner-level coach display must come from exact `coach_assignment_group_students.booking_session_id -> coach_assignment_groups.coach_id` when deciding whether that learner has an assigned coach.
  - `coach_assignments` or other slot-level coach lists may be diagnostic/legacy context only; they must not prove that a specific learner is assigned to that coach.
  - Read-only proof table must include: `booking_session_id`, learner name, `schedule_slot_id`, branch/course/time, exact group id/name, exact group coach id/name, all same-slot groups/coaches, legacy `coach_assignments` coaches, exact-pair coach check-in result, and exact learner attendance status.
  - Safe fix direction if confirmed: make `admin/schedules` distinguish exact learner coach assignment from slot-level/legacy coach context, and do not weaken `admin/makeup` exact-evidence rules.
  - Read-only proof on 2026-06-08 for Tin session `fcd3e6ea-bac1-4513-8261-ff26e931f7ce`: exact `coach_assignment_group_students` count is 0, exact check-ins count is 0, and exact attendance count is 0. The same `schedule_slot_id` has other groups and legacy slot coaches for other learners only. Therefore `admin/makeup` is correct to show no coach in group; `admin/schedules` must not show same-slot or legacy coaches as Tin's assigned coaches.
  - Scoped source fix on 2026-06-08 removed slot-level/legacy coach fallback from `src/app/(admin)/admin/schedules/page.tsx` and from `adminAttendanceState.getCoachNames`. Admin schedules now shows coach names only from exact learner assignment groups (`coach_assignment_group_students.booking_session_id -> coach_assignment_groups.coach_id`).
  - Verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, and `npm run build`.
  - No DB writes, migration, commit, push, or deploy were run for this scoped fix.
- Admin payroll teaching-hours regression guard, added 2026-06-08:
  - Reported pattern: `/admin/payroll` showed 0 coaches / 0 assigned rounds / 0 payable hours for June 2026 even though production data had assigned groups, verified bookings, coach check-ins, and attendance.
  - Read-only proof showed June 2026 source data existed: hundreds of schedule slots and assignment groups, 908 payable grouped sessions by status, 86 coach check-ins, 208 attendance rows, and about 394 potential payroll source rows.
  - Root cause: the payroll page used the normal user-session Supabase client for sensitive payroll source tables and did not run an explicit Admin page guard, while `getCoachTeachingHourSourceRows` ignored Supabase query errors and could silently return empty rows.
  - Source fix on 2026-06-08: `src/app/(admin)/admin/payroll/page.tsx` now requires Admin page access and uses `getServiceRoleClient()` server-side for payroll summaries, teaching rules, and teaching-hour source rows. The service key remains server-only.
  - Source fix on 2026-06-08: `src/lib/coach-teaching-hours.ts` now throws descriptive errors for every Supabase query failure instead of silently treating failed reads as empty payroll data.
  - Payroll business rules were not changed: verified teaching evidence still requires active assigned learners, verified bookings, valid session lifecycle status, exact coach/slot check-in, photo, GPS, and attendance.
  - Verification passed locally: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
  - No DB writes, migration, cleanup, commit, push, or deploy were run for this scoped fix.
- Read-only verification on 2026-06-04 for June 2026 coach assignment groups:
  - groups: 197
  - group session ids: 422
  - chunks: 6
  - active grouped sessions: 405
  - query errors: 0
- Commit `48e3faa` (`fix(prod): stabilize coach checkin audit and child booking guards`) was pushed to `spike/next-major-security-upgrade` and deployed to Vercel production on 2026-06-04.
- Commit `86aa087` (`fix(makeup): improve attendance gap round handling`) was pushed to `spike/next-major-security-upgrade` and deployed to Vercel production on 2026-06-05.
  - Vercel deployment id reported by CLI: `dpl_G79NWgVY7R4PMC2FsiMArXRhN4SS`.
  - Production alias reported by Vercel CLI: `https://www.newathleteschool.com`.
  - Pre-deploy checks passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
  - Scope: Admin makeup attendance-gap round handling, exact coach evidence, no-coach round resolution, and round-level Admin actions.
  - Remaining risk: manual production/local smoke for Admin makeup round-level flows is still pending. Do not perform production write actions for smoke unless the owner explicitly confirms the exact case.
- Documentation sync verification on 2026-06-05:
  - `npm run check:mojibake` passed.
  - `npx tsc --noEmit` passed.
  - `npm run lint` passed.
  - `npm run attendance:reconcile:dry-run` passed with 0 student-scope attendance mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
  - `npm run build` passed.
  - `npm run prod:check` passed with warning that local `SLIPOK_TEST_MODE=true`; production must keep real SlipOK env configured.
  - `git diff --check` reported only LF/CRLF warnings for the documentation files.
- False-absent display fix verification on 2026-06-05:
  - `npm run check:mojibake` passed.
  - `npx tsc --noEmit` passed.
  - `npm run lint` passed.
  - `npm run attendance:reconcile:dry-run` passed with 0 student-scope attendance mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
  - `npm run build` passed.
- Production alias reported by Vercel CLI: `https://www.newathleteschool.com`.
- Historical child FK/name integrity repair on 2026-06-04 fixed one target booking where Admin schedule displayed the parent name as learner:
  - parent profile: `211069ab-7a7d-457d-8b22-f76e8d3ecae3`
  - child row: `65a94ede-296e-4bbe-9bab-2aaf03b99c7e`
  - booking: `080c8a56-9b67-4a83-a44b-5a0394f4b73f`
  - affected `booking_sessions`: 16 rows, repaired from `child_id=null` to the target child id
  - post-write sample join resolves to child name `สัจจธร ธิติศักดิ์สกุล` / nickname `น้องอองเดร`
- Admin schedule now has a UI guard for child bookings with missing `child_id`, so it flags missing child linkage instead of silently showing the parent as the learner. Coach assignment state is also color-coded: assigned coach is green, missing coach is red.
- Next production focus should be role smoke testing and any broader historical child FK audit only if new evidence appears.
- Auth UX polish on 2026-06-06 added password visibility toggles to login/register password fields in the Home auth modal and direct auth pages. This is UI-only and does not change Supabase auth, redirects, email confirmation, or validation behavior.

## Worktree Notes

- Historical note: before the documentation sync after `86aa087`, `git status --short` showed an untracked `SlipOK API Guide.docx`.
- Current note for the 2026-07-09 documentation verification pass: `git status --short` was clean before edits, and `SlipOK API Guide.docx` was not present in the workspace.

If a local guide/document appears again in future work, treat it as out of scope unless the owner explicitly asks to commit, delete, or move it.

## 2026-06-12 - New Machine Handoff Readiness

- Local repo was re-checked after moving to the new machine.
- Current branch: `spike/next-major-security-upgrade`.
- Current HEAD: `cec49fd fix(user): align dashboard learner colors`.
- `node` is available as `v24.16.0`, which satisfies the repo engine requirement `>=20.9.0`.
- `npm.cmd` is available as `11.13.0`.
- Direct `npm` from PowerShell is blocked by Windows Execution Policy because `npm.ps1` cannot be loaded. Use `npm.cmd` and `npx.cmd` in this shell unless the owner changes the policy.
- `node_modules`, `package-lock.json`, `.env.local`, and `.next` are present locally.
- Local `.env.local` values were not printed or inspected directly, but `npm.cmd run prod:check` confirmed the required Supabase environment variables are present.
- Verification after the move passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run prod:check`
- Historical result at that time: `npm.cmd run prod:check` reported `SLIPOK_TEST_MODE=true` as a warning and recommended live mode. This guidance is superseded by the 2026-07-11 Owner-approved shared Test Mode policy above.
- `npm.cmd run build` was not run in this readiness pass because no source code changed and the project handoff guide requires a dev-server/static-chunk cleanup cycle after build work.

## 2026-06-12 - Phase 3 Read-Only Role Smoke Readiness

- Read-only scope only: no source code changes, no DB writes, no migrations, no payment/booking/wallet/coupon/assignment/payroll-close actions.
- Read `PRODUCTION_READINESS.md` and `DEVELOPMENT_TODO.md` section `21. Phase 3 Deploy Readiness`.
- Local dev server was started only for smoke testing at `http://127.0.0.1:3000` and stopped after the smoke pass.
- Public page smoke passed:
  - `/` loaded with non-empty content and no browser console errors captured.
  - `/ranking` loaded with non-empty ranking content and no browser console errors captured.
  - `/auth/login` loaded the login form.
  - `/auth/register` loaded the registration form.
- Unauthenticated auth-guard smoke passed:
  - `/dashboard`, `/dashboard/schedule`, `/dashboard/lesson-wallet`
  - `/coach`, `/coach/today`, `/coach/checkin`, `/coach/attendance`
  - `/admin`, `/admin/schedules`, `/admin/makeup`, `/admin/payroll`
  - All protected routes redirected to `/auth/login?redirect=...` and loaded the login page.
- Authenticated role page-load/empty-state smoke remains `Need verification` because the in-app browser did not have an authenticated test session and no role-specific test credentials were provided in this read-only round.
- Read-only verification passed:
  - `npm.cmd run prod:check` with the expected local `SLIPOK_TEST_MODE=true` warning.
  - `npm.cmd run attendance:reconcile:dry-run` with 0 student-scope mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run check:mojibake`
- Dev server log showed one non-blocking Next.js LCP image recommendation for `/logo new-athlete-school.jpg`. No code change was made.

## 2026-06-12 - Authenticated Role Smoke Readiness Partial

- Owner approved opening Coach/Head Coach pages even though `src/app/(coach)/layout.tsx` may create coach notification rows on page load.
- Test credentials were used only through the browser UI. Passwords were not written to files or documentation.
- Local dev server was started only for smoke testing at `http://127.0.0.1:3000` and stopped after the smoke pass.
- User smoke passed:
  - Login redirected to `/dashboard`.
  - `/dashboard`, `/dashboard/schedule`, and `/dashboard/lesson-wallet` loaded with non-empty content.
  - User guard redirected `/coach` and `/admin` back to `/dashboard`.
  - No browser console errors were captured for the User routes.
  - Lesson wallet showed real action buttons such as `ใช้วันเรียน`; they were not clicked.
- Coach/Head Coach smoke partially passed:
  - The supplied Coach account displayed as `Super Head Coach (หัวหน้า)`, not as a standard Coach account.
  - `/coach`, `/coach/today`, `/coach/checkin`, and `/coach/attendance` loaded.
  - `/coach/assign-groups` was accessible and loaded, consistent with the displayed Head Coach status.
  - `/admin` redirected back to `/coach`.
  - No browser console errors were captured for the Coach/Head Coach routes.
  - Risky buttons such as check-in and assignment-group actions were visible but not clicked.
- Super Admin smoke partially passed:
  - Login redirected to `/admin`.
  - `/admin`, `/admin/schedules`, `/admin/makeup`, `/dashboard`, and `/coach` loaded during the observed pass.
  - Super Admin menu showed Super Admin-only items including `Activity Log` and `ตั้งค่าระบบ`.
  - `/admin/makeup` loaded but emitted a React hydration mismatch console error. The mismatch sample showed server/client text difference for a learner display (`ZEN` vs Thai learner name) inside `MakeupClient`.
  - After the `/admin/makeup` hydration error, the same browser tab continued reporting that error on later navigations. A clean per-route recheck was attempted, but browser navigation timed out before completing the confirmation pass.
- Standard Admin smoke remains `Need verification` because no standard Admin account was provided.
- Standard Coach smoke remains `Need verification` because the supplied Coach account displayed Head Coach privileges.
- Head Coach smoke is partially covered by the supplied Head Coach-like account and Super Admin coach surface, but a true standalone Head Coach account is still `Need verification` if role-specific permissions must be proved.
- No source code changes, DB migrations, payment/booking/wallet/coupon/payroll-close actions, commit, push, deploy, or `SlipOK API Guide.docx` action were performed.

Potential bug found:

- `/admin/makeup` has a hydration mismatch in the browser console during authenticated Super Admin smoke.
- Suggested debug plan before any code change:
  - Reproduce `/admin/makeup` in a fresh browser tab/session and capture the exact hydration mismatch segment.
  - Inspect `src/app/(admin)/admin/makeup/page.tsx` and the `MakeupClient` rendering path for nondeterministic ordering, locale/date formatting, or server/client learner-name fallback differences.
  - Verify whether row ordering or display-name selection can change between SSR and hydration.
  - Only after root cause is proven, propose a scoped source fix and run `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run attendance:reconcile:dry-run`, and targeted browser smoke.

## 2026-06-12 - Admin Makeup Hydration Fix + Super Admin Clean Recheck

- Scoped debug reproduced `/admin/makeup` in a fresh tab with the authenticated Super Admin browser session.
- Root cause proved source-only:
  - `MakeupClient` sorted learner names with default `localeCompare`.
  - Node SSR sorted `['ZEN', 'โซเลน']` as `['โซเลน', 'ZEN']`.
  - Browser hydration sorted the same names as `['ZEN', 'โซเลน']`.
  - React therefore reported a text mismatch inside the learner card (`ZEN` vs `โซเลน`).
- Scoped fix:
  - `src/components/admin/makeup-client.tsx` now uses an explicit Thai-locale comparator with deterministic code-point/id tie-breakers for learner-name sort paths used by MakeupClient.
  - No Admin makeup action flow, API route, database data, migration, payment, booking, lesson wallet, coupon, assignment, or payroll-close logic was changed.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - Post-build AGENTS cleanup: stopped dev server, removed generated `.next`, restarted dev server.
  - Browser smoke: fresh `/admin/makeup?smoke=after-fix` tab loaded with heading `วันชดเชย`, no fresh console error/warn, and no hydration mismatch.
- Super Admin clean-tab recheck after the fix passed with no fresh console error/warn:
  - `/admin/payroll`
  - `/admin/settings`
  - `/admin/users`
  - `/admin/branches`
  - `/admin/coaches`
- No DB writes, migrations, write actions, payment/booking/wallet/coupon/assignment/payroll-close actions, commit, push, deploy, or `SlipOK API Guide.docx` action were performed.

## 2026-06-12 - Standard Admin Authenticated Smoke

- A Standard Admin test account was used only through the browser UI. Passwords were not written to files or documentation.
- Local smoke remained read-only: no Admin write buttons were clicked, no DB writes, migrations, payment/booking/lesson wallet/coupon/assignment/payroll-close actions, commit, push, deploy, or `SlipOK API Guide.docx` action were performed.
- Login redirected to `/admin`.
- Standard Admin menu was permission-scoped for this account. Visible admin menu entries were:
  - `/admin`
  - `/admin/schedules`
  - `/admin/users`
  - `/admin/ranking`
  - `/admin/payments`
  - `/admin/coupons`
  - `/admin/complaints`
  - `/admin/notifications`
- Visible/allowed route smoke passed with no fresh browser console error/warn:
  - `/admin` loaded with heading `ภาพรวมระบบ`.
  - `/admin/schedules` loaded with heading `ตารางเรียน`.
  - `/admin/users` loaded with heading `จัดการนักเรียน / ผู้ปกครอง`.
  - `/admin/ranking` loaded with heading `อันดับนักเรียน`.
  - `/admin/payments` loaded with heading `ตรวจสอบการชำระเงิน`.
  - `/admin/coupons` loaded with heading `คูปองส่วนลด`.
  - `/admin/complaints` loaded with heading `ร้องเรียน`.
  - `/admin/notifications` loaded with heading `แจ้งเตือน`.
- Permission/guard smoke passed with direct navigation redirecting back to `/admin` and no fresh browser console error/warn:
  - `/admin/makeup`
  - `/admin/payroll`
  - `/admin/settings`
  - `/admin/logs`
  - `/admin/branches`
  - `/admin/coaches`
  - `/admin/coach-checkins`
  - `/admin/finance`
  - `/admin/teaching-programs`
  - `/admin/schedule-templates`
  - `/admin/booking`
- Cross-portal route smoke matched current `ROLE_ROUTES` behavior:
  - `/coach` loaded for Standard Admin with the coach surface and no assignment-groups menu text.
  - `/dashboard` loaded for Standard Admin.
  - `/profile` loaded for Standard Admin.
- Logout returned to `/`.
- Owner clarified Standard Coach UI expectation: same as Head Coach except without the assignment/round-group menu. A role-pure Standard Coach browser smoke is still `Need verification` unless a Standard Coach account is provided.

## 2026-06-12 - Phase 3 Local Release Readiness Verification

- Scope was verification-only: no feature work, no commit, no deploy, no DB writes, no migrations, no write-action clicks, and no `SlipOK API Guide.docx` action.
- Diff review covered only:
  - `src/components/admin/makeup-client.tsx`
  - `PROJECT_STATE.md`
  - `TODO-CODEX.md`
- Diff review result:
  - `src/components/admin/makeup-client.tsx` only adds deterministic Thai-locale learner-name sorting plus stable tie-breakers inside `MakeupClient`.
  - The source change is scoped to render ordering for Admin makeup hydration stability. It does not change Admin makeup actions, API routes, attendance/payment/booking/wallet/coupon/assignment/payroll-close behavior, DB data, or migrations.
  - `PROJECT_STATE.md` and `TODO-CODEX.md` only document local readiness, smoke results, the hydration root cause/fix, and remaining verification gaps.
  - Credential scan across the three scoped files found no supplied email/password strings.
  - No out-of-scope source logic was found in the reviewed diff.
- Command verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run attendance:reconcile:dry-run`
  - `npm.cmd run prod:check`
  - `git diff --check`
- `attendance:reconcile:dry-run` remained report-only and showed 1060 verified teaching sessions checked, 295 attendance rows checked, 0 student-scope mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
- Historical result at that time: `prod:check` returned `READY WITH WARNINGS/PASSES` and treated `SLIPOK_TEST_MODE=true` as a warning. This guidance is superseded by the 2026-07-11 Owner-approved shared Test Mode policy above.
- `git diff --check` reported only Windows LF/CRLF working-copy warnings, not whitespace errors.
- Browser smoke attempt:
  - Local dev server started at `http://127.0.0.1:3000` only for smoke and was stopped afterward.
  - In-app browser loaded `/auth/login`, but Super Admin login did not establish an authenticated session in this smoke attempt. Direct admin route attempts redirected to `/auth/login?redirect=...`.
  - Browser console showed only the known Next.js LCP image warning for `/logo new-athlete-school.jpg`; no fresh hydration mismatch was captured in the attempted admin-route tabs.
  - Because authenticated admin session was not established in this browser attempt, the requested fresh-tab browser smoke for `/admin/makeup`, `/admin`, `/admin/schedules`, `/admin/payments`, and `/coach` is `Need verification` for this release-readiness pass.
- Release gate for this pass:
  - `PASS`: scoped diff review and command verification.
  - `NEED VERIFICATION`: authenticated browser smoke in a clean session for Super Admin admin routes and Coach/Head-Coach `/coach`; role-pure Standard Coach browser smoke.
  - `RISK / OWNER APPROVAL REQUIRED`: production deploy, production writes, Admin makeup write-action UAT, live SlipOK verification, and any commit/deploy decision.
  - `BLOCKER`: none found in source checks; browser smoke remains incomplete because auth/session could not be established in the in-app browser attempt.

## 2026-06-12 - Super Admin Authenticated Release Smoke Recheck

- Owner logged in as Super Admin locally, then the Chrome connector saw the authenticated `http://127.0.0.1:3000/admin` session.
- Scope remained read-only: no commit, deploy, DB writes, migrations, payment/booking/wallet/coupon/assignment/payroll-close actions, or Admin makeup write-action clicks.
- Fresh-tab Chrome smoke passed for the requested Super Admin routes:
  - `/admin/makeup` loaded with heading `วันชดเชย`, did not redirect to login, had no fresh console errors, and had no React hydration mismatch.
  - `/admin` loaded with heading `ภาพรวมระบบ`, did not redirect to login, had no fresh console errors, and had no hydration mismatch.
  - `/admin/schedules` loaded with heading `ตารางเรียน`, did not redirect to login, had no fresh console errors, and had no hydration mismatch.
  - `/admin/payments` loaded with heading `ตรวจสอบการชำระเงิน`, did not redirect to login, had no fresh console errors, and had no hydration mismatch.
- `/admin/makeup` still displayed real write-action buttons such as retrospective attendance, confirm absent, return entitlement, close case, and send-to-coach actions; none were clicked.
- Release gate after this recheck:
  - `PASS`: scoped source diff review, command verification, and Super Admin authenticated smoke for `/admin/makeup`, `/admin`, `/admin/schedules`, and `/admin/payments`.
  - `NEED VERIFICATION`: role-pure Standard Coach browser smoke and any Coach/Head-Coach release-gate route not covered by the latest Super Admin admin-route recheck.
  - `RISK / OWNER APPROVAL REQUIRED`: commit, deploy, production writes, live SlipOK verification, and Admin makeup write-action UAT.
  - `BLOCKER`: none found in the checked source/commands/Super Admin smoke routes.

## 2026-06-13 - Owner-Approved Angie Attendance Repair

- Root cause proved before write:
  - Admin closed the target `/admin/makeup` review with `attendance_gap_closed_no_action`.
  - That close action only created an `activity_logs` row and hid the Admin review queue item.
  - The underlying source-of-truth data still had `booking_sessions.status = scheduled` and no exact `attendance` row, so Coach/User surfaces continued deriving `attendance_gap_review`.
- Exact target repaired:
  - learner: `ชนกนันท์ สุขวงศ์` / `แองจี้`
  - `booking_sessions.id`: `734ce70b-5a6d-4bf0-9544-0deb631aee26`
  - `booking_id`: `a7b06735-ce69-43dc-ae35-c67e24328c0a`
  - `child_id` / expected `attendance.student_id`: `900ebb5d-2eb1-4143-82a0-86e47757338b`
  - `schedule_slot_id`: `69bb4231-6472-4376-931a-57ac9a4570dc`
  - date/time: `2026-06-07` `13:00:00-15:00:00`
  - branch/course: Chaengwattana / `kids_group`
- Owner-approved data repair performed:
  - inserted exact `attendance` row `9582fab4-151c-4a85-a36d-05aab5802ef0` with `status = absent`, `student_type = child`, and assigned coach `95bf2081-e9f9-4aa1-883c-7294d2b8ce33`.
  - synced `booking_sessions.status` for `734ce70b-5a6d-4bf0-9544-0deb631aee26` to `absent`.
  - inserted audit log `3cef354c-939d-4937-9c53-705ab8f25ef2` with action `attendance_gap_confirm_absent`, referencing previous close log `3c2ef466-ec6c-49f7-970a-badbd196c951`.
- Post-write verification:
  - exact attendance count for the target session/student is 1 and status is `absent`.
  - target session status is `absent`.
  - no lesson wallet credit was created by this repair.
  - no coach check-in row was created.
  - no weekly teaching summary row was created for the assigned coach/date.
  - source/data projection now derives the target User/Admin status as `absent` instead of `attendance_gap_review`.
  - Coach attendance slot summary can count the learner as checked because exact attendance exists, but `src/components/coach/attendance-client.tsx` still has a separate card-level `isLocked = !slot.checkin` warning path. That is a follow-up UI/logic issue and was not changed in this data repair.
  - `npm.cmd run attendance:reconcile:dry-run` passed with 0 student-scope mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
- No source code, migrations, payment, booking, lesson wallet redemption, coupon, assignment, payroll close, commit, push, deploy, or `SlipOK API Guide.docx` action was performed in this repair.
- Follow-up risk remains: the Admin Makeup `close_review` UX can still be misused for sudden-leave/absence cases. Future source fix should be scoped and owner-approved before changing action semantics or UI copy.

## 2026-06-13 - Coach UI Attendance/Check-in State Sync

- Scoped source fix only; no DB writes, migrations, API write logic, check-in evidence rules, payroll calculation, payment, booking, lesson wallet, coupon, assignment, payroll close, commit, push, deploy, or `SlipOK API Guide.docx` action was performed.
- Fixed Coach UI display state after an attendance row already exists but the slot has no coach check-in:
  - `src/components/coach/attendance-client.tsx` now distinguishes the UI gate `no check-in + no attendance yet` from `no check-in + attendance already recorded`.
  - `src/components/coach/attendance-client.tsx` still disables attendance write buttons when there is no check-in, preserving the existing coach write guard.
  - `src/app/(coach)/coach/page.tsx` now shows pending check-in CTA/status only for today's slots that still have no check-in and incomplete attendance, instead of treating every no-check-in slot as pending.
- `/coach/today` was inspected and already had a complete-attendance display path, so it was not changed.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run attendance:reconcile:dry-run` with 0 student-scope mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
  - `npm.cmd run prod:check` with the known local `SLIPOK_TEST_MODE=true` warning.
  - `npm.cmd run build`
  - Post-build AGENTS cleanup: stopped the dev server on port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified `/` plus a `_next/static` CSS asset returned HTTP 200.
  - `git diff --check` reported only Windows LF/CRLF warnings, not whitespace errors.
- Browser smoke notes:
  - A headless Chrome smoke before restart logged in with the supplied Coach/Head-Coach account and loaded `/coach`, `/coach/today?date=2026-06-07`, and `/coach/attendance?date=2026-06-07&slot=69bb4231-6472-4376-931a-57ac9a4570dc` with no console errors.
  - That account did not show the target Angie slot, so exact target visual verification remains `Need verification` with the real assigned coach account or an authenticated session that can see that slot.
  - A post-restart retry stayed on `/auth/login` and did not establish a session before timeout; no console error was captured.

## 2026-06-13 - Coach Hours No-Teaching Label Sync

- Scoped source/UI fix only; no DB writes, migrations, API write logic, check-in evidence rules, payroll calculation, payment, booking, lesson wallet, coupon, assignment, payroll close, commit, push, deploy, or `SlipOK API Guide.docx` action was performed.
- Fixed `/coach/hours` display for all-absent rounds where no class happened and the coach did not check in:
  - `src/lib/coach-teaching-hours.ts` now carries attendance status counts (`present_count`, `late_count`, `absent_count`) in addition to total `attendance_count`.
  - `src/app/(coach)/coach/hours/page.tsx` now displays `ไม่มีการสอน - ไม่มีผู้เรียนในรอบนี้` when every learner in the row has exact absent attendance and there is no coach check-in.
  - The same no-teaching row is no longer counted as a missing-evidence warning in `/coach/hours`; the row remains not counted for hours.
- Payroll/teaching-hour calculation semantics were intentionally not changed in this scoped label sync. Any future rule change for all-absent rows that already have coach check-in evidence must be scoped and owner-approved separately.
- Read-only target proof for Angie session `734ce70b-5a6d-4bf0-9544-0deb631aee26` confirmed `session_status=absent`, `attendance_total=1`, `absent_count=1`, `present_count=0`, `late_count=0`, and the new no-teaching label predicate evaluates to `true`.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run attendance:reconcile:dry-run` with 0 student-scope mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
  - `npm.cmd run prod:check` with the known local `SLIPOK_TEST_MODE=true` warning.
  - `npm.cmd run build`
  - Post-build AGENTS cleanup: stopped the dev server on port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified `/` plus a `_next/static` CSS asset returned HTTP 200.
  - `git diff --check` reported only Windows LF/CRLF warnings, not whitespace errors.
- Authenticated browser visual smoke for `/coach/hours` remains `Need verification` with a real coach session that can see the target slot. Passwords were not written to files or scripts for this verification.

## 2026-06-13 - Phase A Status Derivation Audit

- Read-only audit only. No source code, DB data, migrations, refactors, payroll behavior, attendance behavior, makeup behavior, commit, deploy, or `SlipOK API Guide.docx` action was performed.
- Files audited:
  - `src/lib/session-attendance-status.ts`
  - `src/lib/admin-attendance-state.ts`
  - `src/lib/attendance-write-through.ts`
  - `src/lib/coach-teaching-hours.ts`
  - `src/app/(coach)/coach/page.tsx`
  - `src/app/(coach)/coach/today/page.tsx`
  - `src/app/(coach)/coach/hours/page.tsx`
  - `src/components/coach/attendance-client.tsx`
  - `src/app/(admin)/admin/schedules/page.tsx`
  - `src/app/(admin)/admin/makeup/page.tsx`
  - `src/components/admin/payroll-client.tsx`
  - read-only payroll API context: `src/app/api/admin/coach-payouts/route.ts`
- Status groups identified:
  - Learner attendance status: exact `attendance` row should lead; `booking_sessions.status` and date/time are fallback/cache only.
  - Teaching slot status: Coach dashboard/today/attendance derive slot state locally from check-in plus per-student attendance completion.
  - Coach evidence status: `src/lib/coach-teaching-hours.ts` derives evidence from assignment groups, active learner sessions, coach check-in, photo, GPS, and attendance counts.
  - Admin review status: `/admin/makeup` combines learner attendance state with `activity_logs` review request/closed actions.
  - Payroll status: Admin payroll and payout close use `row.is_verified` from coach teaching-hour source rows and separate missing-evidence counts.
- Confirmed audit findings:
  - Admin learner display is mostly aligned where it uses `src/lib/admin-attendance-state.ts`, especially `/admin/schedules` and `/admin/makeup`.
  - Coach surfaces still contain duplicated slot/check-in/attendance summary logic across `/coach`, `/coach/today`, and `attendance-client`.
  - `/coach/hours` now has a display-only no-teaching/all-absent path, but Admin payroll and payout close still use the original evidence/payroll semantics. Payroll behavior must not be changed without a separate owner-approved scope.
  - `/admin/makeup` review close state is separate from learner attendance state. A closed review can hide a queue item without changing attendance; this is intentional in current code but remains a UX/process risk after the Angie incident.
- Suspicious or needs-verification items:
  - `scopeAttendanceCount` is accepted by `deriveSessionAttendanceStatus` but is not currently used by the helper.
  - `getCoachTeachingHourSourceRows` treats any attendance evidence as `has_attendance`; the business rule for all-absent rows with full coach evidence needs owner confirmation before payroll changes.
  - `/coach` pending evidence counts do not share the exact same no-teaching exclusion that `/coach/hours` now uses.
  - `src/components/admin/payroll-client.tsx` has evidence badge logic duplicated from `/coach/hours` and can still label no-check-in/all-absent rows as missing check-in from a payroll-evidence perspective.
- Draft direction for Phase B:
  - Start display-only. Create or extend shared derivation helpers only after choosing the smallest contract boundary.
  - Keep payroll calculation/close semantics separate from Coach UI display semantics until the owner approves exact payroll rules.
  - Keep Admin Makeup write/action semantics separate from display status cleanup.
  - Verify with `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run attendance:reconcile:dry-run`, and targeted browser smoke for the touched routes.

## 2026-06-13 - Phase B.1 Coach Display Status Sync

- Scoped Coach display/read-only status source fix only. No DB data, migrations, payroll calculation, Admin Makeup action, payment, booking, lesson wallet, coupon, assignment, attendance write behavior, commit, deploy, or `SlipOK API Guide.docx` action was performed.
- Added `src/lib/coach-slot-display-status.ts` as a small pure helper for Coach slot display state.
- Normalized Coach display slot states for:
  - `/coach`
  - `/coach/today`
  - `/coach/attendance`
- Normalized statuses are display-only:
  - `no_learners`
  - `needs_checkin`
  - `checked_in_waiting_attendance`
  - `partial_attendance`
  - `attendance_complete`
  - `resolved_without_checkin`
- Source changes:
  - `src/app/(coach)/coach/page.tsx` now uses the shared helper for pending check-in display counts.
  - `src/app/(coach)/coach/today/page.tsx` now uses the shared helper for slot attendance badges and completed-result display.
  - `src/components/coach/attendance-client.tsx` now uses the shared helper for slot card badges, locked display state, completed count, and partial/resolved-without-checkin display.
- Preserved behavior:
  - Coach attendance write buttons are still disabled when the exact slot has no coach check-in.
  - No API write paths were changed.
  - Payroll/evidence calculation and Admin Makeup review/action semantics were not touched.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run attendance:reconcile:dry-run` with 0 student-scope mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
  - `npm.cmd run build`
  - Post-build AGENTS cleanup: stopped port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified `/` plus a `_next/static` CSS asset returned HTTP 200.
- Browser smoke:
  - Unauthenticated read-only smoke for `/coach`, `/coach/today`, and `/coach/attendance` redirected to `/auth/login?redirect=...` with no console errors.
  - Authenticated Coach visual smoke remains `Need verification` with a real Coach/Head-Coach session because the browser used for this smoke did not have a Coach session.
- Authenticated Coach smoke attempt after owner supplied a Coach account:
  - No source code, DB data, migrations, payroll calculation, Admin Makeup action, payment, booking, lesson wallet, coupon, assignment, attendance write action, commit, deploy, or `SlipOK API Guide.docx` action was performed.
  - The supplied account was used only through the browser login UI. Passwords were not written to project files or documentation.
  - Login did not succeed locally. `/auth/login` displayed `อีเมลหรือรหัสผ่านไม่ถูกต้อง` after the supplied credential attempt.
  - Because no authenticated Coach session was established, `/coach`, `/coach/today`, and `/coach/attendance` could not be authenticated-smoked in this pass.
  - Browser console during the login attempt showed only the known local Next.js LCP image warning for `/logo new-athlete-school.jpg`; no fresh console error was captured.
  - Gate for authenticated Coach smoke: `BLOCKER` at login credential/session establishment; route-level Phase B.1 authenticated visual status remains `NEED VERIFICATION`.
- Authenticated Coach smoke retry after owner logged in manually:
  - Used the existing Chrome session already logged in by the owner. No password was entered or written to files/docs.
  - Smoke remained read-only: no attendance save, check-in, payroll, Admin Makeup action, payment, booking, lesson wallet, coupon, assignment, DB write, migration, source code change, commit, deploy, or `SlipOK API Guide.docx` action was performed.
  - `/coach` loaded without redirect, heading `หน้าหลักโค้ช`, and no status conflict was observed.
  - `/coach/today` loaded without redirect, heading `ตารางสอนของฉัน`; observed completed/check-in labels were consistent, including `เช็คอินแล้ว` and `บันทึกผลครบแล้ว`.
  - `/coach/attendance` loaded without redirect, heading `เช็คชื่อนักเรียน`; observed summary showed complete slots, `ยังล็อก/รอเช็คอิน 0`, and `ยังเช็คไม่ครบ 0`. Slot badges showed `บันทึกผลครบแล้ว .../...` together with `เช็คอินแล้ว`.
  - No `partial attendance` case appeared in the visible smoke data, so partial label rendering remains covered by source/checks but not visually exercised in this browser pass.
  - Browser console showed no errors. Warning observed: known local Next.js `scroll-behavior: smooth` warning during route transitions.
  - Logout was performed after smoke as requested and returned to the public home page.
  - Gate result: `PASS` for authenticated Phase B.1 Coach smoke on `/coach`, `/coach/today`, and `/coach/attendance`; `NEED VERIFICATION` only for a real data case that visibly contains partial attendance.
- Phase B.1 release/deploy:
  - Commit `640519d` (`fix(coach): unify slot display status`) was pushed to `spike/next-major-security-upgrade` and deployed to Vercel production on 2026-06-13.
  - Full deployed commit: `640519dbc6b75c9186d7e47966b6f384f75999fc`.
  - Vercel deployment id: `dpl_7ZBqt1Fct47o5UAvwKiEDsH7pTVT`.
  - Deployment URL: `https://new-athlete-badminton-school-f73lmp4a8-aachanin1s-projects.vercel.app`.
  - Production alias: `https://www.newathleteschool.com`.
  - Deployment was run from a clean temporary worktree pinned to commit `640519d`; the untracked `SlipOK API Guide.docx` was not included.
- Production post-deploy Coach smoke for Phase B.1:
  - Smoke remained read-only: no check-in, attendance save, payroll, Admin Makeup action, payment, booking, lesson wallet, coupon, assignment, DB write, migration, source change, commit, deploy, or `SlipOK API Guide.docx` action was performed.
  - Used the Coach account only through the production login UI. Passwords were not written to project files or documentation.
  - `/coach` loaded on `https://www.newathleteschool.com/coach` without redirecting back to login. Observed heading `หน้าหลักโค้ช`, 4 rounds today, and status text `สถานะเช็คชื่อไม่ค้างแล้ว 4/4 รอบ`; no visible status conflict was confirmed.
  - `/coach/today` loaded on `https://www.newathleteschool.com/coach/today` without redirecting back to login. Observed heading `ตารางสอนของฉัน`, `เช็คอินแล้ว`, and `บันทึกผลครบแล้ว` badges including `7/7`, `1/1`, and `4/4`; learner labels included `มาเรียนแล้ว` and `ขาดเรียน`.
  - `/coach/attendance` loaded on `https://www.newathleteschool.com/coach/attendance` without redirecting back to login. Observed heading `เช็คชื่อนักเรียน`, summary `รอบทั้งหมด 4`, `บันทึกผลครบแล้ว 4`, `ยังล็อก/รอเช็คอิน 0`, and `ยังเช็คไม่ครบ 0`; slot badges showed `บันทึกผลครบแล้ว .../...` together with `เช็คอินแล้ว`.
  - Browser console for all three route tabs showed no errors or warnings.
  - No visible `บันทึกผลบางส่วน` data appeared in production during this smoke, so partial-attendance visual label remains `NEED VERIFICATION` for a future real partial data case.
  - Gate result: `PASS` for production page load, auth redirect, console, and observed Coach display status on `/coach`, `/coach/today`, and `/coach/attendance`; `NEED VERIFICATION` only for a future visible partial-attendance data case.

## 2026-06-13 - Phase B.2 Admin Makeup Process Contract Audit

- Read-only audit only. No source code, DB data, migrations, production Admin Makeup actions, payroll calculation, payment, booking, lesson wallet, coupon, assignment, commit, deploy, or `SlipOK API Guide.docx` action was performed.
- Files audited:
  - `src/app/(admin)/admin/makeup/page.tsx`
  - `src/components/admin/makeup-client.tsx`
  - `src/app/api/admin/makeup/route.ts`
  - `src/lib/admin-attendance-state.ts`
  - `src/lib/session-attendance-status.ts`
  - `src/lib/attendance-write-through.ts`
- Confirmed Admin Makeup action behavior:
  - `close_review` writes only `activity_logs.action = attendance_gap_closed_no_action`; it does not write `attendance`, does not sync `booking_sessions.status`, does not create wallet credit, and intentionally hides the review/evidence queue item on `/admin/makeup`.
  - `confirm_absent` writes exact learner `attendance.status = absent`, syncs `booking_sessions.status = absent` through `attendance-write-through`, logs `attendance_gap_confirm_absent`, and notifies the user schedule.
  - `mark_attendance` writes exact learner `attendance.status = present|late|absent`, syncs `booking_sessions.status = completed|absent`, logs `attendance_gap_mark_retrospective`, and can create retrospective coach assignment/group context when no assigned coach exists and Admin selects a coach.
  - `return_entitlement` creates or reuses an active `lesson_wallet_credits` row, updates `booking_sessions.status = walleted`, logs `attendance_gap_return_entitlement`, and notifies the user wallet. It does not write `attendance`.
  - `request_coach_review` notifies assigned coach(es) to check attendance, logs `attendance_gap_request_coach_review`, and does not change attendance/session status.
  - `request_coach_evidence` requires exact learner attendance plus assigned coach, checks for complete coach check-in evidence, notifies coach(es) if evidence is missing, logs `attendance_gap_request_coach_evidence`, and does not change attendance/session status.
  - `resolve_unassigned_round` is a round-level flow for no-coach past rounds: creates retrospective assignment group/legacy assignment, writes exact attendance per learner, syncs each session status, logs `attendance_gap_resolve_unassigned_round`, and notifies users.
- Confirmed display/source contract:
  - `/admin/makeup` derives review queue visibility from `session-attendance-status`, exact learner attendance from `admin-attendance-state`, exact group coach/check-in evidence, and review activity logs.
  - `attendance_gap_closed_no_action` is review metadata only. It is not attendance proof and must not be treated as absence, completion, wallet, makeup entitlement, or coach-payable evidence.
  - Makeup entitlement creation is derived from exact absence/status display for missed sessions; review closure alone should not create entitlement.
- Suspicious behavior to plan before fixing:
  - `return_entitlement` has no API guard against an existing attendance row. If used on a coach-evidence review session that already has attendance, it can set `booking_sessions.status = walleted` while `attendance` still says present/late/absent, creating a source-of-truth conflict.
  - `mark_attendance` allows `attendance_status = absent`, which overlaps semantically with `confirm_absent` but logs a different activity action.
  - `close_review` is a high-risk UX action because it removes the Admin review item without changing User/Coach-visible attendance state.
  - Group-level actions loop across sessions one by one and are not transactional; partial success before a failure is possible for notifications/logs/status writes.
  - Creating a makeup session via `POST /api/admin/makeup` still updates scheduled source sessions to `absent` without writing an exact attendance row; treat this as legacy/high-risk and audit separately before changing.
- Draft process contract:
  - Attendance outcome actions must write exact `attendance` first and sync `booking_sessions.status` through `src/lib/attendance-write-through.ts`.
  - Review-only actions may notify/log but must not be used to imply attendance, wallet entitlement, or coach evidence.
  - Entitlement-return actions must be mutually exclusive with existing attendance unless the owner approves a special override flow.
  - Round-level no-coach actions should stay round-scoped so every learner in the same slot receives the same process decision.
- Recommended Phase B.2 fix plan, pending owner approval:
  - First source fix should be narrow and safety-oriented: guard `return_entitlement` against exact existing attendance and tighten UI copy/confirmation around `close_review`.
  - Second source fix, if owner approves, should decide whether `mark_attendance` should allow `absent` or whether all absent outcomes must use `confirm_absent`.
  - Keep payroll calculation, Admin Makeup POST/create-makeup behavior, and assignment semantics out of the first fix round.

## 2026-06-14 - Phase B.2-New.1 Admin Makeup Round-Level UX

- Scoped UI/UX source fix only. No DB data, migrations, payroll calculation, wallet/return-entitlement logic, create-makeup POST, payment, booking, coupon, assignment semantics, commit, deploy, or `SlipOK API Guide.docx` action was performed.
- Updated `src/components/admin/makeup-client.tsx` so Admin Makeup review groups now use two explicit UX paths:
  - Assigned-coach rounds show round-level actions: send/request coach review or evidence, record retroactive attendance for the whole round, and close the whole round.
  - No-coach rounds preserve the existing regression guard: only `จัดการเคสทั้งรอบ` is shown; per-learner action buttons and the three assigned-coach round actions are not shown.
- Added assigned-coach round modal for `บันทึกย้อนหลังทั้งรอบ`:
  - Lists every learner in the attendance-review round.
  - Requires a selected status for every learner before save is enabled.
  - Requires an audit reason before save is enabled.
  - Uses the existing `mark_attendance` PATCH write path per learner; no API semantics were changed.
  - Copy now states that complete attendance does not mean coach selfie/GPS/check-in evidence is complete.
- Per-learner primary buttons in the visible round review UI were replaced with explanatory copy directing Admins to use round-level actions.
- Preserved no-coach flow:
  - Existing no-coach dialog still opens from `จัดการเคสทั้งรอบ`.
  - Existing `resolve_unassigned_round` path and no-coach process semantics were not changed.
  - The no-coach learner-row warning remains visible: use the round button only so individual results do not split from the same round.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run attendance:reconcile:dry-run` with 0 student-scope mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
  - `npm.cmd run build`
  - Post-build AGENTS cleanup: removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified `http://127.0.0.1:3000` returned HTTP 200.
- Authenticated local browser smoke for `/admin/makeup`:
  - Used Admin/Super Admin login UI only for smoke; passwords were not written to project files or docs.
  - Page loaded without redirect after login and showed the Admin Makeup review section.
  - Assigned-coach cards showed `ส่งให้โค้ชตรวจสอบรอบนี้` or `ขอหลักฐานโค้ชรอบนี้`, `บันทึกย้อนหลังทั้งรอบ`, and `ปิดเคสทั้งรอบ`.
  - Assigned-coach learner rows no longer showed visible per-person primary buttons such as `ยืนยันขาด` or `คืนสิทธิ์`.
  - The assigned-coach round attendance modal opened read-only; save was disabled while statuses/reason were incomplete, and the evidence-vs-attendance copy was visible.
  - No-coach cards showed only `จัดการเคสทั้งรอบ`; no assigned-coach three-button set or per-person action buttons were visible.
  - The existing no-coach dialog opened read-only and was closed without saving.
  - Browser console showed no errors. One known local Next.js dev warning appeared about `scroll-behavior: smooth`.

## 2026-06-14 - Phase B.2-New.2 No-Coach Assign-Only Flow

- Scoped Admin Makeup API/UI source fix only. No direct DB data repair, migrations, payroll calculation, wallet/return-entitlement logic, payment, coupon, booking/create-makeup POST, deploy, or `SlipOK API Guide.docx` action was performed.
- Commit `ebee5f7` (`fix(makeup): assign no-coach rounds without attendance`) was pushed to `spike/next-major-security-upgrade`. It has not been deployed.
- Added new `PATCH /api/admin/makeup` action `assign_coach_to_round`.
- `assign_coach_to_round` writes only assignment/review side effects:
  - Inserts one `coach_assignment_groups` row for the selected coach and round.
  - Inserts `coach_assignment_group_students` rows for every selected learner session in the no-coach round.
  - Ensures legacy `coach_assignments` compatibility for the selected `schedule_slot_id + coach_id`.
  - Logs `activity_logs.action = attendance_gap_assign_coach_round` for each selected session.
  - Sends one coach notification to review the assigned round.
- `assign_coach_to_round` intentionally does not write `attendance`, does not call `upsertRetrospectiveAttendance`, does not call `syncBookingSessionStatusFromAttendance`, and does not update `booking_sessions.status`.
- Validation added for `assign_coach_to_round`:
  - `session_ids`, `coach_id`, and `reason` are required.
  - `coach_id` must be a `coach` or `head_coach` profile.
  - Target sessions must all exist, share the same schedule slot/date/time/branch, be normal non-makeup `scheduled` sessions, and be past sessions in Bangkok time.
  - Every target session must resolve an expected learner id.
  - If any target session already has a strict learner group coach assignment, the action rejects and tells Admin to refresh and use the assigned-coach flow.
- Updated `src/components/admin/makeup-client.tsx` no-coach dialog:
  - No-coach cards still show only `จัดการเคสทั้งรอบ`.
  - For `สอนจริง แต่ลืมมอบหมาย/เช็คชื่อ`, Admin selects only coach + reason.
  - Learners are shown read-only with copy saying the coach should review and record attendance after assignment.
  - Status selects for individual learners were removed from this no-coach assign mode.
  - Save calls `assign_coach_to_round`; after success the page refreshes so the round can enter the assigned-coach UX.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run attendance:reconcile:dry-run` with 0 student-scope mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
  - `npm.cmd run build`
  - Post-build cleanup/restart: removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local HTTP 200.
- Authenticated local browser smoke for `/admin/makeup`:
  - Page loaded without redirect and with no console errors.
  - No-coach cards still showed only `จัดการเคสทั้งรอบ`, with no assigned-coach three-button set or per-person actions.
  - No-coach dialog `สอนจริง...` showed coach selection + reason + read-only learner labels; no `ผลเช็คชื่อรายคน` label and no `เลือกสถานะ` placeholder appeared.
  - `มอบหมายโค้ชให้รอบนี้` was disabled while coach/reason were incomplete.
  - Assigned-coach cards still showed the round-level action set, and the `บันทึกย้อนหลังทั้งรอบ` modal still opened with disabled save while incomplete.

### Phase B.2-New.2 Release Gate

- Source checks: PASS.
- Build: PASS.
- Read-only browser smoke: PASS.
- Owner-run production write UAT for `assign_coach_to_round` was read-only verified on 2026-06-16: PASS for the exact 2026-06-14 16:00-18:00 Ratchada target session assigned to Coach Link.
- Earlier implementation smoke did not create fake test data and did not click a real save/write action before owner approval.
- Commit `6ab8e37` was deployed to Vercel production on 2026-06-14.
  - Deployment id: `dpl_D5wsjCNRNuHgjebsS9KiSNwupmuU`.
  - Deployment URL: `https://new-athlete-badminton-school-d4g9qm8na-aachanin1s-projects.vercel.app`.
  - Production alias: `https://www.newathleteschool.com`.
- Production read-only smoke for `/admin/makeup` after deploy:
  - Used an existing authenticated Chrome Super Admin session. The in-app browser redirected to login and was not used for authenticated smoke.
  - `/admin/makeup` loaded on production and showed no-coach plus assigned-coach review cards.
  - No-coach cards still showed only `จัดการเคสทั้งรอบ`; learner rows kept the warning to use the round-level button only.
  - No-coach dialog mode `สอนจริง แต่ลืมมอบหมาย/เช็คชื่อ` showed coach selection + reason, read-only learner labels, no per-learner status select, and disabled `มอบหมายโค้ชให้รอบนี้` while incomplete.
  - Assigned-coach cards still showed the round-level actions `ส่งให้โค้ชตรวจสอบรอบนี้`/review request, `บันทึกย้อนหลังทั้งรอบ`, and `ปิดเคสทั้งรอบ`.
  - `บันทึกย้อนหลังทั้งรอบ` modal opened and disabled `บันทึก attendance ทั้งรอบ` while learner statuses/reason were incomplete.
  - No production write action was submitted.
  - Console result: NEED VERIFICATION / BLOCKER for clean-console gate because Chrome captured `Error: Minified React error #418` from `/_next/static/chunks/4bd1b696-e356ca5ba0218e27.js` during `/admin/makeup` hydration.

## 2026-06-15 - Phase B.2-New.3 Past-Round Coach Replacement

- Scoped Admin Makeup API/UI/helper source fix only. No DB data repair, migrations, payroll calculation changes, attendance write behavior changes, payment, booking, coupon, deploy, commit, or `SlipOK API Guide.docx` action was performed.
- Added `PATCH /api/admin/makeup` action `replace_coach_for_past_round` for past normal rounds where the real coach differs from the assigned coach.
- New action validates `session_ids`, `coach_id`, and `reason`; validates one same past normal `schedule_slot_id`; rejects makeup/walleted/cancelled/non-past rounds; validates the selected profile is `coach` or `head_coach`; and rejects a selected coach already assigned to another learner group in the same slot.
- Replacement behavior:
  - Updates exact `coach_assignment_groups.coach_id` for learner groups linked to the selected sessions.
  - Creates a retrospective group only for selected sessions that still have no exact group.
  - Ensures legacy `coach_assignments` compatibility for the new coach.
  - Logs `activity_logs.action = attendance_gap_replace_coach_round` per selected session with previous coach ids, new coach id, changed group ids, affected session ids, reason, and flags that no attendance/session status was changed.
  - Notifies the new coach to check in retrospectively with selfie/GPS.
- `src/lib/coach-attendance-review.ts` now treats `attendance_gap_replace_coach_round` as an Admin-returned review action, so only the notified/new coach can use the retrospective check-in exception for that slot.
- Updated `src/components/admin/makeup-client.tsx`:
  - Assigned-coach review cards now include `เปลี่ยนโค้ชย้อนหลัง`.
  - The dialog requires a new coach and audit reason, lists learners read-only, and states that the action changes responsibility/requests evidence without writing attendance or deleting old evidence.
- Business rules preserved:
  - `/coach/assign-groups` remains locked after the slot starts.
  - `attendance` remains the source of truth and is not written by the replacement action.
  - Old coach check-in evidence is not deleted; exact current assignment plus new coach check-in remains required for complete evidence/payroll review.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run attendance:reconcile:dry-run` with 0 student-scope mismatches, 0 status mismatches, and 0 booking-status-without-attendance rows.
  - `npm.cmd run build`
  - Post-build cleanup/restart: stopped port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local `/` plus `_next/static/chunks/webpack.js` returned HTTP 200.
  - Local Chrome read-only smoke for `/admin/makeup` redirected to `/auth/login?redirect=%2Fadmin%2Fmakeup` with no console errors. Known local warning observed: LCP image warning for `/logo new-athlete-school.jpg`.
- Owner-run production write UAT for `replace_coach_for_past_round` was read-only verified on 2026-06-16: PASS for the exact 2026-06-14 15:00-17:00 Rama 2 target group changed to Coach Jom.
- Commit `6606f41` (`fix(makeup): support past round coach replacement`) was pushed to `spike/next-major-security-upgrade` and deployed to Vercel production on 2026-06-15.
  - Deployment id: `dpl_5BN7cSZH8ecQhbkFScpjxZZjJZWq`.
  - Deployment URL: `https://new-athlete-badminton-school-9vfzr03lm-aachanin1s-projects.vercel.app`.
  - Production alias: `https://www.newathleteschool.com`.
  - Vercel status: Ready.
  - Production read-only smoke after deploy: `/` returned HTTP 200, `_next/static/chunks/webpack-6fbcecb408fbe888.js` returned HTTP 200, and `/admin/makeup` returned HTTP 307 to `/auth/login?redirect=%2Fadmin%2Fmakeup`.
  - Vercel CLI logs for the deployment window showed info-level requests only during smoke; no error/fatal runtime logs were returned by the Vercel MCP query, though the MCP reported a 403 warning while paging runtime logs.

## 2026-06-15 - Admin Payroll Evidence List Visibility

- Scoped Admin Payroll UI fix only. No DB writes, migrations, payroll calculation semantics, attendance writes, commit, push, or deploy were performed.
- Reported pattern: Coach Link NA Ratchada had completed/check-in/attendance evidence for 2026-06-11, but the visible `/admin/payroll` evidence list stopped at 2026-06-10.
- Read-only DB proof for coach `412a8f42-d069-4b1d-9b2c-abce93f0dc82` confirmed 2026-06-11 has 2 verified payroll source rounds:
  - 13:00-15:00 at Ramintra: 1 linked/payable session, 1 attendance row (`present`), exact coach check-in with photo and GPS.
  - 17:00-19:00 at Ratchada: 3 linked/payable sessions, 3 attendance rows (`present`), exact coach check-in with photo and GPS.
- Root cause: `src/components/admin/payroll-client.tsx` rendered only the first 8 evidence rows and first 8 issue rows with `slice(0, 8)`. The 2026-06-11 rounds were verified rows 9 and 10, so they were hidden from the visible list even though source data was present.
- Source fix: Admin Payroll now renders all verified evidence rows and all issue rows for the selected coach/month instead of silently truncating after 8.
- Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, and `npm.cmd run build`.
- Post-build cleanup/restart completed: stopped port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local `/` plus `_next/static/chunks/webpack.js` returned HTTP 200.
- Local browser smoke: `/admin/payroll` redirected unauthenticated local browser to `/auth/login?redirect=%2Fadmin%2Fpayroll` as expected, with no console errors on recheck.
- Commit `40f86cf` (`fix(payroll): show all evidence rows`) was pushed to `spike/next-major-security-upgrade`; follow-up doc commit `7e85504` (`docs: record payroll deploy`) was also pushed.
  - Final production deployment id: `dpl_21B3aVVFBiV8rmAUTKWsgPf2rxhk`.
  - Deployment URL: `https://new-athlete-badminton-school-jhz9ma53y-aachanin1s-projects.vercel.app`.
  - Production alias: `https://www.newathleteschool.com`.
  - Vercel status: Ready.
  - Production read-only smoke after deploy: `/` returned HTTP 200, `_next/static/chunks/webpack-6fbcecb408fbe888.js` returned HTTP 200, and `/admin/payroll` returned HTTP 307 to `/auth/login?redirect=%2Fadmin%2Fpayroll`.
  - Vercel CLI logs for the final deployment window returned no runtime logs; no error/fatal runtime logs were returned by the CLI query.
- Authenticated production Chrome smoke for `/admin/payroll` after deploy:
  - Loaded `https://www.newathleteschool.com/admin/payroll` with the existing Super Admin session and did not redirect to login.
  - Browser console showed no errors or warnings.
  - Coach Link NA Ratchada detail dialog opened read-only; the verified evidence list included both 2026-06-11 rows (`13:00-15:00` Ramintra and `17:00-19:00` Ratchada), confirming the production UI no longer stops at 2026-06-10 / 8 rows.
  - The dialog showed `ปิดสัปดาห์` buttons, including one enabled write action; no payroll write action was clicked.
  - Production authenticated smoke gate for the payroll evidence-list visibility fix: PASS.

## 2026-06-15 - Admin Makeup React #418 Timezone Display Fix

- Scoped Admin Makeup display-only fix only. No DB writes, migrations, API semantics changes, business behavior changes, payroll/payment/booking/wallet/coupon/assignment changes, `assign_coach_to_round`, `replace_coach_for_past_round`, commit, push, deploy, or `SlipOK API Guide.docx` action was performed.
- Production authenticated `/admin/makeup` still emitted `Minified React error #418` on page-load hydration after deploy `6606f41`.
- Read-only debug narrowed the likely root cause to check-in date/time text rendering in `src/components/admin/makeup-client.tsx`:
  - `formatDateTime()` formatted Supabase timestamp values with `Intl.DateTimeFormat('th-TH')` without an explicit timezone.
  - Vercel/server rendering can format the same timestamp in UTC while Chrome/user rendering formats it in Asia/Bangkok.
  - Proof command showed the same timestamp renders as `4 Jun 69 09:42` in UTC and `4 Jun 69 16:42` in Asia/Bangkok unless `timeZone: 'Asia/Bangkok'` is set.
- Source fix: `formatDateTime()` now sets `timeZone: 'Asia/Bangkok'`.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - `git diff --check` passed with the known Windows LF/CRLF warning for `src/components/admin/makeup-client.tsx`.
  - Post-build cleanup/restart completed: stopped port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local `/` plus `_next/static/chunks/webpack.js` returned HTTP 200.
  - Authenticated local Chrome smoke for `/admin/makeup` loaded with no console errors and no React #418. No write action was clicked.
- Commit `d59af8c` (`fix(makeup): stabilize checkin time hydration`) was pushed to `spike/next-major-security-upgrade` and deployed to Vercel production on 2026-06-15.
  - Deployment id: `dpl_A2RWoVHBxgKev3CN7J7zco2NPDvA`.
  - Deployment URL: `https://new-athlete-badminton-school-4xigsjz4k-aachanin1s-projects.vercel.app`.
  - Production alias: `https://www.newathleteschool.com`.
  - Vercel status: Ready.
- Authenticated production Chrome smoke for `/admin/makeup` after deploy:
  - Loaded `https://www.newathleteschool.com/admin/makeup` without redirecting to login.
  - Browser console showed no errors or warnings and no React #418.
  - Page showed Super Admin/Admin Makeup content, no-coach round controls, and assigned-coach round controls.
  - No production write action was clicked.
- Production clean-console gate for the React #418 timezone display fix: PASS.

## 2026-06-15 - Admin Makeup Round-Level Request Counter Display

- Scoped Admin Makeup client display fix only. No API semantics, write behavior, `activity_logs`, `notifications`, DB data, migrations, payroll/booking/wallet/payment/coupon/assignment, commit, push, deploy, or `SlipOK API Guide.docx` action was performed.
- Reported pattern: `/admin/makeup` round 2026-06-14 15:00-17:00 at Rama 2 had 5 learners. One click on the round-level send-to-coach-review action produced per-session audit logs, but the card badge displayed the request count as 5.
- Root cause: `src/components/admin/makeup-client.tsx` grouped learner sessions into round cards and summed `coach_review_requested_count` and `coach_evidence_requested_count` across sessions. The server still reads `activity_logs` per `booking_sessions` row, and the API still logs/notifies per session.
- Source fix: round card display aggregation now uses the maximum per-session request count for both coach review and coach evidence counters instead of summing all learner/session counters.
- Business behavior preserved: internal per-learner/per-session log and notification rows may still exist, but the card badge/button count now displays the round-level count.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - `git diff --check` with only the known Windows LF/CRLF warning for `src/components/admin/makeup-client.tsx`.
  - Post-build cleanup/restart completed: stopped port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local `/` plus `_next/static/chunks/webpack.js` returned HTTP 200.
- Authenticated local Chrome read-only smoke for `/admin/makeup` passed:
  - Page loaded without login redirect and without console errors or Next error overlay.
  - The reported 2026-06-14 15:00-17:00 Rama 2 round with 5 learners showed the coach review counter as 1 instead of 5, including the button suffix `(1)`.
  - No-coach round cards still showed the round-level case-management control.
  - Assigned-coach cards still showed the expected review, coach replacement, retrospective attendance, and close-case controls.
  - No write action was clicked.
- No current visible coach-evidence request-count case was present in the smoke data, but the same display aggregation path was fixed for evidence counters.
- Commit `c4a75c1` (`fix(makeup): show round-level review request counts`) was pushed and deployed to Vercel production on 2026-06-15.
  - Deployment id: `dpl_qMctHJktpKKHDMZPVtwHwe5r3p2G`.
  - Deployment URL: `https://new-athlete-badminton-school-b59ov4rbb-aachanin1s-projects.vercel.app`.
  - Production alias: `https://www.newathleteschool.com`.
  - Vercel status: Ready.
- Owner-confirmed production smoke after deploy: the round that previously showed `ส่งให้โค้ชแล้ว 5 ครั้ง` now shows `ส่งให้โค้ชแล้ว 1 ครั้ง`. No production write action was clicked. Counter aggregation bug is resolved in production.

## 2026-06-16 - Admin Makeup Production Write UAT Verification

- Owner performed the production write actions; Codex performed read-only post-write verification only. No source code, DB data, migrations, rollback, deploy, or `SlipOK API Guide.docx` action was performed.
- `assign_coach_to_round` production UAT PASS for 2026-06-14 16:00-18:00 at Ratchada:
  - Exact target booking session: `c4a375b6-4bf1-4305-8932-c47e5f53270d` for learner `คีน` (`55af6613-e4fa-44c5-a0cf-b5142df6955c`).
  - New group `c500256e-bd39-44e9-96e4-a26e725c5b9e` points to Coach Link (`412a8f42-d069-4b1d-9b2c-abce93f0dc82`) and has the expected one `coach_assignment_group_students` row.
  - Legacy `coach_assignments` compatibility row `f7c21caf-27fc-4db7-9ff6-6fde38e405cc` exists for Coach Link and slot `0a346a9a-e603-4da6-9d49-6c417774ea01`.
  - Activity log `065e09fd-d7f5-48f8-997b-faea142acc3d` has `attendance_gap_assign_coach_round`, `attendanceWritten:false`, and `bookingSessionStatusChanged:false`.
  - Notification `a7e6c328-0a8e-48b2-bbce-9df504201f8f` was sent to Coach Link with the expected attendance link.
  - No `attendance` rows exist for the target session, and `booking_sessions.status` remains `scheduled` with `updated_at` still before the UAT write.
- `replace_coach_for_past_round` production UAT PASS for 2026-06-14 15:00-17:00 at Rama 2:
  - Exact target booking sessions: `1cb6f5bf-9df4-4051-9e8d-d4e305b91af0` (`น้องขิม`), `6b822eb9-87b8-4271-922b-283d9c367f92` (`บิว`), `5c560343-79d5-42ea-be0d-ccf567d67d05` (`พราว`), `1ce69fb4-6641-4ebb-a480-9011892573a5` (`ภานันต์`), and `fe1e3ebe-9976-4e83-be29-051f918ed3c3` (`ภูมิ`).
  - Group `cf18d7df-f42e-4852-8255-a96b25c10c7e` now points to Coach Jom (`b852eb8f-7989-4fba-958d-b7a28bcfea4d`) and still has all five learner rows.
  - Previous coach recorded in logs: Coach Tony (`f8fde879-4be7-4225-a6be-c05f45c37a32`). Legacy `coach_assignments` compatibility row `d1a752c4-ebf7-470c-bd7f-ac1f7808f428` exists for Coach Jom and slot `9ffb311c-8ff6-481b-9498-a382ff7c10c9`.
  - Five `attendance_gap_replace_coach_round` activity logs exist, one per target session, all with `attendanceWritten:false` and `bookingSessionStatusChanged:false`.
  - Notification `c7a24182-0d9d-492b-bc11-34f395ca7335` was sent to Coach Jom with the expected retrospective check-in link.
  - No `attendance` rows exist for the five target sessions, and all five `booking_sessions.status` values remain `scheduled` with `updated_at` still before the UAT write.
  - Existing slot check-in evidence rows for Coach Ten and Coach Ja remain present. There is no current Coach Tony check-in row for this slot to preserve, so Tony-specific evidence deletion cannot be proved from a post-only snapshot; source inspection confirms the replace action has no evidence delete path.
- Tables observed written by the owner-run UAT: `coach_assignment_groups`, `coach_assignment_group_students`, `coach_assignments`, `activity_logs`, and `notifications`.
- Tables/areas confirmed not written by these actions for the target sessions: `attendance`, `booking_sessions.status`, DB migrations, payroll, booking, wallet, payment, coupon, assignment semantics outside the tested coach-assignment compatibility rows, and SlipOK guide/docs.
- Rollback assessment: no rollback recommended from read-only verification; no blocker found.

## 2026-06-16 - User Booking History Reschedule Clarity

- Scoped User/Admin booking-history display fix only. No DB writes, migrations, booking creation/reschedule semantics, payment logic, attendance logic, commit, push, or deploy were performed.
- Context: read-only investigation of parent `pick2523@hotmail.com` showed booking `925362e8-fc3d-4f46-a41d-a49758212450` has 20 active June 2026 sessions for ต้นข้าว/ต้นบุญ, plus 6 `booking_sessions.status = rescheduled` history rows. Active sessions were not missing; rescheduled rows were old rounds moved through the parent account.
- Source fix: `/dashboard/history` now fetches `booking_sessions.rescheduled_from_id` and counts only active statuses (`scheduled`, `completed`, `absent`) for session-count completion messaging.
- Source fix: `src/components/dashboard/history-client.tsx` now shows booking detail with separate sections for:
  - "รอบที่นับในคอร์ส" from active sessions only.
  - "ประวัติการเลื่อนรอบ" from `rescheduled` rows, with a link to the replacement row when `rescheduled_from_id` is available.
- Booking cards and grouped pending-payment summaries now count learner sessions from active rows only, so rescheduled history rows no longer inflate per-child session counts.
- Business rules unchanged: rescheduled rows remain audit/history, wallet/payment/attendance/payroll behavior was not changed.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - Post-build cleanup/restart: no existing port 3000 listener, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local `/` plus `_next/static/chunks/webpack.js` returned HTTP 200.
  - In-app browser read-only smoke: `/dashboard/history` redirected unauthenticated local access to `/auth/login?redirect=%2Fdashboard%2Fhistory` with no console errors.

## 2026-06-16 - Admin Schedules Month Pagination Fix

- Scoped `/admin/schedules` source fix only. No DB writes, migrations, booking/reschedule/payment/attendance logic changes, assignment semantics changes, Admin makeup changes, payroll changes, commit, push, or deploy were performed.
- Root cause proved read-only: June 2026 schedule data exceeded the Supabase/PostgREST 1,000 row cap. A broad `/admin/schedules` query stopped before 2026-06-28, hiding active booking sessions for booking `925362e8-fc3d-4f46-a41d-a49758212450`.
- Source fix: `src/app/(admin)/admin/schedules/page.tsx` now parses `year`/`month` from URL query params, defaults invalid or missing params to the current month, applies server-side month date filters, and fetches `booking_sessions` in stable `date/start_time/id` order with paginated `.range()` batches until the last short batch.
- Related reads for wallet credits, assignment groups, slot session attendance scope, and attendance are constrained to the fetched month/session/slot ids and chunked where needed. Supabase errors now throw descriptive errors instead of failing silently for the schedule data path.
- Source fix: `src/components/admin/schedules-client.tsx` now receives the server-selected month and updates the URL with `router.push('/admin/schedules?year=YYYY&month=M')` when changing month or jumping to today. Existing client-side search/branch/course filters still run against the loaded month sessions.
- Read-only verification after the fix:
  - `/admin/schedules?year=2026&month=6` month query loaded 1,136 rows in batches of 1,000 and 136.
  - Booking `925362e8-fc3d-4f46-a41d-a49758212450` had 20 active rows in the loaded month: `ต้นข้าว` 10 and `ต้นบุญ` 10. The 6 `rescheduled` rows remained excluded from active counts.
  - 2026-06-28 rows were present for `ต้นข้าว` and `ต้นบุญ`, both 16:00-18:00 at `รัชดา`.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - `git diff --check` with only known Windows LF/CRLF warnings.
  - Post-build cleanup/restart completed: stopped port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local `/` plus `_next/static/chunks/webpack.js` returned HTTP 200.
  - Unauthenticated local `/admin/schedules?year=2026&month=6` returned HTTP 307 to `/auth/login?redirect=%2Fadmin%2Fschedules`.
  - Authenticated local Chrome read-only smoke on `http://localhost:3000/admin/schedules?year=2026&month=6` loaded without login redirect and without console errors. Searching `วรวรรณ จินตานนท์` showed 20 rows and two 2026-06-28 cards for `ต้นข้าว` and `ต้นบุญ`, both 16:00-18:00 at `รัชดา`.

## 2026-06-16 - Dashboard History Status Display Consistency

- Scoped `/dashboard/history` display-status fix only. No DB writes, migrations, booking write logic, reschedule API, payment logic, attendance write logic, Admin makeup, payroll, commit, push, or deploy were performed.
- Root cause: `/dashboard/history` detail/list badges used raw `booking_sessions.status`, while `/dashboard/schedule` derives display state from attendance/time via `src/lib/session-attendance-status.ts`. Past raw `scheduled` sessions with no exact attendance could therefore show `นัดหมาย` in history while the schedule calendar showed `รอตรวจสอบการเช็คชื่อ`.
- Source fix: `src/app/(dashboard)/dashboard/history/page.tsx` now reads attendance rows read-only for loaded booking sessions in chunks, matches exact `booking_session_id + expected student_id`, derives server-side `display_status` with `deriveSessionDisplayStatus()`, and keeps raw `status` unchanged for lifecycle/count/reschedule logic.
- Source fix: `src/components/dashboard/history-client.tsx` now uses `display_status` for session badges and keeps raw `status` for active count and rescheduled history separation. The active count semantics remain `scheduled/completed/absent` only.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - `git diff --check` with only known Windows LF/CRLF warnings.
  - Post-build cleanup/restart completed: stopped port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local `/` plus `_next/static/chunks/webpack.js` returned HTTP 200.
  - Authenticated local Chrome read-only smoke on `http://localhost:3000/dashboard/history` loaded the reported 16-session booking at Rama 2 without console errors. The detail dialog still showed `13/16`; past raw `scheduled` rows without attendance showed `รอตรวจสอบการเช็คชื่อ`; completed rows showed `เรียนแล้ว`; absent rows showed `ขาดเรียน`; no write action was clicked.

## 2026-06-16 - Dashboard History Walleted Count Clarity

- Scoped `/dashboard/history` display fix only. No DB writes, migrations, lesson wallet write logic, booking/reschedule/payment/attendance write logic, Admin makeup, or payroll action was performed.
- Root cause: a verified 16-session Rama 2 booking for `น้องอองเดร` had 13 active course sessions and 3 `booking_sessions.status = walleted` rows backed by `lesson_wallet_credits.status = active`. The detail UI showed `13/16` but did not explain the 3 walleted sessions.
- Source fix: `src/app/(dashboard)/dashboard/history/page.tsx` now fetches `lesson_wallet_credits` read-only for loaded booking session ids in chunks, matches by `original_session_id`, and passes minimal wallet credit status/redeem metadata into the history client.
- Source fix: `src/components/dashboard/history-client.tsx` now keeps active count semantics unchanged, adds a summary line for active wallet credits, and renders a separate "อยู่ในกระเป๋า / รอเลือกวันใหม่" section for `walleted` sessions with status labels for active/redeemed/expired/cancelled-like states.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - Post-build cleanup/restart completed: stopped port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local `/` plus `_next/static/chunks/webpack.js` returned HTTP 200.
  - Authenticated local Chrome read-only smoke on `http://localhost:3000/dashboard/history` passed for the reported 16-session booking: detail showed `จำนวนที่ชำระ: 16 ครั้ง`, `รอบเรียนที่มีวันเรียนแล้ว: 13/16 ครั้ง`, `อยู่ในกระเป๋า รอเลือกวันใหม่: 3 ครั้ง`, and wallet rows for 15 มิ.ย. 17:00-19:00, 21 มิ.ย. 09:00-11:00, and 25 มิ.ย. 17:00-19:00. Completed/absent/attendance-gap labels remained visible and no console errors were captured.

- Commit `4c5e2c2` (`fix(history): show walleted sessions in booking detail`) was pushed to `spike/next-major-security-upgrade` and deployed to Vercel production on 2026-06-16.
  - Deployment id: `dpl_FXxNEtqBL6kEJAKHGX8oy2nzYHd4`.
  - Deployment URL: `https://new-athlete-badminton-school-90407eh6m-aachanin1s-projects.vercel.app`.
  - Production alias: `https://www.newathleteschool.com`.
  - Deployment status: Ready.
- Authenticated production Chrome read-only smoke on `https://www.newathleteschool.com/dashboard/history` passed with the parent session for the reported booking:
  - Card showed the June 2026 Rama 2 booking for `น้องอองเดร`, `16 ครั้ง`, and learner count `13 ครั้ง`.
  - Detail showed `จำนวนที่ชำระ: 16 ครั้ง`, `รอบเรียนที่มีวันเรียนแล้ว: 13/16 ครั้ง`, and `อยู่ในกระเป๋า รอเลือกวันใหม่: 3 ครั้ง`.
  - Wallet section showed 15 มิ.ย. 17:00-19:00, 21 มิ.ย. 09:00-11:00, and 25 มิ.ย. 17:00-19:00, each as `รอเลือกวันใหม่`.
  - Completed, absent, and attendance-gap review labels remained visible. Browser console errors: 0. No production write action was clicked.

## 2026-06-16 - Admin Makeup Targeted Same-Slot Learner Move

- Scoped `/admin/makeup` source/UI fix only. No direct DB data edits, migrations, attendance writes, `booking_sessions.status` changes, check-in/evidence deletion, or booking/reschedule/payment/wallet/payroll logic changes were performed by Codex.
- Added API action `move_learner_to_existing_coach_group` in `src/app/api/admin/makeup/route.ts` for a targeted same-slot move of one or more learner sessions into an existing `coach_assignment_groups` row.
- The action validates required `session_ids`, `target_group_id`, `coach_id`, and `reason`; target group existence; same `schedule_slot_id`; target group coach match; same date/start/end/branch/course; non-makeup active lifecycle statuses only; and exact learner attendance absence by `booking_session_id + expected student_id`.
- The action writes only `coach_assignment_group_students` membership updates/inserts, compatibility `coach_assignments` when missing for the target coach/slot, `activity_logs`, and a notification to the target coach. It intentionally does not write `attendance`, does not change `booking_sessions.status`, does not delete coach check-ins/evidence, and does not delete the old group even if it becomes empty.
- `src/app/(admin)/admin/makeup/page.tsx` now passes exact `group_id`, `coach_id`, and server-preloaded same-slot coach-group options from the learner's assignment group to the makeup client so the UI can list target groups safely even when the visible review list is narrowed by search/filter.
- `src/components/admin/makeup-client.tsx` now adds a "ย้ายเข้ากลุ่มโค้ชในรอบเดียวกัน" button near the retrospective coach replacement action and a read/confirm dialog that shows the learner, old group/coach, same-slot target groups only, target coach, required reason, and warnings that attendance/status/evidence are not changed.
- Read-only proof for Kheen session `c4a375b6-4bf1-4305-8932-c47e5f53270d`:
  - Current membership is group `c500256e-bd39-44e9-96e4-a26e725c5b9e` / Coach Link.
  - Target group `1120daab-2a90-4205-979d-d2803ebb5fbc` / Coach Nice is in the same schedule slot `0a346a9a-e603-4da6-9d49-6c417774ea01`.
  - Target group member rows match the same round/date/time/branch/course.
  - Exact attendance rows for Kheen's expected student id are 0.
- Verification passed locally:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - `git diff --check` with only known Windows LF/CRLF warnings.
  - Post-build cleanup/restart completed: stopped port 3000, removed generated `.next`, restarted `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000`, and verified local `/` plus `_next/static/chunks/webpack.js` returned HTTP 200.
  - Local browser read-only smoke for `/admin/makeup` redirected unauthenticated access to `/auth/login?redirect=%2Fadmin%2Fmakeup` with 0 console errors.
- Commit `99c579a` (`fix(makeup): move learner to existing coach group`) was pushed to `spike/next-major-security-upgrade` and deployed to Vercel production on 2026-06-16.
- Owner-run production UAT for Kheen passed on 2026-06-16. Codex performed post-write read-only verification only:
  - Session `c4a375b6-4bf1-4305-8932-c47e5f53270d` is now in target group `1120daab-2a90-4205-979d-d2803ebb5fbc` / `โคัช ไนซ์ NA ราม`.
  - The same session is no longer in old group `c500256e-bd39-44e9-96e4-a26e725c5b9e` / `โคัช ลิ้ง NA รัชดา`; the old group has 0 members after the move.
  - `attendance` remains 0 rows for the exact learner, and `booking_sessions.status` remains `scheduled`.
  - Coach check-in/evidence for Coach Nice remains present with photo and GPS; no evidence was deleted.
  - Activity log action `attendance_gap_move_learner_to_existing_group` exists with details confirming `attendanceWritten=false`, `bookingSessionStatusChanged=false`, and `coachEvidenceDeleted=false`.
  - Notification `f8912135-148b-48eb-b04c-ecbf5061854e` was sent to Coach Nice for the same slot.
  - Result: PASS. No rollback needed.

## 2026-06-16 - Font Preload Warning Noise

- Scoped app-shell font loading fix only. No DB writes, migrations, business logic changes, or Admin makeup action changes were performed.
- Production screenshot after deploy `99c579a` showed many Chrome DevTools warnings for preloaded `/_next/static/media/*.woff2` Prompt font files and a reported odd-looking font. Read-only HTML inspection confirmed the preload tags had correct `as="font"` attributes, but `next/font` was preloading 10 Prompt font files from `subsets: ["thai", "latin"]` and weights `300/400/500/600/700`.
- Source fix: `src/app/layout.tsx` keeps the Prompt font but removes unused weight `300`, sets `display: "swap"`, and disables automatic font preload with `preload: false` so pages do not emit unused `.woff2` preload links.
- Local verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - `git diff --check` with only known Windows LF/CRLF warnings.
  - Post-build cleanup/restart completed; local `/` and `_next/static/chunks/webpack.js` returned HTTP 200.
  - Local `/auth/login` HTML emitted 0 `.woff2` preload links.
- Commit `2d749b7` (`fix(app): reduce font preload warnings`) was pushed to `spike/next-major-security-upgrade` and deployed to Vercel production on 2026-06-16.
  - Deployment URL: `https://new-athlete-badminton-school-nnrezwdqb-aachanin1s-projects.vercel.app`.
  - Production alias: `https://www.newathleteschool.com`.
  - Deployment status: Ready.
- Production smoke result:
  - Public/app-shell smoke passed for `/auth/login` and unauthenticated shell paths. Thai font rendering returned to normal and `.woff2` preload flood was not observed in the app shell.
  - Owner-confirmed Chrome screenshot showed authenticated `/admin` loaded successfully after login and Thai font looked normal.
  - Codex authenticated console smoke remains `NEED REVIEW` only because the Codex in-app browser does not share the owner's logged-in Chrome session/cookies. This is not a confirmed runtime error.
  - No write action, DB data change, migration, or additional deploy was performed during smoke.

## 2026-06-18 - Admin Schedules Daily Board MVP

- Scoped `/admin/schedules` Daily Board MVP is closed. The source change was limited to:
  - `src/app/(admin)/admin/schedules/page.tsx`
  - `src/components/admin/schedules-client.tsx`
- Commit `e7c691afe5d8d3da98c362a1707fc071bf53f7b3` (`feat(schedules): show daily round board`) was pushed and deployed to Vercel production.
  - Deployment id: `dpl_AbzHehYxXP2fX1FpmfMr1Pat9rWz`.
  - Production alias: `https://www.newathleteschool.com`.
  - Deployment status: Ready.
- Daily Board now displays the right-side `/admin/schedules` day view as round cards instead of a long per-session list. Rounds are grouped by `schedule_slot_id` first, with fallback key `date + start_time + end_time + branch_id + course_type_id` only when a session has no slot.
- The round card display includes time, branch, course, learner count, coached learner count, waiting-for-coach count for non-walleted learners only, walleted count when present, coach groups, learners under each exact coach group, learner LV, attendance display labels, and teaching program boxes at the round/coach-group level when available.
- Coach assignment display follows the exact learner-group source: `coach_assignment_group_students.booking_session_id -> coach_assignment_groups.coach_id`. Legacy `coach_assignments` remains diagnostic/compatibility context only and is not used to prove learner-level coach assignment.
- Walleted sessions are displayed separately as `อยู่ในกระเป๋า` / `รอเลือกวันใหม่` / `ไม่ต้องจัดโค้ช`. They are not counted as `รอจัดโค้ช`, are not shown in the waiting-coach section, and are not treated as active learning status.
- Daily Board-specific status wording is intentionally display-only and does not change attendance source-of-truth, `booking_sessions.status`, APIs, DB data, migrations, or write behavior:
  - Before round start: `รอเริ่มเรียน`.
  - During the round: round status `กำลังเรียน`; learners with present/late attendance show `เช็คชื่อแล้ว`; learners without attendance show `รอเช็คชื่อ`; `เรียนแล้ว` is not shown while the round is still active.
  - After round end: present/late shows `เรียนแล้ว`; missing attendance shows `รอตรวจเช็คชื่อ`; absent remains `ขาดเรียน`.
- Verification before deploy passed locally: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check` with only known Windows LF/CRLF warnings.
- Authenticated local smoke on `/admin/schedules?year=2026&month=6` passed. On 2026-06-17 at 14:57 Bangkok time, the active-round labels were verified: round `กำลังเรียน`, present/late `เช็คชื่อแล้ว`, missing attendance `รอเช็คชื่อ`, and no `เรียนแล้ว` badge during the active round.
- Authenticated production read-only smoke on `https://www.newathleteschool.com/admin/schedules?year=2026&month=6` passed for layout/data/display:
  - 2026-06-17 showed Daily Board round cards, including 09:00-11:00, 13:00-15:00, and 15:00-17:00.
  - Round cards showed time, branch, course, learner counts, coached counts, coach groups, learners, LV, attendance labels, and program boxes where coach groups existed.
  - A walleted 15:00-17:00 card showed wallet-specific wording and was not counted as waiting for coach.
  - Console errors: 0. Console warnings: 0. The font/preload warning flood did not return. No production write action was clicked.
- Production smoke status is `PASS with one NEED REVIEW note`: the live label case (`กำลังเรียน` / `เช็คชื่อแล้ว` / `รอเช็คชื่อ`) could not be rechecked against 2026-06-17 on production because the production smoke happened on 2026-06-18, after all target rounds were already in the past. This is acceptable for closure because the same live-label rule passed in authenticated local smoke on 2026-06-17 at 14:57.
- Follow-up backlog from the Daily Board MVP was completed on 2026-06-18 by the scoped `/coach/today` wording refinement below.

## 2026-06-18 - Coach Today Wording Refinement

- Scoped `/coach/today` learner-badge display fix is closed. The source change was limited to `src/app/(coach)/coach/today/page.tsx`.
- Commit `475bd055a42e657c518ce2858419ec8ef78db7aa` (`fix(coach): clarify today learner status wording`) was pushed and deployed to Vercel production.
  - Deployment id: `dpl_ABbA2kBzRDciuLZBaKsJkwG4iU2b`.
  - Production alias: `https://www.newathleteschool.com`.
  - Deployment status: Ready.
- Root cause: `/coach/today` learner badges collapsed `upcoming`, `in_progress`, `attendance_gap_review`, and fallback statuses into the broad label `รอสอน`, so coaches could not distinguish before-start, active-round, and post-round missing-attendance states.
- Source fix: `/coach/today` still uses `deriveSessionAttendanceStatus()` as the attendance source-of-truth helper, but maps the derived statuses locally for the schedule view:
  - `upcoming` -> `รอเริ่มสอน`.
  - `in_progress` without attendance -> `รอเช็คชื่อ`.
  - `present` / `late` while the round is in progress -> `เช็คชื่อแล้ว`.
  - `attendance_gap_review` -> `รอตรวจเช็คชื่อ`.
  - `completed` -> `บันทึกผลแล้ว`.
  - `present` after the round -> `มาเรียนแล้ว`.
  - `late` after the round -> `มาสาย`.
  - `absent` -> `ขาดเรียน`.
  - `walleted` or unexpected fallback -> `ไม่อยู่ในรอบสอนวันนี้`.
- Shared helpers were intentionally not changed: `src/lib/session-attendance-status.ts`, `src/lib/coach-slot-display-status.ts`, `/coach/attendance`, DB/API/migrations, attendance source-of-truth, `booking_sessions.status`, and write behavior were not changed.
- Verification before commit/deploy passed locally: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check` with only known Windows LF/CRLF warnings.
- Authenticated local smoke on `/coach/today` passed with a coach/head-coach session:
  - Page loaded without login redirect.
  - Learner badge `รอสอน` count was 0.
  - Real data showed `รอเริ่มสอน` for 3 learners.
  - Other phase labels remained `NEED REVIEW` only because no real local data for those phases was visible at smoke time.
  - Console errors: 0. Console warnings: 1 Next dev `scroll-behavior: smooth` warning, unrelated to the wording change.
  - No check-in, attendance, or write action was clicked.
- Authenticated production read-only smoke on `https://www.newathleteschool.com/coach/today` passed:
  - Page loaded with the coach session and did not redirect to login.
  - Learner badge `รอสอน` count was 0.
  - Real production data showed `รอเริ่มสอน` for 3 learners.
  - `รอเช็คชื่อ`, `เช็คชื่อแล้ว`, `รอตรวจเช็คชื่อ`, `มาเรียนแล้ว`, `มาสาย`, and `ขาดเรียน` remain `NEED REVIEW` only because no real production data for those phases was visible at smoke time; this is not a found bug.
  - Console errors: 0. Console warnings: 0. The font/preload warning flood did not return.
  - No check-in, attendance, or write action was clicked.

## 2026-06-18 - LV Actual Learner Range Display

- Scoped display-only LV range fix is closed for `/admin/schedules` Daily Board and `/coach/assign-groups`.
- Source change was limited to:
  - `src/components/admin/schedules-client.tsx`
  - `src/components/coach/assign-groups-client.tsx`
- Commit `6f311875342315626375e5afbc26cd2d118c3c2a` (`fix(groups): show actual learner level range`) was pushed and deployed to Vercel production.
  - Deployment id: `dpl_7LTrBQ2mAUVP3KN9AyKZi485zrpp`.
  - Production alias: `https://www.newathleteschool.com`.
  - Deployment status: Ready.
- Root cause: coach group names come from `coach_assignment_groups.name`, but the previous group badge displayed `coach_assignment_groups.level_min / level_max` as plain `LV xx-xx`. Those fields are stored/configured group metadata, not the current actual LV range of learners in the group, so the UI could mislead Admin/Coach when learner levels changed or membership no longer matched the original group band.
- Source fix: both surfaces now hide configured group ranges in the UI and display only actual learner LV ranges derived from already-loaded learners in each group:
  - `/admin/schedules`: actual range is computed from `group.learners[].level`.
  - `/coach/assign-groups`: actual range is computed from `getGroupStudents(slot, group)[].level`.
  - Examples: `เด็กในกลุ่ม LV 57`, `เด็กในกลุ่ม LV 26-32`, `เด็กในกลุ่ม: ยังไม่ประเมิน`, and `เด็กในกลุ่ม LV 26-32 + ยังไม่ประเมิน 1 คน`.
- The fix does not write actual learner LV back to `coach_assignment_groups.level_min / level_max`, does not rename groups, does not change membership, does not change coach assignment behavior, and does not change DB/API/migrations/write behavior.
- Verification before deploy passed locally: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check` with only known Windows LF/CRLF warnings.
- Authenticated local smoke passed:
  - `/admin/schedules?year=2026&month=6` showed actual learner LV ranges such as `เด็กในกลุ่ม LV 57`, `เด็กในกลุ่ม LV 37`, and `เด็กในกลุ่ม LV 26-32`; `ช่วงที่ตั้งไว้` was absent.
  - `/coach/assign-groups` showed actual learner LV range such as `เด็กในกลุ่ม LV 8`; configured ranges such as standalone `LV 11-30`, `LV 51-70`, `LV 31-50`, and `LV 0-10` were absent.
  - Console errors: 0. Local console warning was a Next dev logo-image LCP warning, unrelated to the LV display change.
- Authenticated production read-only smoke passed with one `NEED REVIEW` note:
  - `/admin/schedules?year=2026&month=6` passed: `ช่วงที่ตั้งไว้` was absent, configured group ranges as standalone `LV 11-30`, `LV 51-70`, `LV 31-50`, and `LV 0-10` were absent, and actual learner ranges appeared, including `เด็กในกลุ่ม LV 57`, `เด็กในกลุ่ม LV 37`, `เด็กในกลุ่ม LV 26-32`, and `เด็กในกลุ่ม: ยังไม่ประเมิน`.
  - `/coach/assign-groups` passed with a `NEED REVIEW` note only for the empty-group case because no real empty group was visible during smoke. The page showed actual learner range `เด็กในกลุ่ม LV 26-32`, did not show configured ranges, and did not show `ช่วงที่ตั้งไว้` or `ไม่กำหนดช่วง Level`.
  - Console errors: 0. Console warnings: 1 Next dev `scroll-behavior: smooth` warning, unrelated to the LV display change. The font/preload warning flood did not return.
  - No write action was clicked.

## 2026-06-18 - Ranking Branch Fallback Display

- Scoped Ranking branch display fallback is closed for public `/ranking` and Admin `/admin/ranking`.
- Source change was limited to `src/components/shared/ranking-content.tsx`.
- Commit `9ec35fba3725180e1f2dbbd98dfa640ef842c2c3` (`fix(ranking): fallback child branch from sessions`) was pushed and deployed to Vercel production.
  - Deployment id: `dpl_35YWQvijuWT2MtyWPfxmQXx3s4Bn`.
  - Deployment URL: `https://new-athlete-badminton-school-mczsmydrb-aachanin1s-projects.vercel.app`.
  - Production alias: `https://www.newathleteschool.com`.
  - Deployment status: Ready.
- Root cause: Ranking built learner branch names from `bookings.child_id -> bookings.branch_id -> branches` only. The reported child `ณิชารัศน์ (แกรนท์)` had real `booking_sessions.child_id` rows and attendance, but the related verified child booking had `bookings.child_id = null`, so Ranking could not map the booking branch to the child and displayed `ยังไม่ผูกสาขา`.
- Source fix: Ranking keeps the original booking branch source when `bookings.child_id` maps correctly, then falls back only for children missing a booking branch by reading `booking_sessions.child_id -> booking_sessions.branch_id -> branches`.
  - Fallback session statuses are limited to `scheduled`, `completed`, and `absent`.
  - The fallback query is scoped only to child ids that do not already have a branch from the booking map.
  - Large `.in()` filters are chunked and session reads are paginated to avoid request/row-cap issues.
- The fix is display/read-only. It does not write or repair `bookings.child_id`, does not change booking creation/write behavior, does not change attendance logic, and does not change DB/API/migrations.
- Verification before deploy passed locally:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - `git diff --check` with only known Windows LF/CRLF warnings.
- Local public `/ranking` smoke passed: filtering `ราชพฤกษ์-ตลิ่งชัน` showed `ณิชารัศน์ (แกรนท์)` with branch `ราชพฤกษ์-ตลิ่งชัน`, did not show `ยังไม่ผูกสาขา` for the child, and console errors/warnings were 0. Local `/admin/ranking` authenticated smoke remained `NEED REVIEW` only because no admin session was available in that local browser.
- Authenticated production read-only smoke passed:
  - `/ranking` showed `ณิชารัศน์ (แกรนท์)` under `ราชพฤกษ์-ตลิ่งชัน`, did not show `ยังไม่ผูกสาขา` for the child, and console errors/warnings were 0.
  - `/admin/ranking` loaded with an Admin session and showed the same shared Ranking board result for `ณิชารัศน์ (แกรนท์)` and `ราชพฤกษ์-ตลิ่งชัน`.
  - The font/preload warning flood did not return.
  - No write action was clicked.

## 2026-06-22 - Admin Makeup Duplicate Coach Group Guard

- Scoped duplicate coach group guard is closed for `/admin/makeup`.
- Source change was limited to:
  - `src/app/(admin)/admin/makeup/page.tsx`
  - `src/app/api/admin/makeup/route.ts`
  - `src/components/admin/makeup-client.tsx`
- Commit `632b90c7fd6e98f155d61205243f541f5bfb640f` (`fix(makeup): prevent duplicate coach groups`) was pushed and deployed to Vercel production.
  - Deployment id: `dpl_nZXGVWu22RueVEadGf7zjKA7QLNt`.
  - Deployment URL: `https://new-athlete-badminton-school-8fzxf2jny-aachanin1s-projects.vercel.app`.
  - Production alias: `https://www.newathleteschool.com`.
  - Deployment status: Ready.
- Production incident context: owner clicked the Admin Makeup round action for a 2026-06-02 17:00-19:00 Ramintra round and `assign_coach_to_round` created a second populated coach group for the same coach in the same `schedule_slot_id`. Production data was repaired with owner approval by moving Kirin into the existing Trin group; the duplicate empty group was left in place for audit continuity.
- Root cause: `assign_coach_to_round` did not guard against a selected coach already having a populated `coach_assignment_groups` row in the same slot/round, and the unassigned card UI previously pushed users toward the round assign flow when a same-slot existing group was available.
- API fix: `assign_coach_to_round` now checks for a populated group for the selected coach in the same `schedule_slot_id` and same round context before creating a new group. Populated means the group has at least one `coach_assignment_group_students` member. Empty groups are intentionally ignored so incident leftovers do not block valid future assignment.
- If the selected coach already has a populated same-slot/same-round group, the API returns 400 with: `โค้ชคนนี้มีกลุ่มอยู่แล้วในรอบเดียวกัน กรุณาใช้ "ย้ายเข้ากลุ่มโค้ชในรอบเดียวกัน" แทน`.
- UI fix: unassigned learner cards with an existing same-slot populated coach group now show two explicit choices:
  - `ย้ายเข้ากลุ่มโค้ชในรอบเดียวกัน`, with helper `ใช้เมื่อผู้เรียนควรอยู่ในกลุ่มโค้ชที่มีอยู่แล้ว`.
  - `มอบหมายโค้ชใหม่`, with helper `ใช้เมื่อผู้เรียนควรแยกไปอีกโค้ช` and warning `ห้ามเลือกโค้ชที่มีกลุ่มอยู่แล้วในรอบนี้`.
- Same-slot target group options exclude empty groups. The UI and local validation still allow assigning a genuinely different coach who does not already have a populated group in the slot/round.
- The fix did not write DB data, did not add migrations, did not change attendance write logic, did not change `booking_sessions.status` logic, and did not touch coach check-ins/evidence behavior.
- Verification before commit/deploy passed locally: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check` with only known Windows LF/CRLF warnings.
- Authenticated local read-only smoke passed on `/admin/makeup`: the page loaded without login redirect, unassigned cards with same-slot groups showed both choices and helper/warning text, assigned-coach cards still showed their existing buttons, console errors/warnings were 0, and no write action was clicked.
- Authenticated production read-only smoke on `https://www.newathleteschool.com/admin/makeup` passed:
  - Page loaded with an Admin session and did not redirect to login.
  - Real unassigned same-slot cases showed both `ย้ายเข้ากลุ่มโค้ชในรอบเดียวกัน` and `มอบหมายโค้ชใหม่`.
  - Helper text and duplicate-coach warning were visible.
  - Assigned-coach cards still showed existing buttons such as `ส่งให้โค้ชตรวจสอบรอบนี้`, `เปลี่ยนโค้ชย้อนหลัง`, `บันทึกย้อนหลังทั้งรอบ`, and `ปิดเคสทั้งรอบ`.
  - Console errors/warnings were 0. The font/preload warning flood did not return.
  - No submit, move, assign, close, attendance, or other write action was clicked.

## 2026-07-02 - Kids Group Monthly Pricing True-Up

- Scoped kids_group sibling monthly pricing true-up is deployed to production and production-smoke passed.
- Source commit `5897cede58f720c1b5f205af53c9821cff0a39bf` (`fix(pricing): true up kids group monthly tiers`) changed only `src/lib/pricing.ts` and `scripts/check-pricing-true-up.js`.
- Deployment id `dpl_5e6i8M3Mtzy5xNah6xVD9v6PtHwQ`; deployment URL `https://new-athlete-badminton-school-9ku8u3zd9-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
- Root cause: kids_group incremental pricing previously used `incrementalPrice = perSessionForFinalMonthlyTier * newSessions`. Split sibling bookings in the same month could therefore cost more than one combined monthly booking. Example from the read-only audit: June 2026 one 16-session booking was `THB 6,496`, while July 2026 split 8 + 8 pending bookings totaled `THB 7,248` before the fix.
- New formula: `targetMonthlyTotal = finalMonthlyPerSession * (existingSessions + newSessions)` and `incrementalPrice = max(0, targetMonthlyTotal - existingPersistedBookingTotals)`. Future kids_group 8 + 8 split bookings now total `THB 6,496` (`THB 4,000 + THB 2,496`) instead of `THB 7,248`.
- Dry-run proof passed with `node scripts/check-pricing-true-up.js`: single 16 sessions = `THB 6,496`; split 8 + 8 = `THB 4,000 + THB 2,496 = THB 6,496`; existing 8 then add 1 keeps expected 7-10 tier behavior.
- Production smoke passed: production alias loaded normally; `/dashboard/booking` loaded with an authenticated Chrome session; console errors/warnings were 0; no runtime error, hydration error, or React #418 was found.
- UI price preview remains `NEED REVIEW` only because reproducing the exact target 8 + 8 case safely in production would risk entering the booking creation flow. No `ยืนยันการจอง`, slip upload, booking/payment creation, or product write action was performed.
- Coupon limitation: true-up subtracts persisted `bookings.total_price`. Coupon true-up semantics still need owner decision because no pre-discount subtotal snapshot is stored, and this release intentionally did not invent new coupon behavior.
- Branch-scope limitation: preserved current behavior counts existing bookings by the same `user_id + course_type_id + month/year + status` scope. Branch-specific monthly pricing was not changed and needs owner decision if required.
- Owner-approved production DB repair for the existing July mismatch is complete:
  - Target booking `ff0728dd-066a-417a-aeaa-0049fed6b931` was updated from `bookings.total_price = 3248` to `2496`.
  - Paired booking `10254533-f76a-4985-bf0d-af18942a3b85` remained `4000`.
  - Combined July 2026 total after repair is `6496`.
  - Both bookings remain `pending_payment`.
  - Payment rows remain 0 and coupon usages remain 0.
  - `booking_sessions` were unchanged by fingerprint and booking status was not changed.
  - Activity log `07150189-0a5e-4fe6-bd20-24c47b4b9a75` was inserted with action `pricing_true_up_repair`.
- Owner-approved July 2026 current-month DB repair for 4 additional kids_group mismatch groups is complete. Owner policy: ignore June historical mismatches; repair July 2026 current-month mismatches even when payment exists; keep payment rows as evidence of actual transfer and do not modify `payments.amount`; do not create refund/coupon/payment rows; do not touch `booking_sessions`, `pricing_tiers`, Trin/Bin, or June groups.
  - Root cause for these groups: old incremental pricing charged `final tier per-session * newSessions` and did not true-up earlier higher-tier bookings. The source fix above prevents future repeats.
  - Ningnong group target `5d1d9a43-afcd-4d26-8817-68ab948443f2`: `bookings.total_price` `2800 -> 1169`, reduction `1631`, group total after repair `7700`, status `verified`, activity log `04cf71ee-5718-49a7-8a5f-364d44a9184f`.
  - Kanokpan group target `3f95767e-8418-4b0b-b87d-2cd18811825b`: `bookings.total_price` `14700 -> 13600`, reduction `1100`, group total after repair `16100`, status `pending_payment`, activity log `e2aa73ff-b1b9-4168-b58a-28ffc3128a1d`.
  - Siripong group target `f565a552-65f3-44e0-8826-22a4c9cb0dbb`: `bookings.total_price` `1299 -> 763`, reduction `536`, group total after repair `4763`, status `verified`, activity log `c953f942-7d67-44d0-b8a5-b0abefa213a0`.
  - Janyawat group target `ff9cf27f-6415-444d-90b6-89ab05fc2d47`: `bookings.total_price` `2000 -> 1500`, reduction `500`, group total after repair `4000`, status `verified`, activity log `e46f9fb1-608e-48d6-a6a5-0c0bd7a7746a`.
  - Latest batch total July reduction is `3767`; total July reduction including Trin/Bin is `4519`.
  - Post-write verification passed: payments unchanged by fingerprint; `booking_sessions` unchanged by fingerprint; `pricing_tiers` unchanged by fingerprint; no coupon rows created; no booking/payment/refund/coupon created; non-target bookings in those groups unchanged; Trin/Bin remains matched at `6496`; June guarded bookings unchanged.
- Rollback condition for these exact DB repairs: rollback only before further dependent accounting/credit/payment action; if later accounting action exists, stop and re-plan.
- Remaining limitations: coupon true-up semantics still need owner decision if a coupon case appears later; branch-scope policy for future business rules remains owner decision, while this July repair followed current source scope.
- No pricing tier rows, API/migration, history amount source, booking payload shape, schedule selection, attendance/wallet/reschedule logic, extra deploy, booking/payment/refund/coupon creation, slip upload, or product write action beyond the exact owner-approved DB repairs was changed/performed.

## 2026-07-01 - Admin Schedules Performance UX/Render Fix

- Scoped `/admin/schedules` Phase A + small Phase B performance UX/render fix is deployed to production and production-smoke passed.
- Source commit `0d70e427db9e4df6a965a41e42371660c59a0cfe` (`fix(schedules): avoid rendering full month details by default`) changed only `src/components/admin/schedules-client.tsx`.
- Deployment id `dpl_HCABbm1GzZm2bDfe8Xkr5qvTrRei`; deployment URL `https://new-athlete-badminton-school-bd74sd2mc-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
- Root cause: `/admin/schedules?year=2026&month=6` has large monthly data volume, including 348 rounds and 1182 booking session rows. Before the fix, non-current months could start with `selectedDate = null`, so the right Daily Board panel rendered full-month round/group/learner/program/wallet/detail UI immediately and made tablet/Chrome feel stuck after loading.
- Fix: month navigation now has pending/loading state, disables Today/previous/next while pending, shows `กำลังโหลดตารางเดือน...`, shows a lightweight month overview when no date is selected, renders Daily Board detail only after a day is selected, memoizes repeated summary/bucket computations, and keeps calendar summary/counts available.
- No server query semantics, Supabase query/chunk/pagination behavior, business logic, attendance source-of-truth rules, exact coach assignment source, walleted counting rules, teaching program correctness, DB/API/migration, or write behavior changed.
- Production smoke passed on `https://www.newathleteschool.com/admin/schedules?year=2026&month=6` in Chrome via Codex Chrome Extension, authenticated as `Super Admin: A'Arm Chanin`.
- Initial June 2026 smoke: page did not redirect to login; displayed `มิถุนายน 2569`; showed 348 rounds and 1182 booking rows; calendar summary/counts per day displayed correctly; right panel showed `ภาพรวมเดือนมิถุนายน` and `เลือกวันที่ในปฏิทินเพื่อดูรายละเอียดรอบเรียน`; heavy detail markers such as `โปรแกรมสอนรอบนี้`, `ผู้ปกครอง:`, and `โค้ช:` had 0 occurrences in the initial overview; UI no longer felt heavily stuck after load.
- Selected-day smoke for `พุธ 17 มิ.ย. 69` passed: Daily Board showed only that day with 8 rounds, time/branch/course, learner counts, coach groups, learners, LV, teaching program boxes, and attendance labels such as `เรียนแล้ว`, `ขาดเรียน`, and `รอตรวจเช็คชื่อ`; no `พฤหัสบดี 18 มิ.ย. 69` detail mixed into the selected-day panel.
- Month navigation smoke passed for June -> May, June -> July, and Today -> July: `กำลังโหลดตารางเดือน...` appeared while pending, Today/previous/next buttons were disabled during pending navigation, buttons returned enabled after route settled, and the UI did not appear frozen even when the production query took several seconds.
- Invariant smoke passed: walleted sessions remained excluded from `รอจัดโค้ช`; the 17 June walleted example showed `อยู่ในกระเป๋า 1 คน`, `มีโค้ชแล้ว 0 คน`, and `ไม่ต้องจัดโค้ช`; coach assignment still displayed through exact coach group / learner group behavior; attendance labels remained correct; calendar summary stayed consistent with June 2026 data; no legacy/slot coach fallback was introduced.
- Console/hydration smoke passed: console logs/errors/warnings 0, no React #418, no hydration error, and no text mismatch.
- Verification before deploy passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check` with only known Windows LF/CRLF warnings.
- Phase C split monthly summary vs daily detail remains optional/future only; it is not required immediately because this scoped fix already avoids full-month detail rendering by default.

## 2026-07-04 - User Payment / Slip Upload Reliability Hardening

- Scoped User Payment / Slip Upload reliability hardening is deployed to production and production read-only smoke passed.
- Source commit `bc5e013b4b0d90b517f908d9aaf34e7caad5f43b` (`fix(payment): harden slip upload reliability`) was pushed on branch `spike/next-major-security-upgrade`.
- Deployment id `dpl_B2895m9DiJwxm3xWEhu64BUYDhAj`; deployment URL `https://new-athlete-badminton-school-753f9tmvh-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
- Source scope was limited to `src/lib/slipok.ts`, `src/app/api/verify-slip/route.ts`, and `src/components/dashboard/history-client.tsx`.
- Root reliability risk from the audit: the slip upload flow could feel stuck or unclear when SlipOK was slow/timeout-prone or when a partial failure happened after upload, especially if the payment row was inserted but booking status update failed.
- Fix summary:
  - `src/lib/slipok.ts` now wraps the SlipOK request with an explicit 25s `AbortController` timeout and typed `SLIPOK_TIMEOUT` response.
  - `/api/verify-slip` returns clearer safe messages/codes for storage upload failure, SlipOK timeout, SlipOK rejection/invalid slip, payment insert failure, and booking update failure after payment insert.
  - `/dashboard/history` slip upload dialog now shows clearer uploading/verifying/refreshing/failed states, disables duplicate submit and file changes while pending, and surfaces safe API messages to the user.
  - If payment is recorded but booking update fails, the API reports `paymentRecorded: true` and `supportReviewRequired: true`; the client refreshes and tells the user support must review.
- Business semantics preserved:
  - SlipOK approved still creates payment `approved` and booking `verified`.
  - Timeout/rejected/manual-review path still records payment `pending` and booking `paid`.
  - Payment approval/reject/send-back/cancel semantics were not changed.
  - Pricing, DB migrations, and direct DB repair were not changed/performed.
- Production read-only smoke passed:
  - `https://www.newathleteschool.com` loaded normally.
  - `/dashboard/history` loaded with the existing user session and did not redirect to login.
  - Pending payment/upload UI rendered, but no slip dialog was submitted.
  - `/admin/payments` loaded and the payment list rendered normally.
  - Console errors/warnings were 0; no React hydration error or React #418 was found.
- Post-deploy read-only inconsistency audit passed:
  - payments scanned: 392.
  - paid/verified bookings: 392.
  - payment exists but booking still `pending_payment`: 0.
  - approved payment but booking not `verified`: 0.
  - booking `paid`/`verified` without payment row: 0.
  - duplicate payment rows for same booking: 0.
- Important limitation: browser slip-upload write smoke remains `NEED REVIEW` because no clearly disposable/test pending booking existed. No production slip upload was performed, no booking/payment/slip/coupon was created, and no payment/write action was clicked.
- User Booking state reset / draft-state preservation is now completed by the 2026-07-08 `/dashboard/booking` draft preservation release below. If payment upload still feels slow, the next separate area is a History page query/loading audit.

## 2026-07-08 - User Booking Draft Preservation Release

- Scoped `/dashboard/booking` draft preservation is deployed to production and production smoke passed.
- Source commit `85aa80a90bd645b63e7bab1fbca408fa66cf2c73` (`fix(booking): preserve draft state`) was pushed on branch `spike/next-major-security-upgrade`.
- Deployment id `dpl_AZhW1vNkdGm4oZiMZvVb4hx152qr`; deployment URL `https://new-athlete-badminton-school-bq3vf5e2k-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
- Source scope was limited to `src/components/dashboard/booking-client.tsx`.
- Original reliability issue: the booking wizard state lived only in React `useState`, so refresh/remount/auth refresh/returning to the page could lose selected course, learner, branch, and session draft state.
- Fix summary:
  - Added client-side `sessionStorage` draft preservation for `/dashboard/booking`.
  - New booking draft key: `nabs:booking-draft:v1:{userId}:new`.
  - Edit booking draft key: `nabs:booking-draft:v1:{userId}:edit:{bookingId}`.
  - Persisted fields are `step`, `courseType`, `learnerType`, `selectedChildIds`, `privateSelfAttend`, `selectedBranchIds`, `calMonth`, `calYear`, `sessionsMap`, `activeChildTab`, and `updatedAt`.
  - Not persisted as source of truth: calculated/final price, `appliedCoupon`, coupon validation result, payment state, API errors, or loading state.
  - Restore validates course type, child ids, branch ids, active learner key, and session shape; corrupt/invalid drafts are ignored and removed.
  - Restored draft notice: `กู้คืนแบบร่างการจองล่าสุดแล้ว`.
  - Added `ล้างแบบร่าง`.
  - Draft clears after successful `POST`/`PUT`, user discard, and mode/edit key change.
  - Draft does not clear on API failure, route refresh, slow network, or summary back.
- Production smoke passed:
  - Opened `/dashboard/booking` with an authenticated production session.
  - Selected `Private` -> `A'Arm Chanin` -> `แจ้งวัฒนะ` -> `จันทร์ 6 ก.ค. 69` -> `08:00-09:00`.
  - Browser refresh restored the draft with the restored notice, branch/session selection, and recalculated visible price `฿900`.
  - Summary showed the restored session; back from summary preserved the draft.
  - `ล้างแบบร่าง` cleared storage; refresh returned to the initial course step.
  - Console errors/warnings/pageerrors were 0; no React hydration error or React #418 was observed.
  - `ยืนยันการจอง` was not clicked, and no booking/payment/slip/coupon was created.
- Business semantics preserved: no API changes, DB changes, migrations, pricing changes, `/api/bookings` payload shape changes, duplicate guard changes, schedule template rule changes, same-day future-slot rule changes, payment/slip flow changes, or lesson-wallet/reschedule/coupon semantics changes.
- Important `NEED REVIEW` notes:
  - kids_group multi-child browser smoke was not tested because the safe smoke session had no child records.
  - pending edit booking browser smoke was not tested because no pending editable booking was visible.
  - These are not blockers for this scoped client-only release.
- Next recommended reliability/performance task: run a Booking Performance Audit if the owner wants real speed improvement, or confirm branch/month reset behavior if users still feel selections disappear during in-page changes.

## 2026-07-08 - Phase 1 Performance Foundation Release

- Scoped perceived-performance UI work is committed, pushed, and deployed to production.
- Source commit `67f5b01` (`fix(ui): add portal navigation loading feedback`) was pushed on branch `spike/next-major-security-upgrade`.
- Deployment id `dpl_14eJpsrbUeEd6V1mcF6NVFLshV55`; deployment URL `https://new-athlete-badminton-school-n0odem0ad-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
- Source scope is limited to global/portal navigation feedback and route-level loading skeletons:
  - `src/components/shared/loading-bar.tsx`
  - `src/components/shared/portal-route-loading.tsx`
  - `src/components/layout/navigation-pending.ts`
  - `src/components/layout/admin-sidebar.tsx`
  - `src/components/layout/coach-sidebar.tsx`
  - `src/components/layout/dashboard-sidebar.tsx`
  - `src/app/(admin)/admin/loading.tsx`
  - `src/app/(coach)/coach/loading.tsx`
  - `src/app/(dashboard)/dashboard/loading.tsx`
- Implemented behavior:
  - Global internal route clicks now show immediate top loading feedback and a small pending pill, with guards for external links, modifier/new-tab clicks, hash-only links, and a timeout failsafe.
  - Admin, Coach, and User dashboard sidebars show per-link pending state and spinner feedback while an internal navigation is settling.
  - Admin, Coach, and User portal route groups now have lightweight route loading skeletons.
- Business/API invariants preserved: no DB/API/page query changes, migrations, booking/payment/slip/coupon/check-in/attendance writes, pricing changes, schedule/attendance semantics changes, or SlipOK changes were made.
- Local verification passed before docs update:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - `git diff --check` with only known Windows LF/CRLF warnings
- After build, the stale `.next` folder in this repo was removed and `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000` was restarted successfully; `/` returned 200 and a `_next/static/*` JS asset returned 200.
- Browser smoke status:
  - Provided local account authenticated successfully and could access Admin, Coach, and User dashboard portals.
  - Admin desktop sidebar smoke passed from `/admin` to `/admin/schedules`: top loading pill appeared immediately, `/admin/schedules` link had `aria-busy="true"` with `กำลังเปิดเมนู...`, route skeleton appeared, and the schedule page settled without pending UI stuck.
  - Coach desktop sidebar smoke passed from `/coach` to `/coach/today`: top loading pill appeared immediately, `/coach/today` link had `aria-busy="true"` with `กำลังเปิดเมนู...`, and the page settled without pending UI stuck.
  - User dashboard desktop sidebar smoke passed from `/dashboard` to `/dashboard/history`: top loading pill appeared immediately, `/dashboard/history` link had `aria-busy="true"` with `กำลังเปิดเมนู...`, and the page settled without pending UI stuck.
  - Post-build browser verify passed for `/admin`; `<html data-scroll-behavior="smooth">` is present, and the Next smooth-scroll route-transition warning did not recur after the restart.
  - No write action was clicked. No booking/payment/slip/coupon/check-in/attendance creation or mutation was performed.
- Production smoke:
  - `https://www.newathleteschool.com/` returned 200.
  - A production `_next/static/*` JS asset returned 200.
  - Clean no-cookie `/admin` returned 307 to `/auth/login?redirect=%2Fadmin`, preserving route guard behavior.
  - In-app browser `/admin` also redirected to login, rendered `<html data-scroll-behavior="smooth">`, and had browser console errors/warnings 0.
  - Vercel CLI inspect confirmed deployment target `production`, status Ready, and production aliases including `https://www.newathleteschool.com`.
  - Vercel CLI error-log check immediately after clean no-cookie smoke found no logs in the last 1 minute.
  - A prior in-app browser production attempt produced two `Invalid Refresh Token` error logs from a stale unauthenticated browser cookie during `/admin` -> login redirect; clean no-cookie smoke did not reproduce new errors.
  - Authenticated production portal navigation smoke passed after the owner logged in through the in-app browser:
    - `/admin` -> `/admin/schedules` showed the top loading pill and route skeleton immediately, then settled to the schedule calendar with console errors/warnings 0.
    - `/coach` -> `/coach/today` showed the top loading pill/loading copy immediately, then settled to Coach Schedule with console errors/warnings 0.
    - `/dashboard` -> `/dashboard/history` showed the top loading pill and route skeleton immediately, then settled to booking history with console errors/warnings 0.
    - Production route changes were fast enough that the sidebar `aria-busy` state was not captured in the browser sample, but it remains covered by authenticated local smoke above.
    - Vercel CLI error-log check after authenticated smoke found no error logs in the last 5 minutes.
- No write action was clicked. No booking/payment/slip/coupon/check-in/attendance creation or mutation was performed locally or on production.

## 2026-07-08 - Owner-Approved Test Booking Cleanup

- Owner-approved Plan A production cleanup for parent profile `e8a4b5c9-880d-4a43-b693-96cb0ce26316` (`รชต จันดาวรรณ`) is complete.
- Scope was limited to operational booking/test rows for the audited target bookings:
  - `a638ec91-e5fc-4532-a675-54a0c1e089fe`
  - `713a8a12-5d1c-4a3c-9486-4c8a8e81cce0`
  - `7c50224f-26f7-4e5e-a997-8e403220eb61`
  - `ce154363-c2c5-4117-b584-457ae9e472d4`
  - `ffb929b2-d406-4d09-9cb3-554c51ff4548`
  - `52bb57e3-bf9b-4a7d-8bde-8d32423d5bda`
- Local JSON snapshots were saved under `backups/rachata-cleanup-20260708-024923/` for dry-run and `backups/rachata-cleanup-20260708-024933/` for write/post-write verification. The backup folder is ignored by git.
- Pre-write dry-run passed the hardcoded ID guards and re-verified:
  - bookings 6, booking_sessions 42, payments 6, coupon_usages 0, lesson_wallet_credits 29, attendance 1.
  - target `coach_assignment_group_students` links 4.
  - empty `coach_assignment_groups` approved for deletion 3.
  - stale legacy `coach_assignments` approved for deletion 3, each with no remaining non-target sessions in the slot.
  - protected group `7f464902-42ec-411d-a939-f0749e45ecd3` still had 2 non-target learners and was not deleted.
- Production rows deleted:
  - `lesson_wallet_credits`: 29.
  - `payments`: 6.
  - `attendance`: 1.
  - `coach_assignment_group_students`: 4.
  - empty `coach_assignment_groups`: 3.
  - stale `coach_assignments`: 3.
  - `booking_sessions`: 42.
  - `bookings`: 6.
- Cleanup audit log was inserted:
  - `activity_logs.id`: `e111c71c-e7f6-448c-a871-c176ced66dea`
  - action: `owner_test_booking_cleanup`
  - entity_type/entity_id: `profile` / `e8a4b5c9-880d-4a43-b693-96cb0ce26316`
- Post-write verification passed:
  - target bookings, sessions, payments, wallet credits, attendance row, assignment links, empty groups, and stale legacy assignments remaining: 0.
  - parent profile `e8a4b5c9-880d-4a43-b693-96cb0ce26316` still exists.
  - child profile `4209ef39-21cd-494e-9e1f-507e3f0a92d1` still exists.
  - protected group `7f464902-42ec-411d-a939-f0749e45ecd3` still exists with exactly 2 non-target learner links.
  - all 27 coach check-ins from involved slots still exist.
  - activity logs were not deleted.
- Verification after cleanup passed:
  - `npm.cmd run attendance:reconcile:dry-run`: 0 student-scope mismatches, 0 status mismatches, 0 booking-status-without-attendance rows.
  - `npm.cmd run prod:check`: READY WITH WARNINGS/PASSES; warning is local `SLIPOK_TEST_MODE=true`.
- No source code change, migration, commit, push, deploy, parent/child delete, activity log delete, coach check-in delete, profile delete, child profile delete, or storage object delete was performed.
- Payment slip storage objects were intentionally left in storage for optional later cleanup because storage deletion is harder to rollback. Paths are recorded in `backups/rachata-cleanup-20260708-024933/prewrite-summary.json`.

## 2026-07-08 - Admin Makeup Read Transport Cleanup

- Phase 2 `/admin/makeup` Option 1 safe read transport cleanup is committed, pushed, deployed, and smoke verified.
- Source commit `5928e76` (`fix(makeup): chunk large read queries`) was pushed on branch `spike/next-major-security-upgrade`.
- Deployment id `dpl_FTvwNYxQhQVg1Scbcrm2YF62hukW`; deployment URL `https://new-athlete-badminton-school-if4vupuq4-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
- Source scope was limited to `src/app/(admin)/admin/makeup/page.tsx`.
- Read transport changes:
  - Added local range/chunk helpers for paginated Supabase reads.
  - Replaced source session `.limit(2000)` with paginated `.range(...)` reads.
  - Replaced linked makeup session `.limit(1000)` with paginated `.range(...)` reads.
  - Replaced unchunked `schedule_slot_id` `.in(...)` reads for assignment groups, coach check-ins, and slot sessions with chunked/ranged reads.
  - Replaced unchunked attendance `.in('booking_session_id', ...)` with chunked/ranged reads.
  - Added explicit reference-query error handling for branches, schedule templates, and coaches.
  - Existing activity-log chunking was left unchanged.
- Read-only row verification after the source fix:
  - source sessions 1473.
  - linked makeup sessions 198.
  - merged sessions 1535.
  - unique slot ids 476.
  - assignment groups 640.
  - slot sessions for attendance scope 1589.
  - attendance-scope session ids 1628.
  - attendance rows 1389.
  - coach check-ins 557.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - `npm.cmd run attendance:reconcile:dry-run`
  - `npm.cmd run prod:check` with the known local `SLIPOK_TEST_MODE=true` warning.
  - `git diff --check` with only the known Windows LF/CRLF warning for `src/app/(admin)/admin/makeup/page.tsx`.
- After build, the stale `.next` folder in this repo was removed and `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000` was restarted successfully; `/` and a `_next/static/*` JS asset returned 200.
- Authenticated local read-only smoke passed on `/admin/makeup`:
  - Review tab loaded with 72 review items, 52 visible rounds, 18 no-coach items, 6 missing-evidence items, 67 actionable makeup items, 0 completed makeups, and 67 learners.
  - Makeup tab loaded with 67 month cards; search for `กระต่าย` narrowed to 1 month.
  - Date-target smoke for `/admin/makeup?date=2026-07-08` highlighted the expected 10:00-12:00 round.
  - Browser console errors/warnings were 0, and no write action was clicked.
- Authenticated production read-only smoke passed on `https://www.newathleteschool.com/admin/makeup`:
  - Review tab showed the same 72 review items and 52 visible rounds.
  - Makeup tab loaded with 67 month cards; search for `กระต่าย` narrowed to 1 month.
  - Browser console errors/warnings were 0, Vercel `--level error` logs found no logs, and no write action was clicked.
- No API route, DB write, migration, schema change, client redesign, tab/filter behavior change, attendance source-of-truth change, lesson wallet/payment/pricing/booking/check-in business logic change, storage deletion, or Admin Makeup write action was performed.

## 2026-07-09 - Admin Users Read Transport Cleanup

- Phase 2.4 `/admin/users` Option 1 safe read transport cleanup is committed, pushed, deployed, and read-only smoke verified.
- Source commit `3751058` (`fix(users): range large read queries`) was pushed on branch `spike/next-major-security-upgrade`.
- Deployment id `dpl_3SDZ79Ka4fDuYp2R4S39kGfSLW7k`; deployment URL `https://new-athlete-badminton-school-f00bitzjl-aachanin1s-projects.vercel.app`; production alias `https://www.newathleteschool.com`; deployment status Ready.
- Source scope was limited to `src/app/(admin)/admin/users/page.tsx`.
- Read transport changes:
  - Added a local ranged Supabase read helper using `.range(...)` pages of 1000 rows.
  - Replaced broad reads for `profiles`, `children`, and `bookings` with ranged reads.
  - Added explicit read error handling for those three large reads.
  - Added `childrenByParentId` map shaping so parent-child display no longer repeatedly filters the full child list per user.
  - Deferred optional `users-client` memo cleanup to a future pass.
- Read-only row verification after the fix:
  - Local smoke before production deploy showed 306 users/profiles, 289 children, 21 coaches, and 475 bookings.
  - Production smoke after deploy showed 307 users/profiles, 234 parents, 46 adults, 289 children, 21 coaches, and 475 bookings. The one-user difference was a new production user observed after local verification.
- Verification passed:
  - `npm.cmd run check:mojibake`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - `npm.cmd run attendance:reconcile:dry-run`
  - `npm.cmd run prod:check` with the known local `SLIPOK_TEST_MODE=true` warning.
  - `git diff --check` with only the known Windows LF/CRLF warning for `src/app/(admin)/admin/users/page.tsx`.
- After build, the stale `.next` folder in this repo was removed and `npm.cmd run dev -- --hostname 127.0.0.1 --port 3000` was restarted successfully; `/` and a `_next/static/*` JS asset returned 200.
- Authenticated local read-only smoke passed on `/admin/users`: full list loaded, search for `เบเน่` narrowed to 1 user, parent/child display remained intact, coach role filter showed 12 coach users, and the user detail panel opened read-only.
- Authenticated production read-only smoke passed on `https://www.newathleteschool.com/admin/users`: full list loaded, search for `เบเน่` narrowed to 1 user, parent/child display remained intact, and the user detail panel opened read-only.
- Recent Vercel logs for the smoke window showed `GET /admin/users` returning 200 and no error-level entries in the fetched window.
- No API route, DB write, migration, schema change, create/edit/delete/role/password behavior change, parent/child semantics change, student level change, booking/payment/attendance/wallet semantic change, permission/auth change, client pagination/search contract change, deploy after docs, or `/admin/users` write action was performed.
- The then-unrelated `src/app/page.tsx` phone-number changes were not staged, committed, or modified for this work; they were completed later in commit `983e998`.

## 2026-07-09 - Public Contact Phone Update

- Public homepage/contact phone number is deployed to production.
- Source commit `983e998` (`fix(site): update contact phone number`) was pushed on branch `spike/next-major-security-upgrade`.
- Deployment id `dpl_5NrcM92CVrbu5k2BA9Le3gp9G3CC`; production alias `https://www.newathleteschool.com`; deployment status Ready.
- Source scope was limited to `src/app/page.tsx`.
- Contact display now uses `080-252-7227`; contact links now use `tel:0802527227`.
- Replaced old contact number/link `080-059-6004` / `tel:0800596004`.
- Verification passed: `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check` with only the known Windows LF/CRLF warning.
- Local smoke passed on `/`: contact section rendered, the new display phone and both `tel:0802527227` links were present, old phone/link were absent, and browser console warnings/errors were 0.
- Production smoke passed on `https://www.newathleteschool.com`: the new display phone and both `tel:0802527227` links were present, old phone/link were absent, and Chrome console warnings/errors were 0.
- No DB write, API change, migration, package/config change, business logic change, storage action, or post-deploy write action was performed.

## 2026-07-09 - Documentation Verification Pass

- Documentation-only verification after Phase 2/2.5 closeout and the public phone update is complete.
- Current docs now reflect that Phase 2 `/admin/makeup`, `/admin/payments`, `/dashboard/history`, `/admin/users`, Phase 2.5 Ranking read/search, the `/admin/ranking` search follow-up, the owner test booking cleanup, `/dashboard/booking` draft preservation, slip upload reliability hardening, and the public contact phone update are closed.
- Ranking search follow-up is PASS and no longer NEED REVIEW; current production search is enabled on both `/ranking` and `/admin/ranking`.
- Historical notes that mentioned an unrelated dirty `src/app/page.tsx` phone change now explicitly point to the later completed phone commit `983e998`.
- Historical next work was Phase 3 / Role Smoke Readiness, followed by Phase 3 Deploy Readiness; **superseded by Current Source of Truth / Pricing Reconciliation**. Attendance Sync remains a regression guard unless new attendance work starts.
- Real NEED REVIEW items remain open: role-pure Standard Coach browser smoke if required, Admin Makeup write actions requiring owner-approved exact targets, live SlipOK write smoke without a safe test case, and booking draft smoke gaps where no safe matching data existed.
- This pass changed documentation only. No source code, API, DB, migration, package/config, deploy, or write action was performed.

## Unknown / Need Verification

- Current `.env.local` values were not inspected directly in this audit. Read-only readiness check only confirmed required Supabase environment variables are present.
- Current remote DB migration state after the latest local work needs confirmation before future DB-dependent work.
- Final authenticated production/local smoke test across all roles after `86aa087` is partially complete. User, Head-Coach-like, Standard Admin, and Super Admin requested local admin surfaces are now verified, including `/admin/makeup`, `/admin`, `/admin/schedules`, and `/admin/payments` with no fresh console errors or hydration mismatch in the latest authenticated Chrome smoke. Standard Coach expected UI has been owner-confirmed, but a role-pure Standard Coach browser smoke still needs a Standard Coach account if browser verification is required.
- Admin makeup round-level actions other than the 2026-06-16 verified `assign_coach_to_round` and `replace_coach_for_past_round` cases still need owner-driven UAT because the important buttons write production data.
- Phase B.2-New.2 `assign_coach_to_round` owner-run production write UAT was read-only verified on 2026-06-16: PASS for the exact 2026-06-14 16:00-18:00 Ratchada target session.
- Phase B.2-New.3 `replace_coach_for_past_round` owner-run production write UAT was read-only verified on 2026-06-16: PASS for the exact 2026-06-14 15:00-17:00 Rama 2 target group.
- Production `/admin/makeup` clean-console smoke for the React #418 timezone display fix passed after deploy `d59af8c`; keep future production smoke read-only unless the owner approves exact write targets.

## Do Not Regress

- Do not restore Admin booking on behalf of users.
- Do not rely on `booking_sessions.status` alone for attendance display.
- Do not use old LV 1-60 level ranges.
- Do not bypass schedule templates/slots for bookings, reschedule, makeup, or wallet redemption.
- Do not add a SlipOK mode UI toggle.
- Do not weaken coach evidence requirements for weekly teaching-hour closing.
- Do not use native browser alert/confirm/prompt in product UI.

## 2026-06-17 - Public Ranking React #418 Timezone Display Fix

- Scoped `/ranking` display-only fix. No DB writes, migrations, ranking/sort logic changes, business logic changes, or docs changes were included in the source commit.
- Root cause: `src/components/shared/ranking-board.tsx` formatted latest assessment dates with `new Date(date).toLocaleDateString('th-TH', ...)` without an explicit timezone. Production server rendering could format UTC dates one day earlier than the browser in Asia/Bangkok, causing React hydration error #418.
- Source fix: `formatDate()` now uses `Intl.DateTimeFormat('th-TH', { day, month, year, timeZone: 'Asia/Bangkok' })`.
- Commit `f3da82670f7047a8160068fd1994c84f7e37f45a` (`fix(ranking): stabilize latest assessment date timezone`) changed only `src/components/shared/ranking-board.tsx` and was deployed to Vercel production.
  - Deployment id: `dpl_A9rxyHHukg6D3ncePFzaKD8egpmS`.
  - Deployment URL: `https://new-athlete-badminton-school-2kb185env-aachanin1s-projects.vercel.app`.
  - Production alias: `https://www.newathleteschool.com`.
  - Deployment status: Ready.
- Post-deploy production browser smoke for `https://www.newathleteschool.com/ranking` passed after initial load and two hard refreshes:
  - Console error/warning count: 0.
  - React hydration error #418: not present.
  - Computed font remains `Prompt, "Prompt Fallback"`.
  - `.woff2` preload links: 0.
  - Ranking content rendered with student list data.

## 2026-06-10 - Lesson Wallet Cross-Branch Course-Type Validation

- Fixed `/dashboard/lesson-wallet` redemption selection to stop guessing missing or invalid course types as `kids_group`.
- Root cause proved read-only: `/api/lesson-wallet` already allows cross-branch redemption when `branch_id + credit.course_type_id + day/time` matches an active `schedule_templates` row, but the UI/server mapper could display schedule options using a `kids_group` fallback. That mismatch could produce a false `รอบเรียนที่เลือกไม่ตรงกับรอบเรียนประจำในระบบ` error.
- Source fix: wallet schedule template mapping now requires a valid branch slug and DB-backed course type. Wallet credits with missing/invalid course type data are disabled with a clear UI warning instead of opening a mismatched redemption flow.
- Business rules unchanged: same-month redemption, future-slot requirement, duplicate learner guard, capacity guard, no-payment redemption, cross-branch allowance, and wallet status transitions remain intact.
- No DB writes, migrations, cleanup, commit, push, or deploy were performed for this scoped fix.
- Verification passed: `npx tsc --noEmit`, `npm run check:mojibake`, `npm run lint`, and `npm run build`.

## 2026-06-10 - Lesson Wallet Success Feedback + User Schedule Learner Dots

- Fixed scoped UI feedback after successful `/dashboard/lesson-wallet` redemption: the modal now shows a success toast before closing and refreshing.
- Fixed `/dashboard/schedule` calendar dots to use learner identity colors as the primary dot color instead of being overridden by derived attendance/status colors.
- Root cause proved read-only: wallet `redeem()` success path closed the dialog and refreshed without any success feedback; schedule calendar had child dot colors available but rendered `status.dotClassName || learnerDot`, so normal upcoming/wallet/status colors could hide per-learner colors.
- Business rules unchanged: wallet same-month redemption, duplicate learner guard, no-payment flow, schedule status badges, and detail-card status text remain intact.
- No DB writes, migrations, cleanup, commit, push, or deploy were performed for this scoped UI fix.
- Verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.

## 2026-06-10 - User Dashboard/Schedule Learner Color Parity

- Fixed scoped UI mismatch where `/dashboard` and `/dashboard/schedule` could show different colors for the same learner.
- Added shared learner color source `src/components/dashboard/learner-colors.ts` and updated both dashboard calendars to use it.
- Wallet/status meaning on `/dashboard/schedule` is now a separate violet ring marker, so learner identity remains the dot fill color and no longer turns gray because of wallet/status state.
- Business rules unchanged: booking, attendance, wallet redemption, reschedule, and schedule status logic were not changed.
- No DB writes, migrations, cleanup, commit, push, or deploy were performed for this scoped UI fix.
- Verification passed: `git diff --check`, `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.

# TODO-CODEX.md - Active Execution Index

Last updated: 2026-07-13

This is the short current queue. Read `AGENTS.md`, `PROJECT_STATE.md`, and this
file first. Use `DEVELOPMENT_TODO.md` for detailed history and decision records;
use `TODO.md` only as stale legacy reference after code verification.

## Current Deploy / Activation Gate

### 1. Kids Group Pricing Reconciliation - Highest Priority

Current classification: **BLOCKER — OPTION A ACTIVATION UAT FAILED; ENTRY ROLLED BACK TO ABSENT**.

Confirmed:

- Owner-approved Progressive formula is booking-level:
  `newBookingSessions * rateOf(previousActiveSessions + newBookingSessions)`.
- Progressive does not retroactively true-up earlier bookings or issue a monthly
  price-difference credit.
- Owner selected Option A: after Entry activation every new general Kids Group
  booking uses Progressive; active Legacy bookings in the same user/course/month
  contribute only `bookings.total_sessions` as the initial entitlement baseline.
  Legacy money is never deducted and old Legacy rows are not repriced, credited,
  refunded, assigned Progressive scope/snapshots, or backfilled.
- Verified examples: one 10-session booking `5,000`; split `5+5` totals `5,625`;
  ten one-session bookings total `5,825`.
- Legacy is a different settled-history monthly true-up. Verified examples:
  `5+5` totals `5,000`; ten settled one-session bookings total `5,000`; `8+8`
  totals `6,496`.
- General Kids Group gating source is complete, committed, and pushed at
  `5c8cee1e8a81f928b870e643a78e1d2baf39fa06`.
- Entry enabled + server-resolved `kids_group` now selects Progressive without a
  per-user UUID allowlist. Entry disabled keeps new bookings on Legacy. Adult Group
  and Private remain Legacy.
- Missing pricing-write, coupon-lifecycle, or payment-batch dependencies return a
  typed fail-closed response with no Legacy fallback or partial write.
- Existing Progressive edit/cancel remains selected by stored `pricing_scope_id`;
  payment drain remains authenticated and dependency-gated even if Entry is disabled.
- Owner confirmed Progressive replaces Legacy for general Kids Group Production
  traffic. Historical review is unpaid-only; paid/approved/verified rows are excluded.
- Exact Option A functional tree from `f8568a6` is deployed through clean commit
  `d4574a7` in Ready deployment `dpl_Cat3qUUPVamdZ8SkVCFTRQQyu4vE`.
  Pricing-write, coupon-lifecycle, payment-batch, and payment-review controls remain
  present; Entry and allowlist are absent; shared `SLIPOK_TEST_MODE` remains present.
- Stage A passed. Stage B payment completed for the same one approved booking.
  Original batch `eb5a1c73...` expired and was lazily cancelled; replacement batch
  `d65dc3b8...` approved in shared Test Mode with one attempt, one `700`
  allocation, one ledger source, no coupon, and no legacy payment row.
- Finance reconciles exactly: cash `+700`, booking net value `700`, allocation
  `700`, one distinct batch transaction, and no batch-header double count. User
  History and the one user success notification are correct.
- Admin/Super Admin notification source correction is complete in commit
  `60688a340d473b2bb64f0bee9b1e68cb8cf47c1a`. Migration `20260713153000` is applied
  remotely and replaces
  only `approve_progressive_payment_batch_v1`, preserves the existing user insert,
  and adds one amount-free `/admin/payments` notification for every current
  `admin`/`super_admin` profile. Approved replay returns before all notification
  inserts, so submit/recovery replay cannot duplicate them.
- Production repair completed for exactly unpaid booking `d6dad7aa...`, `550 -> 625`.
  Fresh pre/post checks found zero payment, coupon, wallet, attendance, batch,
  allocation, ledger, refund, credit, or accounting dependencies. Activity log:
  `98359d52-4da1-4ef2-bc75-a9b3a29db830`.
- All six audited unpaid candidates now match Progressive pricing. All 415 verified
  Kids Group bookings remained fingerprint-unchanged and excluded.

Blocked / Need action:

- The standalone design document named by the Owner as containing “Formula And
  Ordering / Scenario Matrix” was not present in the repo.
- Super Admin read-only UAT passed on `/admin/payments` and
  `/admin/notifications`; the existing Progressive batch is visible once with its
  permitted amount/details and the recipient-specific inbox loads without console,
  React, hydration, or network errors. No retroactive notification was expected or
  created.
- Standard Admin read-only UAT now also passed with a uniquely verified `admin`
  profile. The target Progressive batch appeared once with approved operational
  context and no structured amount, booking-total, allocation, revenue, or Finance
  fields in rendered UI or technically inspectable server payload. Dashboard totals
  were absent; Finance and Settings redirected safely; no data or control changed.
- Owner-approved Entry activation was attempted on exact source `f5b22a9` as Ready
  deployment `dpl_HBTap8Rv...`. Adult and Private authenticated previews remained
  Legacy, unauthenticated preview returned `401`, and no UAT business write occurred.
- The available Standard Admin identity had zero child learners, so Kids Group
  preview could not be reached without a prohibited Production write. The original
  Owner User/Parent `4 + 4` draft was unavailable and the exact `1,500 -> 2,000`
  runtime proof could not be completed. The approved primary rollback therefore set
  Entry to `false` and redeployed the exact same source as `dpl_3RS4MWu...`, Ready
  on all aliases. The later User-session follow-up resolved this identity blocker.
- Reconciliation found unchanged bookings `519`, scopes `2`, batches `4`, attempts
  `1`, allocations `1`, payments `469`, ledger `470`, coupons `0`, pricing tiers,
  and protected fingerprints. Notifications `16032 -> 16034` were two unrelated
  real coach-assignment notifications correlated to operational activity logs, not
  UAT-created rows. Vercel error/5xx/SlipOK log counts were `0`.
- The Owner-confirmed User session is verified as one unique Production profile
  with role `user` and one existing owned child. Its July Kids Group active/settled
  history is exactly two ordered `verified` bookings of `2 + 2 = 4` sessions and
  `1,250 + 1,250 = 2,500`; cancelled bookings are excluded.
- A new browser-local draft safely selected four template-backed future sessions
  without a coupon and reached the unconfirmed summary. Entry-off Legacy preview
  passed exactly: `4` previous + `4` new = `8`, authoritative rate `500`, charge
  `8 * 500 - 2,500 = 1,500`. The policy Progressive arithmetic is `4 * 500 = 2,000`.
  No confirmation or Production write occurred.
- Production now has the compatible source/RPC and migration, but Entry remains
  absent by design. Do not activate it without the separate final activation/UAT
  approval and rollback gate.
- Read-only Production blast radius: `373` active Legacy-only user/month periods,
  `1` Progressive-only period, `0` mixed periods, `423` active Legacy bookings and
  `2,416` Legacy entitlement sessions. Current/future July-August exposure is `185`
  Legacy-only periods, `219` bookings, and `1,283` sessions. There are `68`
  multiple-child periods, `97` wallet/reschedule periods, `0` coupon-affected
  periods, and `0` existing Progressive scopes with unmatched active Legacy rows.
- `bookings.total_sessions` is the canonical Legacy entitlement source: all `423`
  active Legacy rows lack `entitlement_sessions`, yet `total_sessions` matches the
  original/root session count for every row. Raw session rows would overcount `87`
  rescheduled bookings; `25` also have wallet dependencies.
- Option A decision/audit documentation is committed and pushed at
  `b0cab81014a2dde2e245fd4e156a98b1048f1dfc`; no source or Production state changed.
- Owner approved the audited compatibility implementation scope, but Gate 0 found
  that the previously recorded full Option A audit hash was not a Git object.
  Fresh fetch proved local/remote HEAD `e61d612118b57fb36137e4bb2306715feee5f43f`
  directly descends from the corrected audit commit above. Source implementation
  stopped before any TypeScript or migration edit, as required by the Gate 0 rule.
- The Owner accepted the corrected provenance and documentation correction commit
  `21e32c7c5ee3254b981f8dabf19f515c6c77e8eb`, and explicitly authorized source
  implementation to resume from Gate 1. Remote migration, deploy, Entry activation,
  and Production data changes remain separately gated and unapproved.
- Option A source implementation and verification are complete. The authoritative
  helper sums only eligible null-scope Legacy `bookings.total_sessions`; immutable
  scope count/fingerprint initialization and drift protection run under the scope
  advisory lock; preview/create carry expected baseline evidence; repricing starts
  from the stored baseline and touches only Progressive rows. Capability source is
  version `2`.
- Full disposable migration reset, rollback-only runtime fixtures, real
  two-connection first-scope concurrency, all relevant deterministic regressions,
  TypeScript, lint, mojibake, build, and clean post-build browser checks passed.
  No fixture residue remains and the disposable Supabase stack is stopped.
- Fresh Gate 0 for the approved migration/deploy round found the Production
  `PROGRESSIVE_PAYMENT_ENTRY_ENABLED` name present/encrypted, while the approved
  prerequisite and current docs required it absent. Its value cannot be read from
  Vercel CLI. Migration `20260713210000` remains pending and deployment remains
  `dpl_3RS4MWu...`; no migration, deploy, environment, or Production data change
  was performed after this drift was detected.
- Owner then authorized one isolated environment cleanup. The exact Production-only
  Entry variable was removed without replacement. Fresh full-name evidence changed
  from `11` to `10`: removed Entry only, added `0`, and all remaining variable
  metadata stayed unchanged. The four dependencies and shared SlipOK name remain;
  the allowlist remains absent.
- The separately approved migration/deploy round completed from fresh Gate 0/0A.
  Remote migration `20260713210000` is applied exactly once; capability is Ready at
  version `2` with `immutable_scope_v1`. Exact functional source `f8568a6` was
  deployed through identical documentation commit `d4574a7` as Ready deployment
  `dpl_Cat3qUUPVamdZ8SkVCFTRQQyu4vE` on all four aliases.
- Entry and allowlist remain absent; four dependency controls and shared SlipOK Test
  Mode remain present. Preserved Kids `4+4` stayed Legacy `1,500`, Adult/Private
  source routing stays Legacy, unauthenticated preview returned `401`, and existing
  Progressive User History/batch records remained readable/drain-capable. No
  Booking, Payment, edit/cancel, batch, allocation, or notification action ran.
- Protected pre/post migration fingerprints matched at all `21` checkpoints. Five
  later attendance rows and one coach reminder were correlated to real coach
  operations; migration/deploy-attributable business-data delta is `0`.
- The separately approved final activation attempt added only Production Entry,
  deployed exact clean source `d4574a7` as Ready
  `dpl_Hqz23xUgUXYSH1FtoVZUXSgS2Bqh`, and reached the authenticated no-write July
  `4+4` preview. The authoritative Progressive fields were baseline `4`, previous
  Progressive `0`, new `4`, cumulative `8`, rate `500`, coupon `0`, gross/final
  `2,000`.
- Mandatory UAT nevertheless failed because the same customer summary still showed
  Legacy true-up copy saying `หักยอดที่จ่ายแล้ว: ฿2,500`. Historical Legacy money
  must never be described as deducted from a Progressive charge. No source change
  was authorized in the activation round.
- The approved immediate rollback removed Entry rather than setting it to `false`
  and restored Ready deployment `dpl_Cat3qUUPVamdZ8SkVCFTRQQyu4vE` on all four
  aliases. Final environment names returned `11 -> 10`: Entry removed, allowlist
  absent, four dependencies and shared Test Mode unchanged. Kids Group again
  previews through Legacy (`1,500`); Adult/Private remain Legacy; unauthenticated
  preview is `401`; existing Progressive history/drain remains readable.
- Protected activation pre/post fingerprints matched for every Booking, session,
  scope, snapshot, receipt, payment/batch/attempt/allocation, Ledger, coupon, wallet,
  attendance, tier, Finance, and target record. Notifications `16,144 -> 16,147`
  were three timestamp-correlated real coach-assignment rows. UAT-attributable
  business-data delta, customer impact, and financial impact are all `0`; bounded
  errors, 5xx, baseline/dependency faults, and SlipOK activity were `0`.

Next gated continuation:

- Do not repeat the completed payment, confirm the prepared draft, or create another
  booking. Core Option A source, migration, and Entry-absent deploy remain complete.
  Obtain separate Owner approval for a narrowly scoped source correction that makes
  the Kids Group summary branch on Progressive mode and removes Legacy true-up/
  deduction copy from Progressive previews, with deterministic UI regression tests.
  A later activation/UAT retry remains separately gated.

Do not do now:

- Do not create another UAT booking, perform additional repair/repricing, edit the
  UUID allowlist, call live SlipOK, or change pricing tiers.
- Do not describe general Production routing as active or the overall rollout as
  Task Done while Entry is absent; earlier `PASS` records are scoped to their
  completed Admin read-only UAT gates.
- Do not merge Legacy true-up language into the Progressive formula.
- Do not reactivate Entry before the customer-summary source/test blocker is fixed,
  committed, pushed, deployed Entry-off, and separately approved for retry.

Next gated work:

1. Obtain Owner approval for the narrow Progressive customer-summary source/test fix.
2. Implement and verify that Progressive mode never renders Legacy money-deduction
   language, while Legacy mode keeps its existing true-up explanation.
3. Commit/push and deploy the corrected source Entry-off under separate approval.
4. Obtain separate approval for a final activation/no-write UAT retry.

Conditions before any Production write or deploy:

- Owner approval for the exact gated action; the formula/rollout policy is confirmed.
- Exact target rows and dependency impact reported before write.
- Separate approval for deployment, exact Production controls/activation, and UAT.
- Rollback and reconciliation plan that preserves payment/accounting evidence.

### Progressive Status Matrix

| State | Current result |
| --- | --- |
| Source complete | No for activation-ready customer summary; core Option A TypeScript/RPC/migration source remains complete at `f8568a6` |
| Tests passed | No for mandatory Production activation UAT; existing deterministic/runtime suites remain passed |
| Committed | Yes - core source `f8568a6`; activation rollback documentation is the follow-up commit |
| Pushed | Yes after this rollback documentation closeout |
| Deployed | Yes - Option A functional tree via `d4574a7`, `dpl_Cat3qUUPVamdZ8SkVCFTRQQyu4vE` Ready |
| Option A migration | `20260713210000` applied remotely exactly once |
| Dependencies enabled | Yes - four dependency controls `true` |
| Entry enabled | No - activation attempt rolled back; Production variable absent/default-deny |
| Allowlisted | No - absent in Production; not required by new source |
| Production UAT | Failed mandatory no-deduction UI proof: authoritative Progressive `4 + 4 = 2,000`, but stale summary said Legacy `2,500` was deducted |
| General users active | No - Entry absent; Option A installed but not active |
| Adult/Private | Legacy |
| Data repaired | Yes - `d6dad7aa...`, `550 -> 625`, dependencies preserved |
| Data repaired this round | No |
| Task done | No - pricing blocker remains active |

## Paused Until Pricing Reconciliation Closes

- Homepage LV copy audit/fix (`LV 71+` / `70+` versus active LV 0-70).
- Other feature work, optional hydration hardening, and broad Phase 3 follow-up.
- Resume only after the Owner closes or explicitly deprioritizes the pricing blocker.

## Short Completed Summary

- Progressive pricing, transaction, coupon, payment-batch, payment integration, and
  general Kids Group Entry source are complete. The Admin/Super Admin notification
  source correction is committed at `60688a3`; migration `20260713153000` is applied
  and is included in the current Option A deployment.
  Detailed verification is in `PROJECT_STATE.md` and `DEVELOPMENT_TODO.md`.
- Current deployed state is the Option A functional tree from `f8568a6`, deployed
  via clean `d4574a7` as Ready deployment `dpl_Cat3qUUPVamdZ8SkVCFTRQQyu4vE`.
  Migration `20260713210000` is applied; shared Test Mode remains present and no
  Progressive-only SlipOK mode exists.
- Seven recorded Kids Group Production price repairs were completed under Legacy
  true-up rules. They are historical repairs, not evidence that Owner Progressive
  policy and current Production runtime match.

## Worktree / Safety Notes

- Production runs Option A functional source from clean `d4574a7` in Ready
  deployment `dpl_Cat3qUUPVamdZ8SkVCFTRQQyu4vE`; migration `20260713210000` is
  remotely applied. Entry and allowlist are absent/default-deny.
- The pre-existing unrelated `AGENTS.md` worktree change remains excluded.
- The unconfirmed User/Parent `4 + 4` summary remains browser-local. Do not click
  confirmation. No Production business row changed during its preparation.
- Final activation used a temporary clean detached `d4574a7` worktree, which was
  removed after rollback. The authenticated tab was handed back without confirming
  the draft.
- Production UAT created one Progressive booking/scope/session only. Payment used
  one lazily cancelled original batch plus one approved replacement batch, one
  successful Test Mode attempt, one allocation, one ledger row, and one user
  notification. No second booking, legacy payment row, coupon, allowlist, pricing
  tier, historical repair, or Production business-data repair occurred in the
  migration/deploy round. Entry was not activated.

## Session Exit Checklist

- Apply the Session Closeout Protocol in `AGENTS.md`.
- Update `PROJECT_STATE.md` and this file whenever policy, source, Production state,
  risks/blockers, or the next task changes.
- Put long reconciliation/release history in `DEVELOPMENT_TODO.md`.
- Run `npm.cmd run check:mojibake` and `git diff --check` for docs-only Thai edits.
- Remaining work: separate Owner approval for the Progressive customer-summary
  source/test correction, followed by separately approved Entry-off deployment and
  activation/no-write Production UAT retry. Entry remains absent now.
- Classification:
  **BLOCKER — OPTION A ACTIVATION UAT FAILED; ENTRY ROLLED BACK TO ABSENT**.

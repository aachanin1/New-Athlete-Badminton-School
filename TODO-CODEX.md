# TODO-CODEX.md - Active Execution Index

Last updated: 2026-07-13

This is the short current queue. Read `AGENTS.md`, `PROJECT_STATE.md`, and this
file first. Use `DEVELOPMENT_TODO.md` for detailed history and decision records;
use `TODO.md` only as stale legacy reference after code verification.

## Current Deploy / Activation Gate

### 1. Kids Group Pricing Reconciliation - Highest Priority

Current classification: **BLOCKER — USER/PARENT 4+4 DRAFT VERIFIED; LEGACY ACTIVE SCOPE NOT READY FOR ENTRY**.

Confirmed:

- Owner-approved Progressive formula is booking-level:
  `newBookingSessions * rateOf(previousActiveSessions + newBookingSessions)`.
- Progressive does not retroactively true-up earlier bookings or issue a monthly
  price-difference credit.
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
- Exact clean commit `f5b22a9` containing source `60688a3` is deployed in final
  Ready rollback deployment `dpl_3RS4MWu...`.
  Pricing-write, coupon-lifecycle, payment-batch, and payment-review controls are
  `true`; Entry is `false`; allowlist is absent; shared `SLIPOK_TEST_MODE=true`.
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
- Activation is not yet safe for this account. Both active bookings have
  `pricing_scope_id=null` and there is no July Progressive scope. The deployed
  source therefore returns `PROGRESSIVE_LEGACY_SCOPE_NOT_READY` before Progressive
  pricing when Entry is on. An Owner-approved compatibility policy/source scope is
  required; do not reactivate Entry on the assumption that this account will show
  `2,000`.

Next authorized continuation:

- Do not repeat the completed payment, confirm the prepared draft, or create another
  booking. The next work is an Owner decision on how active Legacy Kids Group
  bookings participate in initial Progressive Entry, followed by a separately
  approved source-only compatibility audit/fix if required. Entry activation must
  not be retried yet.

Do not do now:

- Do not create another UAT booking, perform additional repair/repricing, edit the
  UUID allowlist, call live SlipOK, or change pricing tiers.
- Do not describe general Production routing as active or the overall rollout as
  Task Done while Entry remains `false`; earlier `PASS` records are scoped to their
  completed Admin read-only UAT gates.
- Do not merge Legacy true-up language into the Progressive formula.

Next gated work:

1. Owner decides the compatibility contract for active Legacy bookings that have
   no Progressive pricing scope or entitlement snapshot.
2. Audit and implement only the separately approved source/migration/data scope;
   do not infer permission for migration or Production repair.
3. After compatibility readiness is proved, Owner separately approves another
   Entry activation attempt and no-write `4 + 4` runtime preview.

Conditions before any Production write or deploy:

- Owner approval for the exact gated action; the formula/rollout policy is confirmed.
- Exact target rows and dependency impact reported before write.
- Separate approval for deployment, exact Production controls/activation, and UAT.
- Rollback and reconciliation plan that preserves payment/accounting evidence.

### Progressive Status Matrix

| State | Current result |
| --- | --- |
| Source complete | General entry and staff notifications complete; active Legacy scope compatibility requires Owner decision |
| Committed | Yes - notification fix `60688a3` |
| Pushed | Yes - through the synchronized source/docs closeout on `origin/spike/next-major-security-upgrade` |
| Deployed | Yes - exact `f5b22a9` containing `60688a3`, final rollback `dpl_3RS4MWu...` Ready |
| Dependencies enabled | Yes - four dependency controls `true` |
| Entry enabled | No - rolled back to explicit `false` |
| Allowlisted | No - absent in Production; not required by new source |
| Production UAT | User/Parent Entry-off safe `4 + 4` draft passed at Legacy `1,500`; Entry-on proof blocked by active Legacy scope incompatibility |
| General users active | No - current default-deny entry routes to Legacy |
| Adult/Private | Legacy |
| Data repaired | Yes - `d6dad7aa...`, `550 -> 625`, dependencies preserved |

## Paused Until Pricing Reconciliation Closes

- Homepage LV copy audit/fix (`LV 71+` / `70+` versus active LV 0-70).
- Other feature work, optional hydration hardening, and broad Phase 3 follow-up.
- Resume only after the Owner closes or explicitly deprioritizes the pricing blocker.

## Short Completed Summary

- Progressive pricing, transaction, coupon, payment-batch, payment integration, and
  general Kids Group Entry source are complete. The Admin/Super Admin notification
  source correction is committed at `60688a3`; migration `20260713153000` is applied
  and exact clean `f5b22a9` is deployed.
  Detailed verification is in `PROJECT_STATE.md` and `DEVELOPMENT_TODO.md`.
- Current deployed state is `f5b22a9` in Ready deployment `dpl_3RS4MWu...` and
  contains the shared global `SLIPOK_TEST_MODE=true` behavior; no Progressive-only
  SlipOK mode remains.
- Seven recorded Kids Group Production price repairs were completed under Legacy
  true-up rules. They are historical repairs, not evidence that Owner Progressive
  policy and current Production runtime match.

## Worktree / Safety Notes

- Production runs exact clean `f5b22a9` containing source fix `60688a3` in Ready
  deployment `dpl_3RS4MWu...`; migration `20260713153000` is remotely applied.
  Entry remains `false` after the approved safe rollback.
- The pre-existing unrelated `AGENTS.md` worktree change remains excluded.
- The unconfirmed User/Parent `4 + 4` summary remains browser-local. Do not click
  confirmation. No Production business row changed during its preparation.
- Production UAT created one Progressive booking/scope/session only. Payment used
  one lazily cancelled original batch plus one approved replacement batch, one
  successful Test Mode attempt, one allocation, one ledger row, and one user
  notification. No second booking, legacy payment row, coupon, migration, allowlist,
  pricing tier, historical repair, or source change occurred. Entry remains `false`.

## Session Exit Checklist

- Apply the Session Closeout Protocol in `AGENTS.md`.
- Update `PROJECT_STATE.md` and this file whenever policy, source, Production state,
  risks/blockers, or the next task changes.
- Put long reconciliation/release history in `DEVELOPMENT_TODO.md`.
- Run `npm.cmd run check:mojibake` and `git diff --check` for docs-only Thai edits.

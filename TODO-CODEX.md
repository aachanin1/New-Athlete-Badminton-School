# TODO-CODEX.md - Active Execution Index

Last updated: 2026-07-13

This is the short current queue. Read `AGENTS.md`, `PROJECT_STATE.md`, and this
file first. Use `DEVELOPMENT_TODO.md` for detailed history and decision records;
use `TODO.md` only as stale legacy reference after code verification.

## Current Deploy / Activation Gate

### 1. Kids Group Pricing Reconciliation - Highest Priority

Current classification: **BLOCKER — ENTRY DISABLED; PROGRESSIVE ROLLOUT ROLLED BACK SAFELY**.

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
- Source `5c8cee1` is deployed in Ready rollback deployment `dpl_F2gfntq...`.
  Pricing-write, coupon-lifecycle, payment-batch, and payment-review controls are
  `true`; Entry is `false`; allowlist is absent; shared `SLIPOK_TEST_MODE=true`.
- Stage A passed. Stage B created exactly one Progressive booking/scope/session and
  one prepared batch, but Chrome blocked attaching the harmless UAT image because
  the extension lacks file-URL access. Entry was immediately rolled back off.
- Production repair completed for exactly unpaid booking `d6dad7aa...`, `550 -> 625`.
  Fresh pre/post checks found zero payment, coupon, wallet, attendance, batch,
  allocation, ledger, refund, credit, or accounting dependencies. Activity log:
  `98359d52-4da1-4ef2-bc75-a9b3a29db830`.
- All six audited unpaid candidates now match Progressive pricing. All 415 verified
  Kids Group bookings remained fingerprint-unchanged and excluded.

Blocked / Need action:

- The standalone design document named by the Owner as containing “Formula And
  Ordering / Scenario Matrix” was not present in the repo.
- Enable Chrome extension file-URL access, then resume the existing prepared batch
  if still valid or let the normal lazy-expiry path handle it before preparing one
  replacement batch. Do not create a second booking.

Next authorized continuation:

- Complete only the existing UAT booking payment in shared Test Mode, verify all
  payment/Admin/Finance/notification invariants, then re-enable Entry last and
  repeat monitoring. No additional booking or repair is authorized.

Do not do now:

- Do not create another UAT booking, perform additional repair/repricing, edit the
  UUID allowlist, call live SlipOK, or change pricing tiers.
- Do not describe the current end-to-end state as `PASS`.
- Do not merge Legacy true-up language into the Progressive formula.

Next gated work:

1. Owner enables Chrome file-URL access and confirms it is ready.
2. Resume the existing UAT payment drain; do not create a second booking.
3. If payment, Admin/Finance, logs, and reconciliation pass, set Entry `true` last,
   redeploy `5c8cee1`, and repeat bounded monitoring.

Conditions before any Production write or deploy:

- Owner approval for the exact gated action; the formula/rollout policy is confirmed.
- Exact target rows and dependency impact reported before write.
- Separate approval for deployment, exact Production controls/activation, and UAT.
- Rollback and reconciliation plan that preserves payment/accounting evidence.

### Progressive Status Matrix

| State | Current result |
| --- | --- |
| Source complete | Yes - general Kids Group entry without UUID allowlist |
| Committed | Yes - `5c8cee1` |
| Pushed | Yes - `5c8cee1` on `origin/spike/next-major-security-upgrade` |
| Deployed | Yes - `5c8cee1`, current `dpl_F2gfntq...` Ready |
| Dependencies enabled | Yes - four dependency controls `true` |
| Entry enabled | No - rolled back to explicit `false` |
| Allowlisted | No - absent in Production; not required by new source |
| Production UAT | Stage A passed; Stage B blocked after prepare, before upload |
| General users active | No - current default-deny entry routes to Legacy |
| Adult/Private | Legacy |
| Data repaired | Yes - `d6dad7aa...`, `550 -> 625`, dependencies preserved |

## Paused Until Pricing Reconciliation Closes

- Homepage LV copy audit/fix (`LV 71+` / `70+` versus active LV 0-70).
- Other feature work, optional hydration hardening, and broad Phase 3 follow-up.
- Resume only after the Owner closes or explicitly deprioritizes the pricing blocker.

## Short Completed Summary

- Progressive pricing, transaction, coupon, payment-batch, payment integration, and
  general Kids Group Entry source are complete and pushed through `5c8cee1`.
  Detailed verification is in `PROJECT_STATE.md` and `DEVELOPMENT_TODO.md`.
- Current deployed source `56daabf` contains the shared global
  `SLIPOK_TEST_MODE=true` corrective commit `0fbf98f`; no Progressive-only SlipOK
  mode remains.
- Seven recorded Kids Group Production price repairs were completed under Legacy
  true-up rules. They are historical repairs, not evidence that Owner Progressive
  policy and current Production runtime match.

## Worktree / Safety Notes

- Source `5c8cee1` was deployed; no source file changed in the rollout.
- The pre-existing unrelated `AGENTS.md` worktree change remains excluded.
- Production UAT created one Progressive booking/scope/session and one prepared
  batch. No slip, attempt, allocation, payment, coupon, or ledger row was created.
  No migration, allowlist, pricing tier, historical repair, or source change occurred.

## Session Exit Checklist

- Apply the Session Closeout Protocol in `AGENTS.md`.
- Update `PROJECT_STATE.md` and this file whenever policy, source, Production state,
  risks/blockers, or the next task changes.
- Put long reconciliation/release history in `DEVELOPMENT_TODO.md`.
- Run `npm.cmd run check:mojibake` and `git diff --check` for docs-only Thai edits.

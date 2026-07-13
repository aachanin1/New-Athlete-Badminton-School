# TODO-CODEX.md - Active Execution Index

Last updated: 2026-07-13

This is the short current queue. Read `AGENTS.md`, `PROJECT_STATE.md`, and this
file first. Use `DEVELOPMENT_TODO.md` for detailed history and decision records;
use `TODO.md` only as stale legacy reference after code verification.

## Current Deploy / Activation Gate

### 1. Kids Group Pricing Reconciliation - Highest Priority

Current classification: **PASS — GENERAL KIDS GROUP GATING SOURCE ONLY; DEPLOY/ACTIVATION/UAT AND ONE-ROW REPAIR PENDING**.

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
- Production still has older source `56daabf` deployed as
  `dpl_AG8zaB1Wexi5hCKuh5jeDQzfabuW`, but all Progressive control names and the
  allowlist name are absent from Production. Deployed = yes; Enabled = no;
  Allowlisted = no; Production active = no; UAT = not performed.
- Read-only Production audit found 6 genuinely unpaid candidates. Five already
  match Progressive pricing; `d6dad7aa...` is `550` Legacy versus `625`
  Progressive. All 415 verified Kids Group bookings have approved payment evidence
  and are excluded. See `PROJECT_STATE.md` for exact scope and dependencies.
- Owner separately approved the later unpaid repair `d6dad7aa...`, `550 -> 625`.
  It remains unperformed and must not be bundled with deploy/activation.

Unknown / Need verification:

- The standalone design document named by the Owner as containing “Formula And
  Ordering / Scenario Matrix” was not present in the repo.
- Current live behavior after a future deploy/activation remains unverified until
  controlled Production UAT is separately approved and completed.

Separate Owner approval required next:

- Approve deployment of `5c8cee1`, exact Production controls/activation order,
  controlled Production UAT, monitoring, and rollback plan.
- The one-row repair already has Owner policy approval but remains a later separate
  write round with a fresh immediately pre-write dependency check.
- No approval is requested to touch paid/approved/verified rows or downstream data.

Do not do now:

- Do not repair/reprice Production data, deploy, change environment variables,
  enable flags, edit the UUID allowlist, call live SlipOK, or change pricing tiers.
- Do not describe the current end-to-end state as `PASS`.
- Do not merge Legacy true-up language into the Progressive formula.

Next gated work:

1. Owner approves or defers deploy/activation/UAT for `5c8cee1`.
2. If approved, verify exact Production controls before deploy, activate in the
   approved order, and run controlled UAT.
3. Run the already approved one-row repair only in its later separate write round.

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
| Deployed | No for `5c8cee1`; Production remains `56daabf` / `dpl_AG8za...` |
| Enabled | No - relevant Production variable names absent |
| Allowlisted | No - absent in Production; not required by new source |
| Production UAT | Not performed |
| General users active | No - current default-deny entry routes to Legacy |
| Adult/Private | Legacy |

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

- Source commit `5c8cee1` and this context follow-up are the only approved round scope.
- The pre-existing unrelated `AGENTS.md` worktree change remains excluded.
- No migration, DB/Production data, environment, flag, allowlist, deploy, or
  Production UAT action is authorized in this round.

## Session Exit Checklist

- Apply the Session Closeout Protocol in `AGENTS.md`.
- Update `PROJECT_STATE.md` and this file whenever policy, source, Production state,
  risks/blockers, or the next task changes.
- Put long reconciliation/release history in `DEVELOPMENT_TODO.md`.
- Run `npm.cmd run check:mojibake` and `git diff --check` for docs-only Thai edits.

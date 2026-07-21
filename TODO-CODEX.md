# TODO-CODEX.md - Active Execution Index

Last updated: 2026-07-21

This is the short current queue. Read `AGENTS.md`, `PROJECT_STATE.md`, and this
file first. Use `DEVELOPMENT_TODO.md` for detailed history and decision records;
use `TODO.md` only as stale legacy reference after code verification. Current
mutable state is authoritative only in `PROJECT_STATE.md`.

## Current Active Work

### Admin Schedules Performance

Status: **ACTIVE — SOURCE-ONLY CANARY REMEDIATION COMMITTED/PUSHED; PRIOR
CANARY UNPROMOTED; NEW DEPLOY/PERFORMANCE UAT NOT AUTHORIZED**.

- Owner approved Phase B Source Fix + Local Test and confirmed authenticated
  month-wide server-side Search on demand for learner, parent, Coach, branch,
  course, and booking status. The approved `3s/5s` normal/P95 budgets and 10-minute
  low-volatility reference-cache default remain unchanged.
- Source now uses a bounded monthly aggregate, authenticated selected-day detail,
  and authenticated bounded Search. Initial RSC does not preload full-month person,
  Level, Program, or Attendance detail; cancellation/generation guards prevent
  stale day and Search results.
- Local verification passed: Phase B `17/17`, assignment state `24/24`, Lesson
  Wallet `17/17`, disposable browser `5/5` with residue `0`, TypeScript, full
  ESLint, mojibake, build, clean restart/static smoke, and diff check. Local cold/
  warm-P95/day/Search were `2512.8/1187.8/187.3/473.7 ms` on the 2026-07-21
  resumed run. Docker/repo-local Supabase stayed on `127.0.0.1`; browser E2E
  passed `5/5` with residue `0`.
- Detailed Phase B report:
  `docs/performance/admin-schedules-phase-b-source-local-test-2026-07-20.md`.
- Source/Test commit `3d32401b13873592d5462e6776b0e847335d2d43` and the
  documentation closeout are pushed non-force. Owner waived repeat `.next`
  cleanup/clean-restart for the publish gate; the exact worktree had passed that
  smoke on 2026-07-20.
- Production-target Canary `dpl_5x2vzwUxAmxNaT8HZGJeBQ32JVr4` is `READY` on
  exact commit `b0bada3d076302d24ebe3b594c03b22bf0997869` and remains
  unpromoted. Super Admin functional UAT passed, but warm navigation P95 was
  `5.344 s`, selected-day exceeded `3 s` in `3/5`, and Search was
  `4.654–5.937 s`; the performance gate failed.
- Read-only diagnosis proves the warm July summary's eight data calls are two
  session pages + one wallet chunk + five assignment-group chunks with a branch
  cache hit. Vercel functions run in `iad1`, Supabase in `ap-northeast-2`, and
  bounded core SQL plans completed in milliseconds. Request fan-out/dependent
  phases are proven primary; cross-region RTT is inferred as an amplifier.
- Detailed diagnosis:
  `docs/performance/admin-schedules-phase-b-canary-performance-diagnosis-2026-07-21.md`.
- Owner approved and the local worktree completed a Source-only remediation:
  date-scoped assignment-group pagination reduces the July-equivalent warm summary
  formula from `8` to `4` calls, selected-day removes the duplicate session read,
  and bounded candidate-first Search no longer loads detailed month-wide person/
  group data for sparse results.
- Final local evidence passed: remediation `24/24`, assignment `24/24`, wallet
  `17/17`, TypeScript, ESLint, mojibake `243`, diff check, build, and disposable
  browser E2E `5/5` with residue `0`. Warm P95 was `2745.9 ms`; summary used `4`
  calls; warm day samples used `5–6`; representative Search used `6–8` bounded
  calls. Execution policy rejected repeat `.next` cleanup before execution, so
  repeat clean restart/static smoke is not claimed.
- Detailed remediation report:
  `docs/performance/admin-schedules-phase-b-canary-source-remediation-local-test-2026-07-21.md`.
- Source/Test commit `62ac775d81aa8a702cbab744fdfb2a7ab15791b7` and this
  documentation closeout are published non-force on the existing branch. Owner
  waived repeat `.next` cleanup/clean-restart for the exact verified worktree; the
  smoke was not rerun and is not claimed.
- Next Action: **Owner/PM reviews the publish result and explicitly decides
  whether to authorize a separate Canary Deploy + Performance UAT gate. Do not
  promote, deploy, migrate, access/write Production, change
  environment/feature controls/allowlists, or start another task without a new
  Owner gate.**

## Recently Completed

### Admin Schedules — Coach Overlap Guard and Ungrouped Coach Semantics

Status: **DONE — CORRECTIVE FORWARD SOURCE PRODUCTION-ACTIVE; READ-ONLY AND
CONTROLLED WRITE UAT PASSED; WRITE CONTAINMENT REMOVED; ALL 3 CONFIRMED DAMAGED
SLOTS REPAIRED AND OWNER-CONFIRMED**.

- Shared exact-overlap validation, legacy-only warnings, ungrouped display
  semantics, Level-source auto-name, dynamic member counts, atomic normal save,
  standalone read-only preflight, existing-group reservation backfill, lifecycle
  synchronization, and the concurrent-write migration are implemented and
  verified.
- Source/Test/Migration commit
  `1b995396f432d11b133c1cf4b5604b6db875b63b` remains pushed but is not
  Production-active after the confirmed Head Coach assignment and mixed-Level
  grouping regression and rollback. Emergency containment commit
  `3ad8a52dbda95b645608bce2f05917824e9763a6` was built from restored Source
  `0226e363f6677b078430f93459c2ee2ede6484e8`, pushed non-force on its scoped
  branch, and was deployed as Ready deployment `dpl_HTeRJnDLS5Z5ayEPGUvT2E4RGxti`.
  It is now the verified rollback target; all four Production aliases have since
  moved to the corrective Forward deployment recorded below. The Owner-authorized
  Nice/Ratchada repair is
  complete: exact group update `1` and matching legacy delete `1`. Three later
  Production-user actions intentionally moved its learners into Coach Base group
  `2e7...`; Owner confirmed Coach Base now owns all five learners and they must not
  be moved back. Former group `924...` has no coach and zero members. All five
  current Coach Base learners resolve to `basic / ชุดพื้นฐาน`. A fresh exact
  preflight passed and one conditional Production update changed only group
  `2e7...` name from `ยังไม่จัดกลุ่ม` to `ชุดพื้นฐาน`; affected rows `1`.
  Coach, five members, target legacy row, former group, Ramintra/Nice, attendance,
  check-in, teaching-hours/payroll, and financial evidence reconciled unchanged.
  Authenticated read-only Admin Schedules UAT shows Coach Base, `ชุดพื้นฐาน`, and
  the dynamic five-member count without console/page/hydration errors. Fresh
  migration-apply checkpoint preflight reported active exact groups `966`, current/future
  candidates `235`, blocking conflicts `0`, and historical report-only conflicts
  `8`. At the migration-apply checkpoint, approved migration `20260717070225`
  applied exactly once; remote pending was empty, reservations reconciled
  `235/235`, and missing/stale/orphan/mismatch rows were `0`. Production business
  data fingerprints and Coach/member/legacy targets
  remained unchanged. Exact Source `1b995396f432d11b133c1cf4b5604b6db875b63b`
  remains pushed but is no longer Production-active. At the containment checkpoint,
  containment infrastructure passed: deployment Ready, aliases `4/4`, `/`, `/api/health`, and static asset all
  `200`. Migration `20260717070225` remains applied exactly once. Protected totals
  and fingerprints matched before/after the no-write check: groups `1022`, members
  `2426`, legacy `996`, reservations `230`.
  At that checkpoint, authenticated Head Coach rendering was available at `36/39` assigned, `3`
  unassigned, and `135` learners. One authorized containment check returned `503`
  with code `COACH_ASSIGNMENT_SAVE_TEMPORARILY_DISABLED`; successful assignment
  Save activity after activation remained `0`.
  Incident activity logs show `51` successful normal Save operations across `47`
  slots, six Head Coaches, and six branches. Current surviving incident-window
  rows are `55` exact groups, `97` members, `50` legacy assignments, and `50`
  derived reservations. These operational writes were not controlled UAT and were
  not repaired. The 47 slots are the broader incident-window Save population;
  confirmed damaged slots were `3` at that incident checkpoint. Exact repair evidence is still required for
  each remaining damaged slot; row IDs and evidence limitations are in `DEVELOPMENT_TODO.md`.
  Pre-existing dirty
  `AGENTS.md`, `src/lib/schedule-slot-utils.ts`, and `docs/performance/` remain
  excluded; permanent `AGENTS.md` rule work remains separate.
- Historical failed-name checkpoint: Forward candidate Source/Test commit
  `c70f5a4ab92e8c3d33beb036e494d85e6e9bc0f9` (tree
  `0fecabd92e2f2c65b7bd59227b8d6b743e6bd820`) is pushed non-force on
  `codex/coach-assignment-forward-fix-20260718`. It is based directly on
  `1b995396...`, passes the full Local gate recorded in `PROJECT_STATE.md`, and is
  deployed only as Ready unpromoted dark artifact
  `dpl_CeoUkkLs2pSvcuLBzzdVNXn3dygD`. Production aliases remain `4/4` on
  containment `dpl_HTeRJnDLS5Z5ayEPGUvT2E4RGxti`; assignment writes remain
  disabled. Read-only Canary assignment semantics, mobile layout, Attendance,
  Teaching Programs, Wallet, DB fingerprints, and runtime 5xx checks otherwise
  passed, but one client React hydration `#418` occurred during the first Head
  Coach `/admin/schedules` guard redirect. It did not reproduce on a fresh Canary
  run or containment baseline. The Owner-authorized bounded retest then completed
  `56/56` clean client cycles across Canary and containment: direct `/coach`, hard
  reload, role-guard redirect, mobile 390x844, and three fresh logins per
  environment all had React `#418`/hydration/console/page errors and redirect loops
  `0`. Canary assignment semantics re-passed read-only. However, containment
  emitted one distinct middleware `refresh_token_not_found` error on `GET /`
  during the logout/login cycles, with response `200`; Canary runtime
  error/fatal/5xx remained `0/0/0`. At that intermediate checkpoint the overall
  zero-runtime-error gate was not passed; Owner later accepted this distinct
  containment baseline as non-blocking. Protected assignment counts/fingerprints remained groups
  `1022`, members `2426`, legacy `996`, reservations `230`; reservation business
  fields reconciled `230/230` with mismatch `0`; successful assignment Saves after
  containment remained `0`. One reservation timestamp-only refresh was traced to
  normal coach check-in/attendance activity, not an assignment mutation. No
  Controlled Write, promotion, or damaged-slot repair occurred.
- Historical bounded-retest Owner decision: Owner classified the one Containment-only
  `AuthApiError: Invalid Refresh Token: Refresh Token Not Found` as
  **ACCEPTED NON-BLOCKING CONTAINMENT AUTH-SESSION BASELINE**. It did not occur on
  Forward Canary, did not fail login or HTTP, and is unrelated to the Coach
  Assignment diff. Preserve it as an unauthorized separate follow-up. Forward
  Canary read-only UAT is **Passed**; original React `#418` remains **Unknown /
  Non-reproducible after clean bounded retest**; aliases promoted **No**.
- Historical first Controlled Write checkpoint: Owner/Head Coach then confirmed and saved one exact dark-Canary payload for slot
  `53c3556a-6067-4ad1-813c-ca8410d17994` exactly once. The Save was atomic:
  groups/members/legacy/reservations changed from `0/0/0/0` to `2/5/2/2`, global
  totals are `1024/2431/998/232`, and no orphan, mismatch, conflict, partial
  deletion, console error, or attendance/check-in/program/payment/wallet change
  was found. Controlled Write UAT nevertheless **Failed** because submitted manual
  names `ระดับสูง` and `กลาง-สูง` were stored as `กลุ่มผสม` and `ชุดพื้นฐาน` on
  groups `c56af2cf...` and `ec77cf98...`. The Source treats those legacy labels as
  auto-generated before the RPC. At that checkpoint another Save and promotion
  were prohibited; the slot was not closed as repaired and damaged slots remained
  `3`. The corrective checkpoint below supersedes this historical gate.
- Corrective manual-name Source/Test commit
  `9ef1ee30035a083426743aed3e326ad9676d65c4`, tree
  `94fe2410f0361acf639c47a4be7245c01128f21d`, is pushed non-force from parent
  `c70f5a4...`. It preserves every trimmed non-placeholder manual name and
  auto-names only blank, exact `ยังไม่จัดกลุ่ม`, or generic `กลุ่ม N` input after
  removing a trailing `(N คน)` suffix. Local gates passed: assignment/naming/
  authorization `33/33`, DB conflict/concurrency/lifecycle `22/22`, Playwright
  desktop/mobile `3/3`, Lesson Wallet `17/17`, TypeScript, ESLint, mojibake, diff
  check, Production Build, clean restart, and residue `0`.
- Owner/Head Coach performed one corrective Save on slot
  `53c3556a-6067-4ad1-813c-ca8410d17994` through dark Canary
  `dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX`. Controlled Write UAT passed: persisted names
  are `ระดับสูง` and `กลาง-สูง`; exact coach/member mapping remained `2/5`; legacy
  and reservation rows remained complete `2/2`; no partial write, orphan,
  mismatch, conflict, unsaved indicator, console/runtime/500/constraint error, or
  attendance/check-in/payroll/financial change was found. The 21 July Chaeng
  Watthana slot is repaired.
- The exact same Canary artifact was promoted without rebuild and is now Ready on
  all four Production aliases. Corrective Forward Source is Production-active;
  assignment writes are enabled and temporary containment is inactive. Public
  `/`, `/api/health`, static assets, authenticated Head Coach rendering, and
  post-promotion logs passed. Three later real Head Coach Saves succeeded without
  runtime/500/constraint errors. Current/future reservations reconcile `221/221`;
  missing/physical orphan/mismatch `0/0/0`. Fresh totals are groups `1026`, members
  `2436`, legacy `1000`, reservations `234`. Rollback target
  remains `dpl_HTeRJnDLS5Z5ayEPGUvT2E4RGxti`; migration remains applied once.
- The later activity includes the 22 and 29 July Suvarnabhumi slots. Each now has
  one `กลุ่มผสม`, three members, one exact coach, one legacy row, and one matching
  reservation. These rows are technically complete, but Codex did not receive the
  intended payloads before the real-user Saves, so correctness initially remained
  Unknown. Owner subsequently confirmed both actual payloads are correct. All
  three confirmed damaged slots are repaired and Task Done is **Yes**.
- Exact current matrix, Owner decisions, affected row ids, local test evidence,
  and controlled Production repair evidence are authoritative in `PROJECT_STATE.md` under
  **Admin Schedules — Coach Overlap Guard and Ungrouped Coach Semantics**.

Current next action is owned by the Active Work section above and the authoritative
matrix in `PROJECT_STATE.md`: **Admin Schedules Performance remains active; Phase B
Canary functional UAT passed, the performance gate failed, the Canary remains
unpromoted, Source-only remediation/local tests are committed and pushed, and Task
Done is No. Owner/PM reviews the publish result and explicitly decides whether to
authorize a separate Canary Deploy + Performance UAT gate.** Do not promote,
deploy, perform Production UAT, migrate, change Production
controls/data, or start the auth follow-up, historical cleanup, permanent dirty
`AGENTS.md` work, or another Parking Lot task without a new Owner gate.

## Earlier Completed

### Admin Schedules — Unassigned Coach Group Incorrectly Shown as Green

Status: **DONE — EXACT SOURCE DEPLOYED; AUTHENTICATED READ-ONLY PRODUCTION UAT
PASSED**.

- Exact functional Source `0226e363f6677b078430f93459c2ee2ede6484e8` is active in
  Ready deployment `dpl_CsuBEfun5RtPWpSgC5iQjYjbH7j8` on all four established
  Production aliases.
- Exact 2026-07-16 Rama 2 Kids Group 17:00–19:00 read-only UAT passed with
  `7 มีโค้ช / 5 รอจัดโค้ช / 2 อยู่ในกระเป๋า`; the no-coach group is red and both
  valid assigned groups remain green. Desktop, mobile 390x844, console/hydration,
  and runtime gates passed.
- No migration, environment/feature-control/allowlist change, auto-assignment,
  assignment/attendance/check-in write, Production business-data change, repair,
  or financial effect occurred for this task. Rollback was not used.
- Authoritative current state and the full consistency matrix are in
  `PROJECT_STATE.md`; detailed deployment/UAT evidence is in
  `DEVELOPMENT_TODO.md`.

### Admin Teaching Programs — Default Today + Date/Time/Branch Ordering

Status: **DONE — EXACT SOURCE DEPLOYED; READ-ONLY PRODUCTION UAT PASSED**.

- At its 2026-07-15 release closeout, subsystem-origin Source
  `039ad6e03ca0cb8c8c4334c81818c570b03b9287` was active in Ready deployment
  `dpl_6QCDg6omy3ZTFCm36W8G3AH7YqNr`. The feature remains included in the newer
  global Production Source; authoritative current deployment state is only in
  `PROJECT_STATE.md`.
- Authenticated read-only Production UAT passed default Bangkok today, date/time/
  same-time แจ้งวัฒนะ ordering, manual one-/two-sided date filters, search/status/
  coach/branch/course filters, pagination, detail selection, reload stability,
  console/hydration, and no-write/runtime gates.
- No migration, environment/feature-control/allowlist change, Review action,
  Production business-data write, data repair, or financial impact occurred.
- Authoritative current state and the full consistency matrix are in
  `PROJECT_STATE.md`; dated deployment/UAT evidence is in `DEVELOPMENT_TODO.md`.

### Production Lesson Wallet Canonical Recurring-Round Redemption

Status: **DONE — SOURCE DEPLOYED; NO-WRITE AND OWNER-VERIFIED CONTROLLED WRITE
PRODUCTION UAT PASSED**.

- At its 2026-07-15 closeout, Functional Source
  `bb7bd8b8015fb3fa7f0998b5bf8a1e5220e034ae` was active in Ready deployment
  `dpl_9ijGRLyvmMa9aT3EkP5zbqxkf6at` on all four aliases. Current Production
  deployment state is authoritative only in `PROJECT_STATE.md`.
- Read-only reconciliation distinguished exactly one successful redemption and a
  separate subsequent Owner Wallet-store action. Canonical target evidence is
  intact; active duplicate/overlap, orphan, Payment, coupon, Ledger, allocation,
  Finance, and repair counts attributable to the redemption are `0`.
- Authoritative current detail and the final consistency matrix are in
  `PROJECT_STATE.md`; dated evidence is in the 2026-07-15 Lesson Wallet record in
  `DEVELOPMENT_TODO.md`.

### Dashboard Booking Unlimited Slot Entry + Customer Price UX

Status: **DONE — REMOTE MIGRATION APPLIED; EXACT SOURCE DEPLOYED;
NO-WRITE PRODUCTION UAT PASSED**.

- Authoritative current state is in `PROJECT_STATE.md` under **Dashboard Booking
  Unlimited Slot Entry + Customer Price UX** and **Production**. Detailed dated
  evidence is in the 2026-07-15 release closeout in `DEVELOPMENT_TODO.md`.

### History Payment Selection 409 / Invalid Slip Modal State

Status: **DONE**.

- Authoritative current state is in `PROJECT_STATE.md`; dated implementation and
  Production UAT evidence remains in `DEVELOPMENT_TODO.md`.

## Parking Lot

### Homepage LV Copy Audit/Fix

Status: **PARKING LOT — OWNER SELECTION REQUIRED; NOT AUTHORIZED TO START**.

- Audit homepage copy for `LV 71+` / `70+` language against the active school
  level contract of LV 0-70.
- Do not introduce LV 71+ as current Production behavior without explicit Owner
  confirmation.
- Await explicit Owner selection before any audit or implementation work.

## Historical / Superseded Reference — Kids Group Pricing Reconciliation

State observed at the 2026-07-13 closeout. This retained reference is historical;
current mutable state is authoritative only in `PROJECT_STATE.md`. Pricing
reconciliation closed at that checkpoint, and Unlimited Slot Entry later became a
separate task that is now also DONE:
**PASS — PROGRESSIVE SUMMARY FIXED; OPTION A ENTRY ACTIVE; PRODUCTION 4+4=2,000 UAT PASSED; PRICING RECONCILIATION DONE**.

Confirmed final state:

- Permanent Option A policy is unchanged: every new general Kids Group booking
  uses Progressive after Entry activation; eligible Legacy bookings contribute
  only `bookings.total_sessions` entitlement to the initial baseline; Legacy money
  is never deducted and Legacy rows are never repriced, scoped, snapshotted,
  credited, refunded, or backfilled.
- Progressive summary root cause was localized to
  `src/components/dashboard/booking-client.tsx`: the component stored too little
  preview evidence and rendered the Legacy monthly true-up explanation for every
  Kids Group summary.
- Source fix commit `aa64adfb765139ca38908ca2409fa2127ffe4a29`
  uses the authoritative server preview `mode`, preserves the full Progressive
  preview evidence, renders a Progressive-only booking-level explanation, and
  leaves Legacy, Adult Group, Private, coupon, and zero-price business semantics
  unchanged.
- Narrow regression coverage is in `scripts/check-progressive-booking-entry.js`.
  Booking-entry checks increased from `25` to `31` and cover Progressive `4+4`,
  coupon, zero Legacy baseline, exact Legacy `4+4`, Adult Group, and Private.
- Source verification passed: booking entry `31`, Option A baseline `32`,
  Progressive pricing `17`, transactions `33`, coupon `38`, Legacy
  pricing/payment `14`, TypeScript, lint, mojibake `225`, build `90` routes, and
  `git diff --check`.
- Source commit was pushed to
  `origin/spike/next-major-security-upgrade`.
- Corrected Entry-absent rollback deployment is
  `dpl_GyGnKWq49mTU6NYNavWRVYLwmo3P`, Ready from exact clean source
  `aa64adf` on all four aliases when verified. Entry-off authenticated Kids Group
  remained Legacy: previous `4` / `2,500`, new `4`, cumulative `8`, rate `500`,
  target `4,000`, deduction `2,500`, charge `1,500`; Progressive-only copy was
  absent.
- Final activation deployment is
  `dpl_CJVW2EMw9pfacn4NeAj4vqPsaSsS`, Ready from the same exact clean source
  `aa64adf` on all four aliases. Production Entry is the exact non-sensitive
  value `true`; allowlist remains absent; all four Progressive dependencies and
  shared `SLIPOK_TEST_MODE` remain unchanged.
- The final activation required a forced rebuild because unchanged source had
  initially reused the Entry-off build cache. The forced artifact is the
  authoritative final deployment above.
- Authenticated no-write July UAT passed: eligible Legacy `2+2=4`, historical
  amounts `1,250+1,250=2,500`, cancelled rows excluded, previous Progressive `0`,
  new `4`, cumulative `8`, rate `500`, coupon `0`, gross/final `2,000`.
- Customer Summary visibly shows `คำนวณราคา Progressive สำหรับการจองครั้งนี้`,
  baseline `4`, previous Progressive `0`, new `4`, cumulative `8`, rate `500`,
  `ราคาการจองใหม่: 4 × 500 = 2,000 บาท`, and the preservation statement that
  historical payment is not deducted. Legacy target/deduction/credit wording is
  absent.
- Adult Group and Private remain Legacy by the unchanged server-only entry
  decision and deterministic regression proof. Existing Progressive History,
  approved batch, and payment-drain capabilities remain readable/Ready.
- Unauthenticated booking preview is `401`. Activation logs sampled `28` requests:
  error `0`, 5xx `0`, baseline fault `0`, dependency fault `0`, SlipOK `0`,
  booking-create POST `0`, and successful preview `1`. Browser console warnings/
  errors and hydration errors were `0`.
- Protected pre/post counts and SHA-256 fingerprints matched at every checkpoint:
  bookings `519`, sessions `2,785`, scopes `2`, snapshots `519`, receipts `3`,
  coupon reservations/usages `0/0`, batches/members `4/4`, attempts/allocations
  `1/1`, payments `470`, Ledger `471`, wallet `60`, attendance `1,622`,
  notifications `16,147`, tiers `11`, Finance expenses `1`, existing Progressive
  bookings `2`, approved batches `1`, and the repaired booking. UAT-attributable
  business-data delta is `0`.
- No booking was confirmed. No Booking, Payment, scope, session, snapshot,
  receipt, coupon, wallet, attendance, notification, Ledger, Finance, refund,
  credit, pricing-tier, Legacy, Adult Group, or Private write occurred.
- Rollback was not required after the successful final artifact. At that historical
  closeout, the corrected Entry-absent deployment was the documented rollback
  target; it is not a rollback target for Unlimited Slot Entry.

### Historical Progressive Status Matrix (2026-07-13 Closeout)

| State | Historical closeout result |
| --- | --- |
| Source complete | Yes - summary fix `aa64adf`; core Option A `f8568a6` |
| Tests passed | Yes |
| Committed | Yes - source commit; documentation closeout follows separately |
| Pushed | Yes - source commit; documentation closeout follows separately |
| Migration applied | Yes - `20260713210000` exactly once |
| Deployed | Yes - `dpl_CJVW2EMw9pfacn4NeAj4vqPsaSsS` Ready |
| Dependencies enabled | Yes - four dependency controls unchanged/true |
| Entry enabled | Yes - exact Production value `true` |
| Allowlisted | No - absent and not required |
| Production active | Yes - new general Kids Group uses Progressive |
| Production UAT | Passed - authoritative and visible `4+4=2,000` |
| Adult/Private | Legacy |
| Data repaired this round | No |
| Customer impact | Future new general Kids Group bookings now use Progressive |
| Financial impact | Future charges follow Option A; historical money/evidence unchanged |
| Pricing reconciliation task | Done at this closeout; later Booking/History and Unlimited Slot tasks are also closed |

## Worktree / Safety Notes

- Branch: `spike/next-major-security-upgrade`.
- The pre-existing unrelated unstaged `AGENTS.md` remainder remains excluded.
- Historical safety note: the Owner-controlled Production `4+4` draft was restored
  browser-locally after two atomic `409` capacity rejections. No booking was created.
  Do not replay Production confirmation without separate Owner authorization.
- Historical booking-regression rollback evidence referenced
  `dpl_CJVW2EMw9pfacn4NeAj4vqPsaSsS`. It is not a rollback target for Unlimited
  Slot Entry. At the pre-release checkpoint, its Source Fix was committed and
  pushed but its remote migration, deployment, and Production UAT had not yet
  occurred. That checkpoint is superseded by the completed release state in
  `PROJECT_STATE.md`.

## Session Exit Checklist

- Apply the Session Closeout Protocol in `AGENTS.md`.
- Update `PROJECT_STATE.md` and this file whenever policy, source, Production
  state, risks/blockers, or the next task changes.
- Put long reconciliation/release history in `DEVELOPMENT_TODO.md`.
- Run `npm.cmd run check:mojibake` and `git diff --check` for documentation edits.
- Next action: **Owner/PM reviews the Admin Schedules remediation publish result
  and explicitly decides whether to authorize a separate Canary Deploy +
  Performance UAT gate. Do not promote, deploy, perform Production UAT, migrate,
  change Production controls/data, or start another task automatically.**

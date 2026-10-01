# Set1 admission evidence and approved release — 2026-10-01

**Current: DEVELOPING / release HARD STOP before Production; TASK DONE No.** Composite Source8b1ca32 committed/pushed; local91/91 and retrospective38/38 passed. Old writer/new schema compatibility fails without a proven fence; compatible recovery remains unproved. Owner release approval including Dev hosted acceptance is received. No new hosted artifact, Production migration or Promotion. PROJECT_STATE.md owns mutable facts; see [latest closeout](#set1-approved-release-hard-stop--2026-10-01).

All preceding dated records below are Historical states observed at those closeouts, superseded for current status by the final approved-release closeout. Preserve their failures and acceptance limits; do not treat their old READY, Owner-pending or no-Production-authorization wording as the current gate.

## Historical — Set1 admission resume — 2026-09-30

**Historical follow-up at 2026-09-30: Dev-assisted UAT5PASS/1FAIL; Return expiry14hours late. DEVELOPING / HARD STOP — NOT READY FOR OWNER UAT.** Historical READY handoff below was superseded at that checkpoint; Source/build unchanged. See that dated Dev UAT section.

Owner approved the exact proposed Scope Contract on 2026-09-30: continuous isolated audit/correction/verification/commit/push/local staged artifact through READY FOR OWNER UAT only. Production migration/deploy/promotion/data/settings/control changes and Task2 are excluded. Private approved contract and preservation evidence: `C:/Users/aacha/AppData/Local/Temp/lesson-source-resume-20260930`.

## Scope and protected behavior

Actors: User/parent, Coach, Admin, Super Admin under existing authorization. Included: Reschedule, Wallet Store/Redeem, Return Entitlement, Makeup, and interacting Attendance/retrospective writes. Same-source exclusion, whole Family unit, parent/month quota and unrelated-family progress must coexist. Preserve pricing, settled bills, Legacy/Progressive formulas, Wallet/Makeup cutoff/expiry policy, learner identity, coach assignment/check-in rules, audit/replay and financial effects.

Original allowlist: Set1 application8, migrations3 (published v1/guards byte-frozen; one unpublished corrective v2), test/tool/config8, Finance baseline4 (application2/tests2 exactly copied from released d4aff85), Docs4. Exact paths are in the approved private Scope Contract. Existing AGENTS.md and other worktree/main pending work remain outside the change set. This document is the planned new handoff file, not a replacement for old failures.

## Direct technical dependency recorded BEFORE editing — branch push safety

Read-only Vercel project evidence confirms `gitProviderOptions.createDeployments=enabled`, linked repository, and main as Production branch. The existing vercel.json has no branch deployment guard. A push can otherwise trigger an unapproved hosted Preview using that project's environment; this round permits only a local staged artifact bound to new disposables.

Under the approved Scope Contract's exact direct-dependency exception, add **vercel.json** to the technical config allowlist solely for `git.deploymentEnabled["codex/lesson-source-atomic"]=false`. Do not change framework, install/build command, region, any other branch, project settings, environment, aliases, cron or Production behavior. This is a dependency of the already authorized scoped Git push and introduces no business flow. The final report must disclose this one additional technical path.

Official configuration semantics: [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration#gitdeploymentenabled): branch-specific false prevents deployment on commits; unspecified branches retain true. Effective scope counts become application10 (including unchanged Finance2), migrations3, tests/tools/config11 (including unchanged Finance tests2 and this one config dependency), Docs4. Current Production remains the Finance release dpl_7XeXzXzHq8DYQewxSWqnv5oqfkiu / d4aff85; this work does not authorize updating it.

## Evidence and completion

Results, exact application SHA, build identity, local URL, acceptance steps and limitations will be recorded at closeout after required checks. Owner UAT is pending; no Production readiness or TASK DONE claim is made here.

## Historical technical handoff — prior READY status superseded by Dev UAT

**Source complete / committed / pushed: Yes. Manual Owner UAT: pending. Production active for Set1 / Production ready / TASK DONE: No.** No hosted deployment, Production migration/write/config/control/cron/allowlist/Promotion was authorized or performed.

### Confirmed cause and behavior

The preserved before-fix test held a Return source transition and reproduced unrelated Coach/Admin attendance500/500. The global admission lock coupled unrelated parents. The final correction uses exclusive parent admission and coordinated parent/slot ordering, with fail-fast Attendance and retrospective conflicts. OLD and NEW parent identities are checked in deterministic order; exact booking/session/learner identities are revalidated before writing. Source admission still excludes conflicting same-parent work. Business-body comparison confirms preserved source lifecycle, Family membership, quota, cutoff/expiry, role and coach evidence rules.

Typed DB code/detail/hint now reaches the API error classifier. Admission/stale/identity failures produce typed conflicts; a pre-commit rollback is distinguished from an Attendance write that committed before a later follow-up failed. Unknown transport outcomes are not falsely classified as rollback. Published migrations were not rewritten; the corrective SQL adds no new pricing, payment, quota, attendance policy or entitlement feature.

### Exact changed paths and compliance

This round22distinct paths, including four closeout docs; no unrelated cleanup or dependency upgrade. Functional6, migration1, test/tool/config11, Docs4:

- Functional4 correction: src/app/api/admin/makeup/route.ts; src/app/api/coach/attendance/route.ts; src/lib/attendance-write-through.ts; src/lib/attendance-write-errors.ts.
- Functional2 protected released baseline: src/app/(admin)/admin/finance/page.tsx; src/lib/admin-finance-read.ts — exact d4aff85 bytes, financial formulas unchanged.
- Migration1: supabase/migrations/20260929082617_lesson_source_attendance_lock_scope_v2.sql, SHA256 4184286af1c106922dfa6b70b56e78daee83d2019ecd31988f1994f7aedc4bd6.
- Test/tool/config11: scripts/check-admin-finance-read.mjs; scripts/check-admin-finance-isolated.cjs; scripts/check-admin-retrospective-assignment-integrity.mjs; scripts/verify-lesson-source-test-target.mjs; scripts/check-lesson-source-test-target.mjs; tests/booking-regression/local-supabase.ts; tests/task10-regression/local-supabase.ts; tests/task10-regression/task10-transactions.spec.ts; tests/lesson-source-admission/lesson-source-acceptance.spec.ts; playwright.lesson-source.config.ts; vercel.json.
- Docs4: PROJECT_STATE.md; TODO-CODEX.md; DEVELOPMENT_TODO.md; docs/lesson-source-admission-v2-20260930.md. Pre-existing draft history is preserved in these documents; AGENTS.md remains unchanged and unstaged.

The existing committed Set1 allowlist also contains src/app/api/lesson-wallet/route.ts, src/app/api/reschedule/route.ts, src/lib/lesson-source-transition.ts and src/types/database.ts; these four were not edited in this resume round. Frozen published migrations20260928171257 and20260928171258 retain SHA256 c55154c994266c558e033f988baa0f40673988cc5c69dc4f00e475b4f3445e6a and b705b866b63aa88a4dbf91bc81b94989ee3aaee4cc98a9b4542dbeee6b9ac98b respectively.

Two already-committed Set1 test baselines differ from current Production but were not edited this round: scripts/check-lesson-wallet-regression.mjs and tests/booking-regression/booking.spec.ts. The Finance release report remains preserved in the Finance worktree; the divergent Set1 branch does not contain that report. No deletion/merge/deployment of that history occurred; a future release must retain current Finance Source and release history.

The sole added direct dependency is vercel.json, prereasoned above before editing: git.deploymentEnabled disables only codex/lesson-source-atomic. Framework/install/build/region and all other branches match the released configuration. Scoped Git pushes cannot authorize hosted Preview deployment; no live Vercel settings write was made.

### Verification and retained failures

| Check | Verified result / limit |
| --- | --- |
| Final exact-artifact runtime/UI |76/76, retries0, skipped0, unexpected0, flaky0; final-production-1790783401927. Source/protected60 then acceptance16; same compiled artifact used for all runtime checks. |
| Actual mixed concurrency |1/2/5/10 independent-family requests; same Family source1/2/5/10; same parent distinct-source1/2/5/10; shared/opposite slots. Exact DB side effects, replay and typed conflicts asserted. Intentional barriers mean timings are not an SLO benchmark. |
| Source/protected regression |OLD+NEW/multirow, response-lost replay, rollback fault injection, commit/error phase, quota/cutoff/month/identity/coach check-in/auth/direct bypass/fence/compatible rollback; Family Wallet and Task10 source/Kids Wallet concurrent protections included. |
| Retrospective |38/38 actual RPC/API cases; relevant Source blobs match final SHA. |
| Fresh / upgrade |Fresh45 equals upgrade42->44->45; seeded history and idempotent replay preserved. Corrective44->45 ACL/RLS/policies unchanged. |
| Target guards |14 checks, including valid owned target and13 rejected identities/outputs; missing manifest runner rejected before mutation. Container identities, physical DB/volume/network/labels and Auth/REST/Storage ports checked; controlled reset DB-ID rebinding recorded. |
| Static/protected tools |Wallet45; assignment39; Finance helper17; TypeScript, lint, mojibake, Production build and scoped staged-diff review passed. |
| Finance |690 progressive bills hydrated uniquely; monthly/year/net compared with SQL; UI switching/reload passed. Existing financial formulas and released Finance bytes preserved. |
| Post-test DB |45 migrations; definitions4f78db1e6c4cb476ce683f4d1176787a; ACL7c72e74879d1df1721f880d603257140; RLS ea07204b3de6190aff08df69dd05713c; policies8358e004ae22ed8413027d7f8a6cf115;0idle transactions and0fault functions. |

Preliminary failed evidence remains intact: dedicated-Coach fixture overlap; legacy race assertions that did not recognize valid same-request replay; guarded Task10 payment fixture registration in the first final run. Corrections changed fixture construction/conditional expectations, not business guards. The last fixture correction is f6dc2c4, with task10.payment_write authorization only inside the disposable owner fixture transaction. Finance history fixtures temporarily stage and restore the complete activation row within that same isolated transaction and assert exact restoration before commit. Two Windows tar packaging failures preceded compilation and were replaced by exact Git-blob copying; no Source change resulted. Earlier29Sep wrong-target/output overwrite remains historical disclosed failure, not fixed retroactively. Intentional injected errors and local service-start read retries are retained, so no blanket zero-error-log claim is made.

### Source, artifact and Owner handoff

Application/test SHA: **f6dc2c4d0da6b0ea930b335b7a24ebc4890b45da** (remote verified). Source commits b50cca00206957e0750ae983613bd2bb331c3d39 and f6dc2c4. Final tree0c320ca61ac9347bddae397c6445f2314c984e54; BuildID **OivHfQVq4WVKnWXD3GZyF**; compiled-output SHA256 **aacb51b5c10d4a1878ed45eb9a8ae8925d1ac712b048271f8b8a35d1a4eb6d52**.512tracked inputs and721compiled outputs verified before/after build and before starting UAT; no Production env or Production Supabase hostname in the compiled artifact. Docs-only publication is a successor commit and does not alter/rebuild this artifact.

Local artifact directory: C:/Users/aacha/AppData/Local/Temp/lesson-source-resume-20260930/artifact-0c320ca61ac9-1790783143394. Local review URL: http://admission.localhost:3131/auth/login. Fresh project LessonSourceResume20260930/API64601/DB64602; separate upgrade project LessonSourceUpgrade20260930/API64701/DB64702. Both were newly owned this round; no default database, older Set1 target or previous Owner UAT target was selected.

Private **OWNER-UAT.md** in the evidence root contains the synthetic User/Super Admin/Coach credentials and six steps: Reschedule; whole-Family Store/Redeem; Admin Return/Makeup; two-session same-source contention before Store; exact Attendance; Finance month/year/reload. Expected one unit/effect, preserved exact participants, replay/conflict without residue and unchanged financial snapshot. Credentials are outside Git. Owner reports PASS/FAIL, then Developer reconciles actual fixture IDs, DB effects and financial hash; screenshots alone do not substitute that reconciliation.

Final local Finance snapshot after preparing Owner fixtures: Sep2026 revenue/net **364000THB**; year2026 revenue/net **373500THB**; costs0. These are synthetic amounts, not the prior Production Finance snapshot. The handoff expected Sep Return expiry **30Sep2026 23:59:59.999 Bangkok** under policy; this was not an observed DB expiry. Subsequent Dev UAT found actual1Oct13:59:59.999,14hours late. If review crosses month-end, create new synthetic fixtures in this same owned disposable with the same artifact; never extend existing expiry or revive old credits.

### Production boundary, preservation and next gate

Read-only Production evidence confirms Finance artifact dpl_7XeXzXzHq8DYQewxSWqnv5oqfkiu / d4aff85b5cdff468a101464106b5b323c97a26c6 remains the target. Production catalog42migrations (max20260927090306), Set1 source transition absent; Task10 controls hash ea014b52788c907aa3c93ac49651dca0 and cron hash f40a5b0e064c679b03da4ac1dcacb765 match start. No real-customer transactions or Production writes were made; normal traffic prevents an unsupported global unchanged-data claim.

Nine protected main/Finance/admission-AGENTS file hashes match Gate0. Main pending Docs3/AGENTS and Finance worktree remain intact; pre-existing admission AGENTS stays unstaged. Drafts, old tests, failures and previous disposable databases are retained. No reset/stash/checkout/overwrite/cleanup of user work occurred.

Next: **Owner local UAT -> Developer exact DB reconciliation -> separately approved Production Scope Contract.** Writer fence/drain, exact compatible staged Production artifact, backup/PITR/restore time/downtime and rollback readiness remain unproved and were not performed. No automatic Task2, hosted deployment, Promotion, schema downgrade or Production restore. This local artifact must not be Promoted as a Vercel artifact.

### Evidence index (private local files, no credentials published)

Evidence root: C:/Users/aacha/AppData/Local/Temp/lesson-source-resume-20260930.

- approved-scope.md; gate0.json; initial-worktree.patch; docs-before-closeout.json: authorization and preserved-work checkpoint.
- source-final-staged.diff/stat/compliance; sql-review-1790781430006: staged scope and business-body comparison.
- outputs/fresh/final-production-1790783401927/report.json, run.log, exit.json and artifacts: final76runtime/UI cases and attachments.
- closeout-evidence.json; OWNER-UAT.md; owner-uat-server.json/log: DB signatures, workload effects, Finance and private handoff.
- candidate-build-1790783143394.json; source-build-binding-f6dc2c4d0da6b0ea930b335b7a24ebc4890b45da.json; candidate-1790783143394-{build,typescript,lint,mojibake}.log: exact artifact and build checks.
- production-readonly-schema-end.json; project-after-source-push.private.json; deployments-after-source-push-v2.private.json: Production read-only and branch push checks. Complete project JSON is private because it may include sensitive fields.

The closeout records12states separately: policy unchanged; Source changed; commit/push yes; local artifact yes; Owner UAT pending; Promotion no; post-Promotion checks n/a/local health passed; Production controls/allowlist unchanged; Production writes/data repair no; no customer change; limitations above; next local Owner review. Documentation-only successor Git identity and last health/Production readbacks are saved in the private closeout publication record.


## Dev-assisted UAT — 2026-09-30 — HARD STOP

Owner authorized Developer UAT with step-by-step screenshots on the exact existing local artifact. All6steps executed:1Reschedule PASS (Oct12, retained Oct5 overlap correctly rejected);2Family Store/Redeem PASS3members/1credit;3Return/Makeup FAIL overall — atomic unit and Makeup PASS, Return expiry FAIL;4two-tab same-source PASS1effect;5separate-authenticated-origin independent Attendance/Family Redeem PASS;6Finance month/year/reload PASS. Dev UAT5PASS/1FAIL, manual Owner UAT pending; NOT READY / TASK DONE No.

Confirmed returned credit d3a78da4-0b8b-4c19-bc85-79d3e36f4954 stores2026-10-01T06:59:59.999Z (Bangkok1Oct13:59) instead of2026-09-30T16:59:59.999Z (30Sep23:59),14hours late. Read-only SQL proves implicit date_trunc(date) resolves timestamptz, AT TIME ZONE returns timestamp, assignment recasts under UTC. Expression present in published Set1 v1 line163 and corrective v2 line142. Explicit timestamp input produces expected policy expiry. Released d4aff85's old getMonthEndIso uses +07:00; Set1 not Production active, so no Production-incident inference. Prior handoff expiry was an expectation incorrectly presented as observed; documentation drift corrected, old handoff retained as historical.

No Source/test/config/migration edit or rebuild. f6dc2c4d0da6b0ea930b335b7a24ebc4890b45da / BuildID OivHfQVq4WVKnWXD3GZyF / hash aacb51b5c10d4a1878ed45eb9a8ae8925d1ac712b048271f8b8a35d1a4eb6d52 unchanged;512inputs/721outputs verified. Previous76runtime/UI and38retrospective PASS remain coverage-scoped; missing independent expected Return-expiry check does not excuse new FAIL. UAT business writes only through UI in physically guarded LessonSourceResume20260930/API64601/DB64602; SQL read-only. Fixtures consumed, no reset/delete/expiry extension/data repair.

Backend assertions: exact source/descendant/child mapping,1targetslot/Family, member redeemed references, one-effect Store, source absent retained for Makeup, exact present Attendance and completed session;4canonical targetslots/8descendants each1active exact template. Final selected fixtures7source operations (preexisting1+new6),3credits,2attendance. All checkpoints financialHash6d821e54f20d15707cd5cbc60d2de5f3 unchanged (whole bookings/payments/progressive allocations/expenses/payroll/coupon usage); exact booking rows/controls unchanged;45migrations, definition/ACL/RLS/policy signatures unchanged,0idle transactions. UI+SQL FinanceSep364000/year373500/Oct9500 costs0 synthetic values. Two User tabs share auth profile; independent SA/User origins separate sessions. Concurrent UI dispatch is bounded evidence, not precise DB lock overlap; previous barrier1/2/5/10 remains separately retained.

Evidence C:/Users/aacha/AppData/Local/Temp/lesson-source-resume-20260930/dev-uat-20260930-1625: DEV-UAT.md with original images, reconciliation.json, expiry-finance-audit.json, canonical-targets.json, before/after/final snapshots, UI race timing, protected/doc-diff/publication records. Initial read-only snapshot failed nonexistent member.id before mutations and was corrected; early operations projection omitted Redeem credit unit IDs, final includes all7. Original failed evidence retained; no business rewrite.

Docs4 only: PROJECT_STATE.md, TODO-CODEX.md, DEVELOPMENT_TODO.md, docs/lesson-source-admission-v2-20260930.md. Nine protected main/Finance/AGENTS hashes retained, existing AGENTS unstaged. Git/source/push, localartifact, DevUATFAIL, OwnerUATpending, Productiondeployment/enablement/allowlist/PromotionNo, datarepairNo, controlschangedNo kept separate. No hosted deployment/Production migration/write/env/permission/controls/cron/allowlist/Promotion or Task2. Local services retained; no Production query this UAT round.

Hard Stop: Material Root Cause change/protected expiry boundary. Recommend separately approved forward-only expiry correction via new migration (never rewrite published v1/v2), independent UTC/Bangkok month-end/leap/December tests, protected regression and new artifact/retest; no historical-credit repair or Production authority inferred. Remaining Production fence/drain/backup/rollback unknown as before.


## Return expiry correction — 2026-10-01 — HARD STOP

Owner approved **Return expiry correction only**. First Adult/Private Admin Return now ends at the source lesson month's last instant, 23:59:59.999 Asia/Bangkok, independent of database session timezone. Existing/redeemed credits retain stored expiry/evidence; Kids delegation is unchanged. No historical-credit repair, bill rewrite, pricing/formula/role change, Task2 or Production operation.

New migration replaces the existing shared function with **one body difference**: the first non-Kids Return month-end input changes from date_trunc('month',s.date) to date_trunc('month',s.date::timestamp). Published v1/guards/v2 are byte-frozen. No DML, grant, policy, role or table change in the migration. Application/frontend/API/config edits0. Scope9paths: migration1, test/tool4, Docs4. Exact allowlist:

- supabase/migrations/20261001014950_lesson_source_return_expiry_bangkok_v3.sql
- tests/lesson-source-admission/lesson-source-acceptance.spec.ts
- scripts/verify-lesson-source-test-target.mjs
- scripts/check-lesson-source-test-target.mjs
- tests/task10-regression/task10-transactions.spec.ts
- PROJECT_STATE.md
- TODO-CODEX.md
- DEVELOPMENT_TODO.md
- docs/lesson-source-admission-v2-20260930.md

Three direct technical dependencies were recorded before editing under AGENTS.md: the two physical-target guards needed the exact independently owned Oct1 fresh/upgrade pair (64801/64901) rather than reusing Sep30 targets; the existing shared regression fixture needed a valid current-month past source because yesterday on Oct1 is Sep30 and legitimately expired after the fix. All business assertions retained; no generic localhost widening or new business behavior. Actual fresh46 and upgrade45->46 preserve history, existing wrong historical credit expiry, replay results, ACL, RLS and policies. No old target reset/deletion; only new owned disposables used for synthetic writes.

**Source committed/pushed and remote verified 8ba61517e7c97c638a8d76bfa2cf3e22d56b310f.** Exact local Production-mode artifact tree cc0c2430272353d7b8bf2ca1c77748557a104abb, BuildID scXuhPxo4AuTkVots9MMN, compiled SHA256 5e8f9df656d0d456307f0146af7d3f3d784afcc025e7a2adee512edb8c6419eb; 513 tracked inputs/721 compiled outputs verified after UI UAT. Artifact C:/Users/aacha/AppData/Local/Temp/lesson-source-return-expiry-20261001/artifact-cc0c24302723-1790821200154. This is a local artifact, not a Vercel release. A documentation-only closeout successor does not rebuild or alter tested application/migration Source.

Technical checks passed: before-fix actual API assertion reproduced +14hours; after-fix calendar oracle covers 28/29/30/31days, leap year and December across UTC/Bangkok/Los Angeles/Auckland, 48 installed RPC cases; new Adult and whole-Family API Return, replay, inherited existing expiry/evidence and exact expiry boundary rejection. Final exact-artifact runtime/UI81/81 (60 protected+21 admission; retries/skips/flaky0), independently guarded retrospective38/38, Wallet45, assignment39, Finance helper17, target guard23 (3valid+20reject), TypeScript, lint, mojibake and Production build passed. Fresh/upgrade parity and original data/ACL/RLS signatures preserved. Local security advisor:7pre-existing warnings,0affected function findings; no unrelated corrections. These checks do **not** override the subsequent Dev integration failure.

**Dev six-step UAT executed; final result3PASS/3FAIL, NOT READY FOR OWNER UAT, TASK DONE No.** Step1 Reschedule and step2 whole-Family Store/Redeem initially produced correct targets/identities, then their final status failed after step3 Makeup. Step3 Return expiry PASS for new Adult1member and Family3members, both stored2026-10-31T16:59:59.999Z / Bangkok31Oct23:59:59.999. Makeup created its exact Nov4 target, but failed the protected non-interference check. Steps4 same-source two-tab one effect,5 independent Attendance/Family Redeem,6 Finance month/year/reload passed their exact backend checks. Original filenames containing pass record intermediate observations only; final failure images and reconciliation supersede them.

New blocker attributed from source plus before/after DB: at the Makeup transaction timestamp 2026-10-01T09:45:02.195436+07:00, future rescheduled session fb7a5659-cc8f-427f-a69b-92ac272faa61 (Oct12) and redeemed self session e3ebc17e-bcd1-4586-8f4f-e608bfaa3756 (Oct7) became absent, with no exact Attendance rows. Existing non-Kids Makeup gathers the learner's whole source-month session set and updates every scheduled member to absent; two Family children stayed scheduled. The statement is identical in published v1/v2 and v3 (v2 line223/v3 line225); one-cast comparison proves expiry correction did not introduce it. This is an inherited behavior exposed by the integrated current-month fixture, not a new expiry root cause or proven Production incident. No status/data repair or Makeup change made. Required six-step integration gate fails regardless of81/38 earlier passes. Per AGENTS.md, materially changed root cause/protected-flow scope requires Hard Stop and a new Owner scope.

Reconciled unit/source/descendant/child mapping, one credit/effect, member references, exact present/absent Attendance, canonical4active target slots/8descendants, controls unchanged, migrations46, fault functions0, idle transactions0. Whole bookings/payments/progressive allocations/expenses/payroll/coupon-usage financialHash fcb2fe294359cf9aff904d3e56d55a38 unchanged at every Dev checkpoint; selected booking rows unchanged. SQL and UI October revenue/net374500, annual377000, November2500THB, costs0: synthetic values only. No new Owner fixtures prepared after Hard Stop. UI dispatch timing does not prove precise lock overlap; deterministic barriers remain separate evidence. Admin retrospective fixtures intentionally lack real selfie/GPS and still show evidence-followup; existing legacy-coach overlap warnings were not suppressed. Free exact-group coach selected for the independent round.

Evidence root C:/Users/aacha/AppData/Local/Temp/lesson-source-return-expiry-20261001: upgrade-proof.json; fresh-upgrade-parity.json; source-publication.json; end-artifact-integrity.json; finance-source-preservation.json; security-summary.json; outputs/fresh/final-production-v2-1790821319590/report.json; outputs/upgrade/retrospective-1790820926323; dev-uat/DEV-UAT.md with all original images; reconciliation.json (FAIL); makeup-status-attribution.json; expiry-finance-audit.json; canonical-targets.json; before/after/final snapshots. Preserve before-fix failure, first final-production48pass/12fail/21skip (invalid Sep30 positive fixtures on Oct1), focused expiry passes and all old evidence. Private reconciliation helper first matched an audit JSON as a snapshot, then the real status assertion failed; corrected file selection and a separate collector retained explicit status failures, never weakened PASS requirements. Read-only coach helper first queried a nonexistent enum value; fixed cast, no mutation. Local auth refresh-token400 from stale pre-reset browser cookies is retained, so no all-error-logs-zero claim.

Preservation:9main/Finance/AGENTS file hashes unchanged; published3migrations frozen; pre-existing worktree AGENTS remains unstaged. Released Finance4files equal d4aff85; all app src and branch-only deploy guard unchanged. Historical old disposables/drafts/failures retained. Branch codex/lesson-source-atomic auto-deploy remains disabled. Finance's last release record is dpl_7XeXzXzHq8DYQewxSWqnv5oqfkiu / d4aff85b5cdff468a101464106b5b323c97a26c6, not re-queried this round.

Closeout12states: Owner policy unchanged; expiry Source changed; Source commit/push verified and Docs4-only successor publication recorded privately; new exact local artifact yes; Owner UAT not started/pending and gate blocked; Promotion no; post-Promotion health/log checks n/a; Production controls/environment/allowlist/permissions/cron changes0; Production schema/data changes0, Data repairedNo; real users/financial impact0 from this task; new Makeup blocker above with unchanged Production rollout fence/backup/restore unknowns; next action is Owner review of a new **exact-source-only non-Kids Makeup status correction** plan, preserving monthly quota, identity, pricing/Finance and history, then a new artifact plus six-step retest. No automatic new fix, repair, Production rollout or Task2. Local3131/64801 services retained for read-only evidence review; no shutdown action in this round.


## Characterization before correction — 2026-10-01

Owner approved the planned proofs only. PROJECT_STATE.md owns the current matrix. Final6characterization tests completed (not business acceptance PASS): A1twofuture-rowstatuschanges; B1/B2fouractualheld-locklate-successcases Adult/Family; B3Auckland earlyMakeupdeadline in12controlledclock/timezonecases. No business correction implemented. Test1+Docs4 local/uncommitted/unpushed; app/API/migration/config0. Source/oldartifact retained; priorDev3PASS/3FAIL still blocks READY.

All old rows in17tables and function/ACL/migration46definitions unchanged; physicalguarded64801 only; new synthetic setup adds8000THB in16payments. Current local SQL Oct382500/year385000/Nov2500 synthetic, not an unchanged global financial snapshot or new UI PASS. Probeeffects rollback and per-probefinancialhashes unchanged. TypeScript/diffchecks pass; old81/38 not rerun. Failed no-test harness and3RPCfield errors retained before final completion. No Production access/write/repair/deploy/Promote/controls operation.

Proposed exact6paths: new supabase/migrations/20261001054857_lesson_source_makeup_clock_boundary_v4.sql, tests/lesson-source-admission/lesson-source-acceptance.spec.ts, PROJECT_STATE.md, TODO-CODEX.md, DEVELOPMENT_TODO.md, this report. Migration is only an empty CLI-created private proposal, not repo/apply. Fourchanges inside1existingfunction: exactMakeupsourcewrite; Adult/Privatepost-delegatecurrent-clockStore48h andRedeemstartguards; explicitBangkokMakeupcalendarinput. Quota/Kids/Family/Return/identity/Attendance/prices/Finance/permissions/history andTask2protected. Next: oneOwnerapproval, localfresh/upgrade/protectedtests, commit/push, exactnewlocalartifact, Dev6andOwnerUAT; no Production incontract.

Full observations, preservation, timestamps, proposed allowlist/actions andOwnerUAT6: C:/Users/aacha/AppData/Local/Temp/lesson-source-return-expiry-20261001/outputs/fresh/characterization-1790833257796/RESULT-AND-MINIMAL-PLAN.md. Dated evidence: DEVELOPMENT_TODO.md#lesson-source-characterization-20261001.


## Makeup and current-clock correction — 2026-10-01 — READY FOR OWNER UAT

Owner approved the consolidated minimal contract after complete A1/B1/B2/B3 characterization. Implemented four proven changes in one existing function lesson_source_transition_v1: non-Kids Makeup writes only the requested source while preserving monthly quota evidence; Adult/Private Store checks the current DB clock after the delegate and rejects <=48h; Adult/Private Redeem checks current clock after the delegate and rejects target-start <=now; non-Kids Makeup month-end casts date explicitly to timestamp before Bangkok conversion. SQL exceptions roll back the entire atomic unit. Successful committed idempotent replays retain their original result. Established Kids delegate and inactive Kids fallback are preserved. Return expiry, original/redeemed credit evidence, identities, Family units, pricing/quota/permissions/Attendance/coach evidence/canonical slots/overlap/financial safeguards remain protected.

### Scope and publication

- Source committed/pushed and remote verified: **841b527200607832afa42c3b25b6d4241e2c66d6**, branch codex/lesson-source-atomic. Documentation-only closeout is a successor of this tested Source; it does not rebuild the artifact.
- Exact eight-path allowlist: supabase/migrations/20261001054857_lesson_source_makeup_clock_boundary_v4.sql; tests/lesson-source-admission/lesson-source-acceptance.spec.ts; scripts/verify-lesson-source-test-target.mjs; scripts/check-lesson-source-test-target.mjs; PROJECT_STATE.md; TODO-CODEX.md; DEVELOPMENT_TODO.md; docs/lesson-source-admission-v2-20260930.md. App/API/UI/config0; migration1/function1/test1/guard2/Docs4.
- Guard pair added as proven direct technical dependencies, reason recorded before editing: suites reset disposable targets, so new exact owner/run/project/API/DB bindings are required to preserve old targets. No generic localhost widening or business/environment/permission change.
- New owned targets: LessonSourceMakeup20261001 API65001/DB65002, LessonSourceMakeupUpgrade20261001 API65101/DB65102. Only these disposable targets received migrations or new synthetic fixtures. Old expiry fresh/upgrade targets, all public rows and definitions unchanged, including after Dev UAT. No repair/reset of old evidence or credits.
- Four published migrations frozen; nine protected main/Finance/AGENTS hashes unchanged. Four Finance artifact files match released d4aff85 byte-for-byte. Pre-existing unstaged AGENTS.md remains untouched and excluded from all commits. Main checkout/pending work retained; Task2 not touched. Branch deploy guard retained; no hosted deployment.

### Technical verification

- Final production-mode runtime/API/UI **91/91**, expected91, retries/skips/flaky0: final-production-1790837263525/report.json. Includes ten new acceptance tests: four exact-boundary tests with twelve -1/0/+1ms cases and committed replay; four real observed parent-lock boundary crossings with complete rollback; sequential Reschedule+Family Redeem then Makeup non-interference; four timezone x three time Makeup matrix. Existing Return independent calendar/expiry cases retained.
- Upgraded-target retrospective **38/38**, retrospective-1790837396575. Fresh47 and upgrade46->47 parity; historical data/expiry/replay, signature/owner/ACL/RLS/policies preserved. Final definitions5275b1303ab82b0f83db97c871162d56, ACL7c72e74879d1df1721f880d603257140, RLSea07204b3de6190aff08df69dd05713c, policies8358e004ae22ed8413027d7f8a6cf115. No fault functions/idle transactions at final audit.
- TypeScript/lint/mojibake/Production build passed. Target guard5valid+26reject; Wallet45; assignment39; Finance helper17 passed. Local security audit retained seven existing warnings unchanged, affected-function findings0. Preliminary cacheKey/cache_key serializer mismatch is retained and normalized field/value comparison passed; no security Source change.
- Initial migration CASE parse failure and bounded correction are retained. Final full fresh/upgrade/runtime runs own acceptance; preliminary failures never relabeled as PASS.
- Exact local Production-mode artifact: BuildID **l_QsYrb4b6sMOYCvkI3T1**, tree d6428be087697e04846bacf54eef3243c67fa2e5, compiled SHA256 **82d1010baa7c66228c8f9cb72297f5b9df5c963907f39b511cc4610f1e4d4a3b**,514inputs/721outputs verified against tested/pushed Source. No rebuild after publication or UAT. Source hash and artifact identity recorded separately from Docs-only successor.

### Dev UAT — six steps, screenshots and backend PASS

| Step | Result and exact backend evidence |
| --- | --- |
|1 Reschedule|Adult Oct5 -> Oct12 12:00-13:00; same learner, one descendant/operation; target remains scheduled after Makeup, Attendance0.|
|2 Family Store/Redeem|One credit/three exact self+children members; all move together to Oct7 12:00-13:00; all three scheduled after Makeup. Original expiry retained; no split.|
|3 Return and Makeup|Adult Return1member/Family Return3members, two active credits expiry31Oct2026 23:59:59.999 Bangkok. Exact absent Makeup source -> Nov4 12:00-13:00; quota unchanged; six protected fixture booking-session sets byte-identical before/after Makeup.|
|4 Same source|Two UI tabs dispatched the same Family Store; one persisted credit/operation/three members, no duplicate. UI dispatch does not prove precise lock overlap; deterministic DB barriers in91tests separately do.|
|5 Independent flow|Different learner present -> completed, exact Attendance1, no wallet; separate prepared Family credit redeemed together to Oct8, inherited expiry unchanged. Makeup source has its exact absent Attendance1; total Attendance2/operations8.|
|6 Finance|Read-only UI/SQL Oct380500,year383000,Nov2500THB, costs0; month/year/switch/back/reload pass. All six operations preserved entire financialHash161fc961e8a030a3d426d90243029be9 and booking/control rows. These are synthetic Dev snapshots.|

Four exact active canonical target slots/eight descendants reconciled. Coach fixture guard correctly rejected a busy regression coach; two new dedicated synthetic Dev coaches and separate new Owner coaches prepared only in the new target. No bypass, old account/permission change or adjacent Source fix. Retrospective selfie/GPS follow-up remains visible; no claim of real teaching/payroll evidence. A stale intermediate screenshot is retained but excluded from final proof selection.

### Owner handoff and remaining gate

**READY FOR OWNER UAT; manual Owner PASS PENDING; TASK DONE No.** User http://makeup.localhost:3132/dashboard/schedule; SA http://127.0.0.1:3132/admin/makeup. New unused Owner fixtures7 (valid prepared Family Store explicitly disclosed), separate synthetic User and SA account, private OWNER-UAT.md supplies credentials and six visible steps. No credential in Git. Owner fixture setup adds3500THB synthetic booking/payment data after Dev reconciliation: current Owner SQL Oct384000/year386500/Nov2500, costs0; consumed Dev units/controls remain byte-identical. Never confuse these with Dev/Production amounts or extend expiry. Family Store future fixture Oct5 must remain >48h at actual review; if it expires, prepare a new fixture under the existing guarded local test contract, never revive old credits.

State separation: policy unchanged; Source complete Yes; Pushed Yes; local staged artifact Yes; new disposable migration47 Yes; Dev UAT6/6 Yes; Owner UAT pending; Set1 hosted deployed/enabled/allowlisted/Production active No; Promotion No; post-Promotion checks n/a; controls/cron/environment/permissions/allowlists changed No; Production query/schema/data/deploy/actions0; real-user/financial impact0; historical data repair No. Next gate only Owner review on this exact local artifact, then Developer backend reconciliation. Production release requires a separately approved contract; local PASS does not authorize it.

Private evidence root: C:/Users/aacha/AppData/Local/Temp/lesson-source-makeup-clock-20261001. Key files: approved-scope.md, source-publication.json, source-build-binding-841b527200607832afa42c3b25b6d4241e2c66d6.json, end-artifact-integrity.json, upgrade-proof-final.json, fresh-upgrade-parity-final.json, security-summary.json, finance-source-preservation.json, old-targets-final.json, dev-uat/reconciliation.json, dev-uat/protected-preservation.json, dev-uat/canonical-targets.json, dev-uat/DEV-UAT.md, OWNER-UAT.md. Earlier characterization and failed Dev artifacts remain historical and unaltered.

## Historical — Owner local Dev acceptance and release preparation — 2026-10-01

State observed at this closeout: Owner said “ครับ รับรองครับผม ดำเนินการแผนต่อไปได้เลยครับ”, accepting the existing local Dev6/6 artifact after Developer clarified no duplicate six-step personal retest was required. Manual Owner UAT was not performed. The preceding local review-pending handoff is historical; acceptance applies only to local Source841b527/BuildIDl_QsYrb4b6sMOYCvkI3T1, without Source/build changes.

Read-only Production audit confirmed www.newathleteschool.com resolves to Finance release dpl_7XeXzXzHq8DYQewxSWqnv5oqfkiu/d4aff85; DB42migrations/latest20260927090306, Set1 journal/core/guards absent, all five predecessor delegate signatures/ACL present and the old all-status Family index. No schema/data/environment/control/cron/deploy/alias writes. This was dependency/release preparation, not a controlled Production business-write UAT.

Smallest proposed release composes the exact tested Set1 functional8+published migrations5 from the live base, with test/tool10/config1/Docs4. It retains Finance4bytes and the Finance report absent from the divergent branch. No copying whole branch or fixing another business flow. Current request changed Docs4 only, preserving pre-existing AGENTS and all pending work.

Required release gates remain unproved: consolidated current42->47/legacy-fingerprint rehearsal, direct-writer/mixed-version/fence/drain, actual backup/PITR/restore-time evidence and a schema-compatible recovery artifact. Current Finance deployment is identified but is not certified rollback after new guards/data. Five SQL files contain their own transaction boundaries; no false single-transaction claim. New composite SHA/staged Production artifact not yet created. Exact hosted acceptance cannot be inferred from local PASS.

The private RELEASE-PLAN.md defines actor, current/expected behavior, explicit28-path proposed allowlist, protected domains, gated execution, authorization matrix, recovery/stop rules and optional Owner read-only review. One future approval must explicitly authorize Production migration/Promotion and, if desired, Dev acceptance of the NEW hosted artifact in place of a personal retest. Existing AGENTS Scope Contract requires explicit authorization for Migration/Environment/Production-data operations; preparation does not grant it. No temporary broad outage/Task10 pause/environment change is authorized.

SourceComplete/TestsPassed/Committed/Pushed Yes for existing tested local Source; Dev local controlled synthetic-writeUAT6/6; Owner local evidence accepted; personal/manual OwnerUAT not performed; Set1 hostedDeployed/Enabled/Allowlisted/ProductionActive No; hosted/ProductionUAT not performed; Production controlled writes0; DataRepairedNo; customer/financial effect from preparationNone; TASK DONE No. Active task release proposal; next Owner approves explicit contract before execution. PROJECT_STATE.md is authoritative for mutable facts and final publication metadata.

Private evidence: C:/Users/aacha/AppData/Local/Temp/lesson-source-makeup-clock-20261001/release-plan-20261001T080046Z/RELEASE-PLAN.md; production-read-only-evidence.json; source-delta-name-status.txt; preservation.json; documentation-publication.json. Existing Dev images, reconciliation, failed attempts and old isolated targets remain intact.


## Set1 approved release HARD STOP — 2026-10-01

State observed at this closeout; PROJECT_STATE.md is authoritative for mutable facts. Owner approved the exact28-path release plan and explicitly delegated Dev acceptance of the NEW hosted artifact. No business rule changed. Published live-based composite Source **8b1ca32954e0b723d87b9763ea8b66e7d850c26f**, branch codex/lesson-source-release, app8/migrations5 exact accepted841b527; preserved Finance4/report on d4aff85 base. New target/port/branch guards are four documented technical adaptations only. Source24 committed/pushed; Docs4 closeout follows without rebuilding. Old worktrees, main pending Docs3 and unstaged AGENTS preserved.

New local exact artifact runtime91/91 (no retries/skips/flaky), retrospective38/38, TSC/lint/mojibake/Production build/protected checks/diff/514input721output integrity passed. The first retrospective attempt failed during fixture booking insertion because the preceding full suite left synthetic Task10 established. Preserved failure; reran the historical inactive-policy fixture baseline on the owned disposable and restored every activation field exactly. Active Task10 already covered by the91 suite. No product fix was made for fixture preparation.

Full live-baseline42->47 ordered migration rehearsal passed in owned LessonSourceRelease20261001/API65201/DB65202 only. Five predecessor function hashes matched Production. All65 pre-existing public-table hashes, active/expired synthetic credits and expiry retained. SQL apply elapsed3899ms is not a downtime or restore-time estimate; five files have separate transaction boundaries. Retained private fixture-harness failures and corrections; migrations/app bytes frozen.

Actual mixed-version failure: the service_role direct booking_sessions status UPDATE used by live non-Kids Reschedule succeeded before schema upgrade in a rolled-back local transaction, then failed with LESSON_SOURCE_GUARDED_WRITE after47, preserving rows. Current route Source handles that failed update with500; no old HTTP write request was sent. This proves the existing Finance artifact is unsafe to certify as compatible rollback for that path after schema upgrade. New Source91 passing does not prove old-request drain/fencing.

No existing proven fence: current proxy exempts APIs; active-firewall config read returned404; project reports skewProtectionMaxAge43200, which alone does not establish coverage for all API/direct writers. Approved plan step3 explicitly requires STOP if safe fence needs project settings, Environment or extra product files. No new WAF rule/flag/permission revocation/global advisory-lock blockage/Task10 Pause was introduced.

Read-only actual Supabase dashboard confirmed daily physical backups (latest30Sep17:34:04UTC =1Oct00:34:04Bangkok) and PITR add-on not enabled. Restore duration/full recovery and compatible hosted recovery candidate remain unproved. No restore/purchase/download of customer data; PITR is not automatically required. Initial screenshot raced the UI transition and is retained but excluded; scheduled-backups-final.png is the verified daily-backup image.

HARD STOP before hosted deployment/migrations/Promotion. Final read-only aliases4 remain dpl_7XeXzXzHq8DYQewxSWqnv5oqfkiu/d4aff85; Production DB42/latest20260927090306, no Set1 core; Task10 active revision5 and expiry cron unchanged. Task-caused Production schema/data/deploy/alias/environment/control/secret/permission operations0; data repair/customer/financial effects None. Hosted Dev acceptance/manual Owner UAT/Production controlled-write UAT not performed. SourceComplete/TestsPassed/Committed/Pushed Yes narrowly for composite local Source; release acceptance FAIL/NOT READY; hostedDeployed/Enabled/Allowlisted/ProductionActive No; TASK DONE No. Next only explicit bounded release-safety scope; no automatic task expansion.

Evidence root C:/Users/aacha/AppData/Local/Temp/lesson-source-release-20261001: RESULT-AND-NEXT-SCOPE.md, source-publication.json, source-build-binding.json, source-precommit.diff, source-precommit-review.json, upgrade-proof.json, old-writer-after-schema.stderr.log, release-gates.json, retrospective-fixture-baseline.json, retrospective-fixture-restored.json, final-post-retrospective-audit.json, final-production-readbacks.json, backup-read-only-evidence.json, scheduled-backups-final.png, pitr-not-enabled.png, closeout-publication.json. Prior accepted Dev images remain under lesson-source-makeup-clock-20261001/dev-uat; no new hosted six-step image PASS is claimed.

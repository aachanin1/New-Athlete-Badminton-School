# Set1 admission resume — 2026-09-30

**Current follow-up: Dev-assisted UAT5PASS/1FAIL; Return expiry14hours late. DEVELOPING / HARD STOP — NOT READY FOR OWNER UAT.** Historical READY handoff below is superseded; Source/build unchanged. See the final Dev UAT section.

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

# Development TODO

## Decision / Reconciliation Records

### 2026-07-23 — Admin Schedules Phase B Final Production Closeout

Status: **PASS — EXACT `icn1` ARTIFACT PRODUCTION-ACTIVE; PROTECTION-AWARE SMOKE
AND READ-ONLY PRODUCTION UAT PASSED; PHASE B DONE**.

#### Authorization and state observed at this closeout

- Owner authorized exact-artifact promotion, corrected protection-aware
  re-promotion after a conservative false-positive rollback, read-only Production
  UAT, the Performance Evidence Exception, and this documentation-only final
  closeout. This record does not authorize or perform Source/Test/config/migration
  changes, another deploy/promotion/rollback, alias changes, or Production writes.
- Exact deployment `dpl_h51j7Kk6E5FJ1ox3bVLRAL61gv4H` is `READY` in `icn1`.
  Fresh read-only inspection found all four established Production aliases mapped
  to that deployment and public health `200` with `icn1` Function routing evidence.

#### Promotion, rollback, and corrected smoke timeline

1. The exact permanent-config artifact was promoted without a rebuild.
2. Smoke automation observed `302` on protected project aliases and triggered a
   conservative rollback.
3. Review proved the `302` responses were expected Vercel Deployment Protection,
   not an application failure; correlated application 5xx/runtime errors and UAT
   business writes were `0`.
4. Owner authorized corrected deployment-protection-aware re-promotion.
5. The same exact artifact was re-promoted without a rebuild.
6. Corrected smoke and authenticated read-only Production UAT passed.
7. State observed at this closeout: rollback is not required and permanent
   `icn1` remains Production-active.

#### Production UAT and performance evidence

- Super Admin and Standard Admin passed monthly summary, month/day/Search flows,
  permission/filter behavior, stale-response protection, and desktop/mobile
  read-only checks. Verified mobile viewport was `390x844`. Relevant application
  5xx/runtime/console/hydration errors and UAT business mutations were `0`.
- After two warm-ups, five monthly observations per role produced Super Admin
  outer/server P95 `1.540/0.860 s` and Standard Admin outer/server P95
  `2.450/1.523 s`. Outer samples above `5 s` and Server samples above `3 s` were
  `0/5` for both roles.
- Owner accepted that page-internal timing was unavailable and live forced
  error/retry was not run. Prior Local error/loading/empty/stale evidence passed,
  the retry handler is present, and live retry interaction remains **Unknown / not
  explicitly proven**. The bounded outer observations are not relabeled as
  page-internal measurements.

#### Final matrix and next action

- State observed at this closeout: Source Complete **Yes — Phase B**; Tests Passed
  **Yes — prior Local evidence**; Committed/Pushed **Yes**; Deployed **Yes**;
  Permanent `icn1` Production Active **Yes**; Production UAT **Passed with
  Owner-accepted limitations**; Controlled Write UAT **No / not applicable**; Data
  Repaired **No / not applicable**; Production Data Changed by UAT/this gate
  **No**; Customer Impact **`icn1` performance remediation active**; Financial
  Impact **None**; Documentation Drift **No after this documentation push**; Task
  Done **Yes — Phase B**; Active Task **NONE**.
- Detailed final evidence:
  `docs/performance/admin-schedules-phase-b-final-production-closeout-2026-07-23.md`.
- Exact next action: await Owner selection; do not start another task
  automatically.

### 2026-07-22 — Admin Schedules Region Experiment and Permanent `icn1` Closeout

Status: **PASS — REGION EXPERIMENT PERFORMANCE GATE; PERMANENT `icn1`
CONFIGURATION COMMITTED AND PUSHED; DOCUMENTATION CLOSEOUT COMMITTED AND PUSHED;
NO PROMOTION**.

#### Authorization and state observed at this closeout

- Owner separately approved the Function-region-only unpromoted experiment,
  authenticated read-only measurement continuation, permanent repository region
  configuration plus Local validation, configuration commit/push, and this
  documentation-only closeout commit/push.
- Control `dpl_FGxnuXQ4nQ77MBgw7uBWtg64JhFF` ran in `iad1`; Treatment
  `dpl_DvJ2gVNSqmqUCcdgcoiPTwJVSYh2` ran in `icn1`. Both were `READY`, Production-
  target, unpromoted, and had zero custom/Production aliases. The four established
  Production aliases remained on `dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX`.
- Both deployments used the same Admin Schedules business Source; functional
  remediation identity was `62ac775d81aa8a702cbab744fdfb2a7ab15791b7`.
  Authentication was the only POST exception, with credentials/MFA entered by the
  Owner. No credential, session value, raw Search term, or PII was retained.

#### Region Experiment result

- Paired July monthly A/B completed `20/20` valid samples per environment after two
  excluded warm-ups per deployment. Control Browser/Server/residual P95 was
  `6.570/3.7189/2.8511 s`; Treatment was `2.640/1.5824/1.5243 s`.
- Treatment Browser P50/P95 was `2.203/2.640 s`, passing the `3.000/5.000 s`
  normal/P95 budgets. Server P95 improved approximately `57.46%`, Browser P95
  `59.82%`, and residual P95 approximately `46.55%`. Control cache hit/miss was
  `19/1`; Treatment was `10/10`, and both observed the same `1,440/586/54`
  sessions/groups/wallet counts.
- Three month-navigation cycles passed. Low-volume August Browser/Server/residual
  ranges were `0.735–0.802/0.133–0.147/0.602–0.655 s`. Selected-day combined
  P50/P95/max was `1.058/1.436/1.436 s`, with `0/15` samples over `3 s`.
- Corrected Search produced `21/21` GET `200` across Q1–Q7, with combined client
  min/P50/P95/max `1.726/1.979/2.614/3.150 s` including the fixed `0.300 s`
  debounce. All round-key counts remained `<=200`; rapid latest-query and filter
  persistence checks passed. Raw terms and PII are not recorded.
- Verified mobile `390x844`, monthly/selected-day/Search functional smoke, rapid
  stale-response protection, truncation warning, and no-overflow checks passed.
  Console/hydration/runtime errors were `0`. Standard Admin was not run because it
  was outside the continuation authorization.
- Available corrected-Search telemetry contained 21 Search-path GET `200` events;
  business POST/PUT/PATCH/DELETE, 4xx/5xx, warning/error/fatal, and PII/search-term
  marker findings were all `0`.

#### Permanent configuration and Local validation

- `vercel.json` received the only approved configuration change:
  `"regions": ["icn1"]`. JSON parse/exact assertion, Admin Schedules `24/24`,
  assignment `24/24`, Lesson Wallet `17/17`, TypeScript, ESLint with zero warnings,
  mojibake (`245` files), Production build (`91/91` pages), and diff check passed on
  the exact configuration worktree.
- Configuration commit `77db099607dd7ee8dfe265929a6720818e2015d1` was pushed
  non-force to `origin/spike/next-major-security-upgrade`. This documentation
  closeout is the subsequent commit containing this record and was also pushed
  non-force.
- Local build validation does not prove the deployed Function region. No deployment
  was created from the permanent configuration, so it is not Production-active.
  The Treatment result strongly supports regional alignment as a major Server
  improvement but does not guarantee every future deployment; Browser/RSC residual
  remains material and requires Canary remeasurement.

#### Closeout state and next action

- State observed at this closeout: Source Complete **Yes — permanent `icn1`
  configuration**; Tests Passed **Yes — Local**; Committed/Pushed **Yes —
  configuration plus documentation only**; Deployed **No new deployment**; Existing
  Region Canary **READY/unpromoted**; Permanent `icn1` Production Active **No**;
  Production UAT **No**; Controlled Write UAT **No / not applicable**; Data
  Repaired/Production Data Changed **No/No**; Customer Impact **No direct Production
  change**; Financial Impact **None**; Documentation Drift **No after this
  documentation push**; Task Done **No**; Active Task **Admin Schedules
  Performance**.
- Detailed evidence:
  `docs/performance/admin-schedules-phase-b-region-experiment-permanent-icn1-2026-07-22.md`.
- Exact next action: Owner approval required for **Permanent `icn1` Config Canary
  Deploy + Full Read-only UAT Gate; no Promotion**. This closeout does not authorize
  deployment, Production UAT, promotion, or another Parking Lot task.

### 2026-07-22 — Admin Schedules Phase B Closure Gate B1 Bottleneck Diagnosis

Status: **PASS — PHASE B CLOSURE BOTTLENECK DIAGNOSED; NO CHANGES MADE;
DOCUMENTATION-ONLY CLOSEOUT COMMITTED AND PUSHED**.

#### Authorization and state observed at this closeout

- Owner approved final read-only B1 diagnosis using existing remediation Canary
  `dpl_FGxnuXQ4nQ77MBgw7uBWtg64JhFF`, followed by this documentation-only closeout
  commit and non-force branch push. B1 did not authorize or perform Source/Test/
  configuration/migration change, deploy/redeploy, promotion, alias movement,
  Production UAT/write, data repair, region change, or performance exception.
- Canary remained `READY`, Production-target, unpromoted, with zero custom/
  Production aliases. The four established Production aliases remained on
  `dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX` before and after B1. Functional remediation
  Source remains `62ac775d81aa8a702cbab744fdfb2a7ab15791b7`.
- Documentation-only work was based on branch
  `spike/next-major-security-upgrade` starting at
  `07a8bdf3368ed1b37c316a218c1e7321c93cde89`, with actual remote equal and
  ahead/behind `0/0`. Pre-existing dirty `AGENTS.md` and
  `src/lib/schedule-slot-utils.ts` were preserved and excluded.

#### B1 measurement result

- Twenty warm July monthly samples used the intended four-call path in `18/20`;
  two branch-reference cache misses used five calls. Browser
  min/P50/P90/P95/max was `3.926/4.905/6.329/6.574/7.577 s`; Server P95 was
  `4.171 s`; Browser-residual P95 was `3.406 s`. The normal `3 s` and P95 `5 s`
  budgets failed.
- Three complete adjacent-month cycles showed low-volume August Server duration
  `0.359–0.752 s` while Browser total remained `4.600–5.029 s`. Selected-day
  combined P50/P95/max was `2.827/3.874/3.874 s`. Search client total
  P50/P95/max was `5.795/7.868/7.930 s`, including the fixed `0.300 s` debounce;
  post-debounce P50/P95/max was `5.495/7.568/7.630 s`.
- Search learner/parent/Coach/branch/course/status/Thai-one-character behavior,
  branch/course-filter retention, bounded round-key response, PII-free response
  contract, and rapid latest-query protection passed. Raw Search terms and PII
  are not recorded. Rapid day-change stale-response protection passed.
- Standard Admin is **Unknown / Need verification** because no existing session was
  available. Mobile `390x844` is **Unknown / Need verification** because browser
  control did not establish the requested document viewport reliably. No account,
  credential, permission, session, or Production data was created or changed.

#### Evidence and ranked diagnosis

- The bounded deployment window contained 899 GET and business
  POST/PUT/PATCH/DELETE `0/0/0/0`; HTTP 5xx and warning/error/fatal were all `0`.
  Vercel functions were in `iad1`. A 12-hour all-environment/deployment aggregate,
  not Canary-only, showed Active CPU P75 `210 ms` and 2.7K outbound Supabase calls
  averaging `620 ms` with errors `0%`.
- Supabase remained `ACTIVE_HEALTHY` in `ap-northeast-2`. Connection, timeout,
  deadlock, exhaustion, and lock-pressure evidence was clean. Bounded read-only
  plans completed in `0.817–31.341 ms` with shared-buffer hits and no disk/temp
  spill. `pg_stat_statements` was read without reset.
- **Proven:** call reduction works; bounded SQL is milliseconds; Active CPU is low
  relative to duration; Server duration and Browser residual both contribute;
  low-volume August retains a high Browser residual; Canary/aliases/data did not
  change.
- **Strongly Supported:** the primary Server contribution is Vercel-to-Supabase
  Data API/network wait, multiplied by remaining request waves. Browser/RSC
  residual is a separate material bottleneck.
- **Inferred:** cross-region `iad1 → ap-northeast-2` is the leading explanation for
  much of the wait, with PostgREST/RLS/JSON materialization and remaining dependent
  phases contributing. The exact residual breakdown remains uninstrumented.
- **Unknown / Need verification:** the result of a same-artifact regional A/B,
  Canary-only outbound spans, detailed PostgREST phases, selected-day/Search
  per-sample server phases, Standard Admin overhead, reliable mobile behavior, and
  the internal composition of Browser/RSC residual.

#### Decision and closeout state

- The single recommended next technical path is a separately Owner-approved
  **Infrastructure Region Experiment Gate** using the same business Source on an
  unpromoted Canary, changing only Function region, retaining a rollback plan, and
  repeating the bounded measurements without promotion. This is an experiment,
  not a proven or guaranteed fix. Browser/RSC residual may still keep the overall
  budget failing even if Server latency improves.
- Detailed methodology, raw monthly/day/Search samples, Vercel/Supabase evidence,
  limitations, root-cause classification, recommendation, and fallback are in
  `docs/performance/admin-schedules-phase-b-closure-b1-bottleneck-diagnosis-2026-07-22.md`.
- State observed at this closeout: Source Complete **Yes — prior remediation**;
  Tests Passed **Yes — prior local evidence only**; B1 Diagnosis **Complete**;
  Committed/Pushed **Yes — documentation only**; Deployed **No new deployment**;
  Performance Gate **Failed**; Production Active/UAT **No/No**; Controlled Write
  UAT **No / not applicable**; Data Repaired/Production Data Changed **No/No**;
  Customer Impact **No direct Production change**; Financial Impact **None**;
  Documentation Drift **No after this successful documentation-only push**; Task
  Done **No**; Active Task **Admin Schedules Performance**.
- Exact next action: Owner/PM decides whether to authorize the separately scoped
  Infrastructure Region Experiment Gate. It is not authorized by this closeout
  and must not start automatically.

### 2026-07-21 — Admin Schedules Remediation Canary Performance Gate Failed

Status: **STOP — CANARY PERFORMANCE GATE FAILED; NOT PROMOTED**.

#### Authorization and exact deployment identity

- State observed at this closeout: Owner approved a Production-target unpromoted
  remediation Canary plus bounded authenticated read-only performance UAT from
  branch `spike/next-major-security-upgrade` at exact input commit
  `67a08fa5a11ee714d8ec23be3fb125732e255b54`. Functional Source was
  `62ac775d81aa8a702cbab744fdfb2a7ab15791b7`.
- Deployment `dpl_FGxnuXQ4nQ77MBgw7uBWtg64JhFF` at
  `https://new-athlete-badminton-school-hm0ntpqx2-aachanin1s-projects.vercel.app`
  became `READY` on target `production`. Its exact tree was
  `ad1a35b38d19bd1b203bb8d644946ea73db3c466`.
- Vercel `gitCommitSha` metadata was `null`. Exactness was therefore established
  from the clean detached worktree and deploy input identity, not from Vercel Git
  metadata. Build duration was `81.021 s`; build region was `cle1`, function region
  `iad1`, deployment metadata region `sfo1`, runtime Node.js `24.x`, and framework
  Next.js `16.2.6`.
- Custom/Production alias count on the Canary was `0`. Automatic deployment aliases
  were not treated as promotion. The four established Production aliases remained
  on `dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX` before and after deployment/UAT. Promotion
  and rollback were **No**.

#### Infrastructure and partial functional UAT

- Infrastructure smoke passed: `/` returned `200` (`80,237` bytes, `0.235 s`),
  `/api/health` returned `200` with status `ok` (`1,782` bytes), one generated
  `_next/static/*` asset returned `200` (`529` bytes, `0.138 s`), and anonymous
  `/admin/schedules` returned the expected `307` auth redirect. No build/runtime
  5xx was observed.
- Existing Super Admin authentication worked. Monthly-summary-first, no day detail
  before selection, desktop layout without horizontal overflow, and console
  warning/error count `0` passed before the mandatory performance stop. July summary
  metrics reported sessions `1,439`, groups `586`, and wallet rows `54`.
- Month-change, selected-day, Search, mobile `390x844`, and Standard Admin checks
  were intentionally **not run**. The gate required an immediate stop after the
  warm-navigation P95 budget failed.

#### Raw performance evidence

- Initial untimed navigation used five calls and reported summary server duration
  `3.3282 s`.
- The bounded cold/reference-cache-miss sample was browser `5.889 s`, summary
  server `3.0914 s`, and five calls: two session pages + one date-scoped group page
  + one wallet call + one branch-reference miss.
- Ten warm samples, in test order:

| Sample | Browser total | Summary server | External calls |
| ---: | ---: | ---: | ---: |
| 1 | `4.365 s` | `2.5529 s` | 4 |
| 2 | `4.145 s` | `2.5762 s` | 4 |
| 3 | `3.989 s` | `2.2107 s` | 4 |
| 4 | `3.910 s` | `2.1769 s` | 4 |
| 5 | `7.907 s` | `4.3137 s` | 4 |
| 6 | `4.125 s` | `2.6932 s` | 4 |
| 7 | `5.664 s` | `3.1271 s` | 5 |
| 8 | `5.228 s` | `2.9898 s` | 4 |
| 9 | `3.969 s` | `2.1832 s` | 4 |
| 10 | `5.130 s` | `2.5651 s` | 4 |

- Nearest-rank P95 for `n=10` selects rank `ceil(0.95 * 10) = 10` after sorting,
  yielding `7.907 s`. This exceeds the mandatory `5.000 s` budget.
- Nine of ten warm samples used the intended formula `2 session pages + 1
  date-scoped group page + 1 wallet call + 0 cached branch call = 4`. Sample 7 was
  the branch-cache miss and used five calls. The worst browser and server sample was
  sample 5 on the normal four-call path.

#### No-write, logs, and repository safety

- The bounded deployment-scoped Vercel window contained `500` events, all `GET`.
  Schedule requests were `30`; schedule/business `POST/PUT/PATCH/DELETE` were
  `0/0/0/0`; 5xx/fatal/error/warn were `0/0/0/0`; email/phone/JWT/search-term
  marker matches were `0`. No business-data write occurred.
- This Canary gate did not run direct Supabase SQL or collect direct RTT/comparison
  telemetry. The previously verified Supabase region remains `ap-northeast-2`.
- The main worktree stayed on exact HEAD/upstream
  `67a08fa5a11ee714d8ec23be3fb125732e255b54`, ahead/behind `0/0`, with staged state
  empty. The detached deployment worktree remained clean. Pre-existing dirty
  `AGENTS.md` and `src/lib/schedule-slot-utils.ts` retained SHA-256
  `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E` and
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
- Source, Test, documentation, migration, environment, feature control, allowlist,
  Production data, and financial data changed by the Canary gate: **No**. This later
  closeout changes documentation only.

#### Proven findings

1. The Source remediation changed the normal warm summary from the prior eight-call
   shape to the designed four-call shape in `9/10` samples.
2. The remediation Canary still failed the warm-navigation performance gate at
   P95 `7.907 s`.
3. The worst latency occurred on the four-call path. A branch-cache miss does not
   explain that worst sample.
4. The Canary remained unpromoted; Production aliases and business data did not
   change.

#### Observed, not proven causal

- Functions ran in `iad1`; the previously verified Supabase region is
  `ap-northeast-2`. Residual region/network/runtime cost may contribute, but this
  gate collected no direct RTT or controlled regional comparison and does not claim
  the region difference as a proven root cause.

#### State observed at this closeout

| Field | Result |
| --- | --- |
| Active Task | Admin Schedules Performance |
| Source Complete | Yes — remediation committed/pushed |
| Local Tests | Passed — prior evidence |
| New Canary | `READY`, Production-target, unpromoted |
| Performance Gate | Failed — warm P95 `7.907 s` > `5.000 s` |
| Production Active | No |
| Production UAT Passed | No |
| Production Data Changed | No |
| Customer Impact | No direct Production change |
| Financial Impact | None |
| Task Done | No |
| Next Action | Owner/PM selects Source Fix, Database, Infrastructure, or explicit performance-exception scope; no option is authorized automatically |

Read-only Infrastructure Diagnosis may be considered as one recommendation, but it
is **OWNER APPROVAL REQUIRED — NOT AUTHORIZED TO START**. No Source, Database,
Infrastructure, performance-exception, promotion, or Production UAT gate starts
automatically.

### 2026-07-21 - Admin Schedules Phase B Canary Remediation Publish

Status: **PASS — COMMITTED AND PUSHED; NOT DEPLOYED**.

- State observed at this publish closeout: Owner approved the scoped Source/Test
  and documentation Commit + Push gate on existing branch
  `spike/next-major-security-upgrade`. Starting HEAD and actual remote were
  `358040d25c37398811f05611b53fc6a5f4ec099c`, staged state was empty, and
  ahead/behind was `0/0`.
- Source/Test commit `62ac775d81aa8a702cbab744fdfb2a7ab15791b7`
  (`perf(admin-schedules): reduce canary read fan-out`) contains only the five
  approved remediation Source/Test files. This documentation closeout is the
  separate scoped documentation commit. Both are pushed non-force to the existing
  branch; no PR was created.
- Mandatory publish-gate verification passed on the exact Source worktree:
  remediation `24/24`, assignment `24/24`, Lesson Wallet `17/17`, TypeScript,
  ESLint, mojibake `243`, diff check, local Production build, and disposable
  browser E2E `5/5` with fixture residue `0`. Docker Engine was available and all
  Supabase URLs used by the E2E environment were `127.0.0.1` only.
- The publish-gate E2E measured cold `1985.5 ms`; warm samples
  `1074.4/1060.8/1226.0/1170.4/1117.0 ms` with P95 `1226.0 ms`; month change
  `273.5 ms`; summary server `136.5 ms` with four calls; cold day server
  `40.4 ms` with seven calls; learner/Coach/status Search server
  `105.9/124.3/152.0 ms` with `6/7/8` bounded calls. Local evidence is not a
  Production P95 claim.
- Owner explicitly accepted skipping repeat `.next` cleanup/clean-restart for the
  exact verified worktree. `.next` was not deleted or touched by this gate, the
  repeat smoke was not run, and this record does not claim otherwise.
- Pre-existing dirty `AGENTS.md` and `src/lib/schedule-slot-utils.ts` retained
  SHA-256 `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E`
  and `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`;
  neither was edited, staged, or committed by this gate. Migration/RPC/index,
  environment/feature/allowlist, deploy, new Canary, promotion, Production
  access/UAT/write, data repair, and customer/financial change were all **No**.
- Prior Canary remained unpromoted according to the latest authorized evidence.
  Production Active **No**; Production UAT/P95 **Unknown / Need verification**;
  Task Done **No**. Next action is Owner/PM review before a separately authorized
  Canary Deploy + Performance UAT gate.

### 2026-07-21 - Admin Schedules Phase B Canary Source Remediation + Local Test

Status: **PASS — SOURCE ONLY; PASS — LOCAL TEST ONLY; UNCOMMITTED AND
UNPUSHED**.

- Owner authorized Source-only performance remediation and Local Test after the
  unpromoted Canary failed its performance gate. Starting/final Git HEAD remained
  `358040d25c37398811f05611b53fc6a5f4ec099c` on
  `spike/next-major-security-upgrade`; no commit, push, deploy, promotion,
  Production access/write, environment/feature/allowlist, Infrastructure, or
  database schema change occurred.
- Summary assignment groups now use an explicitly paginated
  `schedule_slots!inner(date)` read. The deterministic July-equivalent shape of
  1,437 sessions, 439 unique slots, 54 wallet IDs, and 576 groups changed from
  `2 + 1 + 5 = 8` warm calls to `2 + 1 + 1 = 4`; group calls no longer scale by
  100-slot chunks.
- Selected-day derives non-rescheduled/non-walleted slot-session attendance scope
  from the exact verified day sessions already loaded. The duplicate
  `booking_sessions` read is removed; warm local samples used 5–6 calls and the
  cold Level-reference path used 7 while exact child/adult Attendance, Wallet,
  Coach assignment, Level, and Teaching Program semantics remained unchanged.
- Search is authenticated, month-bounded, candidate-first, deterministic, and
  capped before detail reads. Fixed-column `ilike` queries escape literal `%`,
  `_`, and backslash without raw filter grammar; enum course names are resolved
  through a small reference read then matched by course ID. Thai one-character,
  NFC, parent, Coach, branch, course, status, filter, month-isolation, ordering,
  200-round truncation, stale/cancel, and PII-free response/log behavior passed.
- Final local checks passed: remediation `24/24`, assignment `24/24`, Lesson
  Wallet `17/17`, TypeScript, ESLint, mojibake `243`, diff check, local Production
  build, and disposable browser E2E `5/5` with fixture residue `0`. The
  high-cardinality local fixture had 250 July sessions and 207 groups; summary
  still used one group page and four total calls.
- Final local performance: cold `2359.8 ms`; five warm samples
  `2178.1/2311.7/2470.2/2745.9/2273.6 ms`, P95 `2745.9 ms`; month change
  `433.4 ms`; selected-day low/medium/high client `153.5/100.6/121.6 ms` with
  server `29.0/24.8/24.0 ms`; learner/Coach/status Search client
  `614.3/204.8/198.1 ms` with server `80.2/84.6/85.6 ms`. Document body was
  `222,466` bytes and transferred bytes `3,252,965` under the deliberately larger
  local fixture. Local latency does not prove Production P95.
- After the build, execution policy rejected the exact-path `.next` cleanup
  command before execution. No bypass was attempted; repeat clean restart/static
  smoke is not claimed. Normal final-worktree E2E still passed after the build.
- Production Active **No**; Production UAT **No**; Production P95 **Unknown / Need
  verification**; Production Data Changed **No**; Customer Impact **No direct
  Production change**; Financial Impact **None**; Task Done **No**. Next action is
  Owner/PM review and a separately approved Commit + Push gate.
- Detailed evidence:
  `docs/performance/admin-schedules-phase-b-canary-source-remediation-local-test-2026-07-21.md`.

### 2026-07-21 - Admin Schedules Phase B Canary Performance Diagnosis

Status: **PASS — READ-ONLY PERFORMANCE DIAGNOSIS; CANARY NOT PROMOTED**.

- State observed at this closeout: Production-target Canary
  `dpl_5x2vzwUxAmxNaT8HZGJeBQ32JVr4` was `READY` on exact commit
  `b0bada3d076302d24ebe3b594c03b22bf0997869`; functional Source remains
  `3d32401b13873592d5462e6776b0e847335d2d43`. Super Admin functional Canary
  UAT passed, but the performance gate failed. Warm navigation P95 was `5.344 s`,
  July summary Server duration was `2.766–3.447 s`, selected-day exceeded `3 s`
  in `3/5`, and Search was `4.654–5.937 s`.
- Canary remained unpromoted. All four Production aliases remained on
  `dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX`. The audit made no Source, Test,
  migration, index, RPC, environment, feature, allowlist, infrastructure, alias,
  Production business-data, or financial-data change.
- Actual July read-only counts were 1,437 qualifying sessions (two 1,000-row
  pages), 54 walleted session IDs (one 100-ID chunk), and 439 unique schedule-slot
  IDs (five 100-ID chunks). The observed warm summary count is therefore exactly
  `2 + 1 + 5 + 0 cached branch = 8` external calls. Search repeats the same two
  detailed pages, one wallet chunk, and five group chunks on every request.
- Vercel Admin Schedule functions were in `iad1`; Supabase was
  `ap-northeast-2`. Bounded direct SQL plans used the session date index and
  completed in `3.981–27.898 ms` with shared-buffer hits and no disk/temp spill.
  Assignment and Teaching Program Seq Scans were bounded to 1,061 and 422 rows;
  current evidence does not prove that an index is the primary fix.
- `pg_stat_statements` was already available in schema `extensions` and was read
  without reset. Connection evidence showed 25/60 connections, 14 idle
  `ClientRead`, one active, and no idle-in-transaction, timeout, deadlock, or
  connection-limit signal. Deployment-scoped Vercel logs were 100% GET with no
  5xx/fatal.
- Proven primary causes are Data API fan-out/dependent phases, full detailed-month
  Search reads, and fixed selected-day phases. Cross-region RTT, PostgREST/RLS/JSON
  overhead, cold start, and Standard Admin's extra permission round trip remain
  inferred or incompletely measured.
- Detailed evidence and separate Source-only, Database, and Infrastructure options
  are recorded in
  `docs/performance/admin-schedules-phase-b-canary-performance-diagnosis-2026-07-21.md`.
  Database options require a separate Owner-approved Migration/Database Gate;
  infrastructure options require a separate Owner-approved Infrastructure Gate.
- Task Done remained **No**. Production Active **No**; Production UAT **No**;
  Production P95 **not passed**; Production Data Changed **No**; direct customer
  and financial impact **No**. Next action is an explicit Owner choice of Source
  Fix, Database, Infrastructure, or performance-exception scope.

### 2026-07-20 - Admin Schedules Performance Phase B Source + Local Test

Status: **PASS — COMMITTED AND PUSHED; LOCAL TESTS PASSED; NOT DEPLOYED OR
PRODUCTION-VERIFIED**.

- Owner explicitly authorized Phase B Source Fix + Local Test and confirmed the
  authenticated month-wide server-side Search-on-demand contract. Search must keep
  learner, parent, Coach, branch, course, and booking-status behavior within the
  selected month. Commit, push, deploy, migration, Production access/UAT/write,
  environment, feature controls, and allowlists remained prohibited.
- State observed at this closeout: initial `/admin/schedules` is a bounded monthly
  aggregate. Selected-day detail and bounded month-wide Search are separate
  Admin-menu-authorized no-store read routes. The Client cancels and rejects stale
  day/Search responses, and the initial RSC no longer contains full-month learner,
  parent, Coach-name, Level, Program, or Attendance detail.
- Exact learner/Attendance, Wallet, and coach-assignment semantics remain on the
  existing helpers. Request Auth/Profile work is memoized. Only active branches and
  active Level definitions use a 10-minute non-PII reference cache.
- Local results: Phase B `17/17`, assignment-state `24/24`, Lesson Wallet `17/17`,
  disposable browser `5/5` with residue `0`, TypeScript, full ESLint, mojibake
  `241`, build, clean restart/static smoke, and diff check passed. Local cold/warm
  P95/day/Search were `2780.1/1039.9/230.9/463.3 ms`; summary/day/Search boundary
  calls were `4/8/3`; initial RSC/document body was `91,089` bytes and local-dev
  transferred bytes were `3,248,407`.
- Detailed implementation and measurement record:
  `docs/performance/admin-schedules-phase-b-source-local-test-2026-07-20.md`.
- The first 2026-07-21 publish attempt stopped before staging because Docker was
  unavailable. On resume, Docker and repo-local Supabase were verified on
  `127.0.0.1`; E2E passed `5/5`, residue `0`, with no Production connection. Owner
  then waived repeat `.next` cleanup/clean-restart because `.next` is an ignored
  local-generated artifact; the exact worktree had passed that smoke on 2026-07-20.
- Source/Test commit `3d32401b13873592d5462e6776b0e847335d2d43` was pushed
  non-force to `origin/spike/next-major-security-upgrade`; the documentation
  closeout is the commit containing this record. Migration **No**; Deploy **No**;
  Production UAT **No / Unknown**; Production data change **No**; customer and
  financial impact in this gate **No**. Task Done remains **No**. Next gate is
  Owner/PM review and separate Owner authorization for Deploy.

### 2026-07-19 - Admin Schedules Performance Phase A Code Review

Status: **ACTIVE TASK — PHASE A READ-ONLY CODE REVIEW COMPLETE; PHASE B NOT
AUTHORIZED**.

- Owner selected Admin Schedules Performance as the next single Active Task and
  authorized Phase A only. Confirmed decisions are `/admin/schedules` as the
  primary scope, true monthly-summary-first and selected-day detail UX, initial
  normal/P95 budget `3s/5s`, 5–15 minute Cache only for low-volatility reference
  data, separate Coach/User impact measurement, no Region move as the first fix,
  and approval one Phase at a time.
- State observed at this Phase A closeout: Source review confirms that the Client
  hides full-month detail until a day is selected, but the Server still loads all
  monthly wallet, assignment group/member, slot-session, program, Level, and
  attendance detail before render. Serial chunk loops and dependent phases match
  the observed 52–53 external calls and 15–18 second response.
- Recommended Phase B design is a bounded monthly-summary read plus an
  authenticated selected-day detail read. Current month-wide Search depends on
  preloaded learner, parent, and Coach detail; Phase A recommends authenticated
  server-side Search on demand and leaves that contract for Owner confirmation.
- Admin/Super Admin latency is supported by correlated Vercel evidence. Coach
  slowness is Owner-confirmed operational evidence. System-wide User impact remains
  Unknown / Need verification and is not included in the Source-fix scope.
- Detailed report is
  `docs/performance/admin-schedules-phase-a-code-review-2026-07-19.md`.
- Phase A changed no functional Source, Test Source, Migration Source, deployment,
  environment, feature control, allowlist, Production data, customer behavior, or
  financial data. Documentation changes are uncommitted and unpushed. Overall task
  was not done; the next gate at that Phase A closeout was Owner confirmation of
  the Search contract and separate approval for Phase B Source + Local
  verification. That gate was later granted on 2026-07-20.

### 2026-07-17 - Admin Teaching Programs Documentation Consistency Correction

Status: **DOCUMENTATION-ONLY CORRECTION — CURRENT CLOSEOUT STATE RECONCILED**.

- A fresh read-only Git audit verified branch
  `spike/next-major-security-upgrade`; local, upstream, and read-only remote HEAD
  matched before this correction, with ahead/behind `0/0`. Pre-existing unrelated
  dirty `AGENTS.md`, `src/lib/schedule-slot-utils.ts`, and `docs/performance/`
  remained excluded.
- State observed at that 2026-07-17 closeout: Admin Teaching Programs already
  recorded Functional Source
  `039ad6e03ca0cb8c8c4334c81818c570b03b9287`, Ready Production deployment
  `dpl_6QCDg6omy3ZTFCm36W8G3AH7YqNr`, Production-active behavior, and authenticated
  read-only Production UAT passed on 2026-07-15.
- Documentation Drift was limited to two current-tense lines in `TODO-CODEX.md`:
  its Session Exit Checklist still awaited deployment, and the prior Lesson Wallet
  summary said its superseded deployment remained active. The next action now
  consistently awaits Owner task selection, and the Lesson Wallet deployment
  statement is explicitly scoped to its 2026-07-15 closeout.
- The dated 2026-07-15 Teaching Programs implementation, deployment, and UAT
  history remains unchanged. This correction did not change Source, deployment,
  Production UAT, migration, environment, feature controls, allowlists, Production
  data, customer behavior, or financial state.
- State observed at that closeout remained Active Task `NONE`, Task Done `Yes`,
  Remaining Work `None`, and Next Action: await Owner selection without starting
  Admin Schedules
  Performance, Homepage LV, or any other Parking Lot task automatically.

### 2026-07-15 - Admin Teaching Programs Default Today + Deterministic Ordering

Status: **DONE — EXACT SOURCE DEPLOYED; READ-ONLY PRODUCTION UAT PASSED**.

#### Initial Source-fix round (historical state observed before Build approval)

- Owner selected `/admin/teaching-programs` as the single active task and limited
  this round to Source Fix + Local Verification. Commit, push, deploy, migration,
  Production data repair/write, and controlled write UAT were prohibited.
- Gate 0 found branch `spike/next-major-security-upgrade`; local, upstream, and
  read-only remote HEAD all matched
  `74e26ee442cdb46cce5e1579df55a55d9a97bddf`, ahead/behind `0/0`. Pre-existing
  unrelated dirty `AGENTS.md`, `src/lib/schedule-slot-utils.ts`, and
  `docs/performance/` were preserved and excluded.
- Audit proved that start/end date states were blank and filtering occurred only in
  the client. Start-only was inclusive lower-bound, end-only inclusive upper-bound,
  and both blank admitted all dates. The server supplied at most 800 programs in
  `created_at DESC`; the client filtered and paginated that inherited order without
  a slot date/time/branch sort.
- `/admin/schedules` orders rounds by date, start time, branch name, and course type,
  and its active branch query orders by name. `branches` has no `sort_order`; its
  persisted unique slug identifies แจ้งวัฒนะ as `chaengwattana`.
- Source now computes Bangkok today once on the server and uses it for both initial
  date inputs. It joins branch slug with the existing slot relation, parses real
  `HH:mm[:ss]` values, and sorts all filtered items before the unchanged 18-row
  page slice by date, time, same-time `chaengwattana` priority, Thai branch name,
  branch slug, slot id, and program id. Search/filter/review behavior is otherwise
  unchanged; `/admin/schedules`, API contract, schema, and data were not changed.
- Verification passed: deterministic date/time/branch/tie-breaker/cross-page
  fixtures, Bangkok midnight UTC-boundary fixtures, `npx tsc --noEmit`, targeted
  ESLint, full `npm run lint`, `npm run check:mojibake` (230 files), and
  `git diff --check`. Local browser smoke reached the expected login redirect with
  zero console errors, but authenticated smoke was unavailable because no signed-in
  local browser session existed. No credentials were entered and no write action
  was invoked.
- State observed at the initial Source-only closeout: local Source was complete and
  tested but remained uncommitted/unpushed/undeployed. Functional Production Source remains documented
  as `bb7bd8b8015fb3fa7f0998b5bf8a1e5220e034ae`; Production-active behavior and
  Production UAT for this fix are not claimed. Task Done remains No.

#### Build + Commit + Push closeout

- Owner subsequently authorized Gate 0, Production Build, scoped functional Source
  commit/push, and a separate documentation closeout commit/push. Deploy,
  Production UAT/write, migration, environment, feature-control, allowlist, and
  scope expansion remained prohibited.
- Fresh Gate 0 verified authenticated GitHub CLI account `aachanin1`, branch
  `spike/next-major-security-upgrade`, and matching local/upstream/read-only remote
  HEAD `74e26ee442cdb46cce5e1579df55a55d9a97bddf`, ahead/behind `0/0`. The unrelated
  dirty paths remained excluded and the staged set was initially empty.
- Reviewed Source diff retained the approved sorting/default-date contract and had
  no Review API, `/admin/schedules`, migration, server-cap, page-size, schema, or
  data change.
- Verification passed: ordering fixtures with 9 contract rows and 40 pagination
  rows at page size 18; 2 Bangkok UTC-boundary cases; `npx tsc --noEmit`; full
  `npm run lint`; mojibake 230 files; `npm run build` with 91/91 static pages; and
  `git diff --check`. The clean post-build dev restart served root and a generated
  static asset with `200`, preserved the Admin `307` login redirect, and produced
  zero dev stderr or browser console warnings/errors.
- Functional commit `039ad6e03ca0cb8c8c4334c81818c570b03b9287` contains exactly
  the three Teaching Programs Source files and is pushed to
  `origin/spike/next-major-security-upgrade`; local/upstream/read-only remote HEAD
  matched and ahead/behind was `0/0` after that push.
- State observed at this closeout: Source is committed and pushed and Build passed.
  It is not deployed or Production-active, Production UAT and controlled write UAT
  were not run, Production data did not change, and customer/financial impact is
  none. Task Done remains No; next action is Owner review before a separately
  authorized deployment round.

#### Exact Source Production deployment + read-only UAT closeout

- Owner subsequently authorized exact-source Production deployment from functional
  Source `039ad6e03ca0cb8c8c4334c81818c570b03b9287`, authenticated read-only
  Production UAT, immediate rollback to `dpl_9ijGRLyvmMa9aT3EkP5zbqxkf6at` if
  any mandatory gate failed, and a scoped documentation commit/push. Source,
  migration, environment, feature-control, allowlist, Review action, and
  Production business-data changes remained prohibited.
- Gate 0 verified branch `spike/next-major-security-upgrade`; local, upstream, and
  read-only remote HEAD `1056cff8f97a43571681721877ed6352334fc798`;
  ahead/behind `0/0`; the functional commit as an ancestor; and exactly the three
  approved Source files in that commit. Unrelated dirty `AGENTS.md`,
  `src/lib/schedule-slot-utils.ts`, and `docs/performance/` remained excluded.
  The prior Production deployment and rollback target
  `dpl_9ijGRLyvmMa9aT3EkP5zbqxkf6at` was Ready, and the pre-deploy custom/canonical
  root, health, and generated static asset checks passed.
- Deployment used a clean detached worktree at exact HEAD
  `039ad6e03ca0cb8c8c4334c81818c570b03b9287`, tree
  `1d716a275505ffbc688487f0f245920c31a5619b`. Vercel build passed 91/91 static
  pages and produced Ready deployment `dpl_6QCDg6omy3ZTFCm36W8G3AH7YqNr` at
  `new-athlete-badminton-school-6t4c92z0k-aachanin1s-projects.vercel.app`.
  All four established Production aliases were explicitly converged to that
  deployment. The public root, `/api/health`, and a generated static JavaScript
  asset returned `200`; the two protected project aliases retained their existing
  Vercel SSO behavior and were independently confirmed by `vercel inspect` to map
  to the new deployment.
- Existing authenticated Super Admin Chrome state enabled UAT without entering
  credentials. Fresh load and two reloads set both date inputs to Bangkok
  `2026-07-15`, displayed exactly five rows for that date, and produced identical
  ordering. Today ordered `13:00` before `17:00`; at `17:00`, แจ้งวัฒนะ preceded
  Rama 2 and Suvarnabhumi.
- Manual date/range UAT passed. Single-day `2026-07-14` displayed seven rows only
  for that date. Range `2026-07-14` through `2026-07-15` displayed twelve rows in
  date-then-time order; at both July 14 `15:00` and `17:00`, แจ้งวัฒนะ preceded
  other branches at the same time. Start-only retained inclusive `>=`, end-only
  retained inclusive `<=`, and clearing both fields restored all-date behavior.
- Search and status, coach, branch, and course-type filters all changed the visible
  set correctly. Pagination was exercised on all 362 rows at the unchanged page
  size 18: page 1 had 18 rows, page 2 had 18 rows, overlap was zero, and the
  boundary advanced from June 6 `09:00` to `10:00`. Selecting the June 6 `10:00`
  Ratchaphruek-Taling Chan row opened the matching coach/date/branch detail. The
  Approve and Return buttons remained present and were not clicked.
- Browser console warning/error count, hydration errors, and React #418 were zero.
  Runtime log review found only GET requests during UAT; focused queries returned
  zero POST, PUT, PATCH, DELETE, 4xx, and 5xx events. No credential entry, Review
  action, form submission, Production business-data write, data repair, migration,
  environment, feature-control, allowlist, schema, server-cap, page-size, or
  `/admin/schedules` change occurred. Rollback was not performed because every
  mandatory gate passed.
- State observed at this closeout: exact functional Source is deployed and active,
  read-only Production UAT passed, customer impact is corrected Admin display
  behavior, financial impact is none, Task Done is Yes, Active Task is NONE, and
  the next action is to await Owner selection without automatically starting a
  Parking Lot task.

### 2026-07-15 - Production Lesson Wallet Canonical Redemption Regression

Status: **DONE — SOURCE DEPLOYED; NO-WRITE AND OWNER-VERIFIED CONTROLLED WRITE
PRODUCTION UAT PASSED**.

#### Gate 0 and exact incident audit

- Owner selected this regression as the single active task and authorized one
  coordinated gated audit/fix/test/commit/push/deploy/verification/docs round.
  No migration, Production repair/test-data creation, real-customer redeem,
  pricing/payment/coupon/Ledger/Finance/payroll/attendance/SlipOK change, or
  Reschedule/Makeup redesign was authorized.
- Starting branch was `spike/next-major-security-upgrade`; local and remote HEAD
  were both `9a678b9224ea3941db0727071d2337aaf714fcd1`, ahead/behind `0/0`.
  Unrelated `AGENTS.md` and `docs/performance/` work remained excluded.
- Existing deployment `dpl_DX9gCUMG4XeWtT27cFHXJgKwbAkm` was Ready on all four
  Production aliases. Its documented exact functional source remained `4ab6a69`;
  no contrary deployment evidence or documentation drift was found.
- Vercel logs contained exactly one incident `POST /api/lesson-wallet` `400` at
  `2026-07-15T11:20:10.294Z` and the supplied response was
  `รอบเรียนที่เลือกไม่ตรงกับรอบเรียนประจำในระบบ`. The request body was not retained,
  so the historical hint ID is `Unknown / Need verification`; one click sent one
  request.
- Exact target evidence was Ramintra / Private / Sunday 2026-07-19 /
  17:00-18:00, canonical template `508d96b1-c160-4127-87e1-353577ec4990`, and
  pre-existing dated slot `fa0f0797-023d-44c1-a137-b2b253fb7539`. Rama 2 had a
  separate valid same-time template, but the visible incident branch was Ramintra.
- Two sanitized matching credits originated from Private Saturday 2026-07-25
  16:00-17:00. Both were active at the failed request and later redeemed by the
  real user to a different target. They are real-customer entitlements and cannot
  be used for controlled Production write UAT.
- Incident-window fingerprints found no credit/session/slot/assignment/
  notification/activity/payment/coupon/Ledger/Finance change. Failure occurred
  before slot resolution and mutation.

#### Root cause and Source correction

- `dayOfWeek()` used `new Date(date + 'T00:00:00+07:00').getDay()`. On a UTC host,
  Bangkok Sunday midnight is Saturday 17:00 UTC, so Vercel queried weekday `6`
  instead of Sunday `0`. Both the supplied-ID query and canonical fallback used
  that wrong predicate. Historical stale-ID fallback and no-Kids-default fixes were
  still intact.
- Commit `bb7bd8b8015fb3fa7f0998b5bf8a1e5220e034ae`, tree
  `c29de52987297e316d046faabcaee630878525dd`, is pushed. It adds host-independent
  Bangkok weekday calculation, robust exact time normalization, hint-then-canonical
  lookup by authoritative credit course, strict real-slot evidence, typed Thai
  errors, conflict-before-slot ordering, and post-CAS occupancy reconciliation.
- No migration Source changed or is required. No product UI, pricing, payment,
  coupon, Ledger, Finance, payroll, attendance, SlipOK, Reschedule, Makeup,
  capacity, or Production business-data change was made.

#### Verification observed before deployment

- `npm run test:lesson-wallet-regression`: 17/17 passed under `TZ=UTC`.
- `npm run uat:lesson-wallet`: passed on disposable local Supabase and cleaned 3
  profiles, 10 slots, 12 sessions, and 5 credits.
- Full rendered booking regression: 10/10 passed; auth/database residue `0`.
  Coverage includes the exact Ramintra Private Sunday selection, correct/stale/
  nonexistent/cross-branch/cross-course hints, time normalization, no canonical
  template, exact/overlap conflicts without slot residue, above-capacity entry,
  inactive/cancelled/past/different-month rejection, one-winner concurrent redeem,
  canonical slot persistence, no target assignment, and unchanged Payment/coupon/
  Ledger/Finance counts.
- `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `npm run build`, and
  `git diff --check` passed. After clean `.next` removal/restart, root, health, and
  a generated static asset returned `200`.
- Functional Source was deployed from a clean detached worktree pinned to
  `bb7bd8b8015fb3fa7f0998b5bf8a1e5220e034ae`, tree
  `c29de52987297e316d046faabcaee630878525dd`. No migration delta existed.
  Deployment `dpl_9ijGRLyvmMa9aT3EkP5zbqxkf6at` reached Ready, and explicit alias
  convergence placed all four Production aliases on the same artifact. Root,
  `/api/health`, and generated static assets returned `200` on every alias.
- Vercel environment-name pre/post comparison retained the same 11 expected names.
  Progressive controls, Entry, shared `SLIPOK_TEST_MODE`, server-only credentials,
  and the absent allowlist were unchanged. No 5xx appeared in post-release logs.
- Protected pre-deploy and post-no-write-UAT credit/session/template/slot/payment/
  coupon/Progressive/Finance counts and fingerprints matched. Production business-
  data change attributable to this release/UAT was zero.
- Authenticated no-write UAT opened the real User Wallet, selected Ramintra /
  Private / Sunday 2026-07-19 / 17:00-18:00, verified the selected evidence and an
  enabled confirmation action, found no capacity/full block and no console,
  hydration, or network-preflight error, and cancelled without confirming. Runtime
  logs show the Wallet GETs returning `200` and no redemption POST.
- State observed at the earlier no-write closeout: controlled write UAT had not yet
  run because the identified incident credits were real-customer entitlements and
  no Owner-controlled test credit had been proved. This checkpoint is superseded
  by the Owner's later manual Production UAT and the final record below.

#### Owner-controlled Production write UAT and final closeout

- Owner confirmed personally completing a real Production Lesson Wallet redemption
  successfully and accepted the release. Codex performed read-only reconciliation
  only; it did not redeem, store, create, repair, migrate, deploy, or change any
  Production data or control.
- Gate 0 re-verification found branch `spike/next-major-security-upgrade`; local and
  fetched remote HEAD both `091a064b9b107913dfcc286e77c4a4e6253ad921`, ahead/
  behind `0/0`. The pre-existing unrelated `AGENTS.md`, content-identical stat-dirty
  `src/lib/schedule-slot-utils.ts`, and untracked `docs/performance/` remained
  excluded. Deployment `dpl_9ijGRLyvmMa9aT3EkP5zbqxkf6at` remained Production
  `READY`; Vercel metadata independently records functional Source
  `bb7bd8b8015fb3fa7f0998b5bf8a1e5220e034ae`. All four Production aliases still
  point to that artifact.
- Runtime logs recorded two successful `POST /api/lesson-wallet` calls at
  `13:29:23Z` and `13:30:14Z`. Database activity evidence safely distinguishes
  exactly one `redeem_lesson_wallet_credit` at `13:29:31Z` and a later separate
  `store_lesson_wallet_credit` at `13:30:19Z` for the same sanitized account. The
  latter stored the newly redeemed target back into the Wallet and is not a second
  redemption. Both were Owner actions; Codex replayed neither.
- The redemption changed exactly one credit to `redeemed`, created exactly one
  target session, retained the credit/session booking relationship, and linked the
  target to the real open canonical slot and active recurring template for
  Ramintra / Private / Sunday 2026-07-19 / 17:00-18:00. The later store changed
  that target to `walleted` and created one correctly linked active credit; no
  orphan remained.
- Active exact duplicate/overlap count was `0`. One matching walleted session
  created on 2026-07-05 pre-existed the UAT, is non-active under the Wallet
  contract, and has its own active credit; the UAT did not create it. Target orphan
  count, assignment-student rows, and active overlapping-session count were `0`.
- Across the complete Owner action window, newly created related Payment rows,
  coupon usages, payment-Ledger allocations, Progressive allocations, Progressive
  batch members, Finance expenses, and Bookings were each `0`. Financial impact is
  none; data repair is none. Production business data changed only through the
  normal Owner redemption and subsequent Wallet-store actions.
- The former controlled-write/Task-Done fields were therefore documentation drift
  after the Owner's confirmation. Final classification:
  **PASS — LESSON WALLET PRODUCTION REDEMPTION OWNER-VERIFIED; TASK DONE**.
  At that closeout, Active Task was `NONE`; the dated next action was to await
  Owner selection without starting Admin Schedules Performance or Homepage LV
  automatically.

### 2026-07-15 - Documentation Closeout Correction

Status: **DOCUMENTATION DRIFT CORRECTED; NO ACTIVE TASK SELECTED**.

- Owner approved Documentation Closeout Correction Only. Stale present-tense
  statements that treated Unlimited Slot Entry as active, requested another
  Production preflight/migration/deploy/UAT gate, or tied Homepage LV authorization
  to the now-completed Booking task were corrected or explicitly marked historical
  and superseded.
- State observed at this closeout: the Unlimited Slot Production release remains
  **DONE**; no active implementation task is selected. Admin Schedules Performance
  and Homepage LV remain
  **PARKING LOT — OWNER SELECTION REQUIRED; NOT AUTHORIZED TO START**.
- A permanent `Documentation Consistency Gate` was added to `AGENTS.md`. It assigns
  one owner for mutable facts, requires ordered context updates and a consistency
  matrix, enforces hard-stop and historical-wording rules, prevents duplicated
  current Production/Git state, and requires separate final-report state fields.
- This correction changed no Source, Test Source, Migration Source, deployment,
  environment, feature control, allowlist, SlipOK mode, Production schema/data,
  customer behavior, or financial state. It performed no Production UAT or data
  repair.
- State observed at that closeout: next action was to await Owner selection and
  not start a Parking Lot task automatically.

### 2026-07-15 - Dashboard Booking Unlimited Slot Production Release Closeout

Status: **PASS — UNLIMITED SLOT RELEASE DEPLOYED;
NO-WRITE PRODUCTION UAT PASSED; TASK DONE**.

#### Gate 0 — exact release proof

- Owner approved one coordinated release containing only the exact remote migration,
  exact tested Source deploy, authenticated no-write Production UAT, bounded
  monitoring/reconciliation, and documentation closeout. Production Booking,
  Pending Edit, Wallet, Reschedule, Makeup, Payment, data-repair, environment,
  pricing, Source/Test/Migration-source changes, and automatic rollback remained
  prohibited.
- Branch was `spike/next-major-security-upgrade`; starting local and fetched remote
  HEAD were both `c978a24e863d42e1890faa94c7a1eaa90a144568`, ahead/behind
  `0/0`. Exact release Source was
  `4ab6a69e23de6f7989b51dfaf624ff631dde420f`, tree
  `397618a391f968ec1135084978ce3589a43f1d89`.
- The committed migration blob
  `20260715060541_unlimited_normal_slot_entry.sql` matched SHA-256
  `130E1F7770ECB2F1D4C16CE19ED7CC8DFFD042F33D3602CCF6EC782BC0982BFD`.
  Remote history matched local through `20260713210000`; `20260715060541` was the
  sole pending migration.
- Intentionally excluded dirty work was preserved: the unrelated `AGENTS.md`
  remainder and untracked `docs/performance/`. Generated `.next`, test-result,
  Playwright-report, fixture, backup, and local environment residue were absent.
- Starting Production deployment was
  `dpl_Gj3mmRs8iVAxaXEw42ngsdaxh6Q9`, Ready on all four aliases. Entry, pricing
  writes, coupon lifecycle, payment batch, and payment review were `true`; allowlist
  was absent; shared `SLIPOK_TEST_MODE=true`. No release environment value changed.

#### Gate 1 — protected baseline

- Baseline was captured at `2026-07-15T09:12:06Z` without personal output. Counts
  and MD5 fingerprints were:

| Protected set | Count | Gate 1 fingerprint |
| --- | ---: | --- |
| attendance | 1,663 | `9b3205a09c1a9ff224be68a190be140c` |
| booking sessions | 2,833 | `2359b348534ad188cda1f4db8bd6c255` |
| bookings | 526 | `eb8e143edd048185bf3da62733c55b90` |
| coupon reservations / usages | 0 / 0 | `d41d8cd98f00b204e9800998ecf8427e` / `d41d8cd98f00b204e9800998ecf8427e` |
| Finance expenses | 1 | `3049e3c7b305b34be859623eac21b858` |
| Legacy payments | 473 | `73a58aa3936780d5313e6b5966ccd621` |
| lesson-wallet credits | 61 | `7bc41470eec666042e21732264e02b83` |
| mutation receipts | 12 | `9bf536a911098f7e51197b716f565fd2` |
| notifications | 16,686 | `841f9451e6a1415af1d78922e0540d1c` |
| payment batch members / batches | 27 / 20 | `90bfc588b859002c450287da85118fdc` / `a20825a63edb87b21ea9676c7d6952b2` |
| payment Ledger | 475 | `7f0d3299c9635671a14b4e9b05bd6f96` |
| pricing scopes / snapshots | 4 / 7 | `0618acdceb0761eb9f4434a387ea223a` / `52650a9a53611bdbea46086c1dbcf891` |
| pricing tiers | 11 | `da1b6608a3f830fd936ad64eb60d94e1` |
| Progressive allocations / bookings | 2 / 7 | `6553e26f4987c6d7e709bbbf5792d47f` / `52650a9a53611bdbea46086c1dbcf891` |
| verification attempts | 2 | `39d611556e4fa5472936ed95701489fa` |

#### Gate 2 — exact remote migration

- `npx supabase db push --linked --yes` started at
  `2026-07-15T09:12:27.8745538Z` and completed successfully at
  `2026-07-15T09:12:32.3911341Z`. It applied only
  `20260715060541_unlimited_normal_slot_entry`, exactly once; no other migration or
  repair was applied.
- Immediate post-migration verification at `2026-07-15T09:13:50Z` matched every
  Gate 1 protected count/fingerprint. Release-attributable DML was `0`.
- Effective function hashes became:
  - `progressive_lock_booking_slots_v1(uuid,uuid,learner_type,uuid,uuid,jsonb,uuid,uuid[])`:
    `40dd9123d4d7f2fecd06011fe0c27958`;
  - `progressive_refresh_slot_capacity_v1(uuid[])`:
    `1849aee5282c7f0e4af3a5a6281ceed4`;
  - `progressive_pricing_writes_capability_v1()`:
    `7dbea01c93c1e29ee987d2ebd6a018d2`.
- Capability returned `ready=true`, version `2`,
  `slotEntryPolicy=unlimited_learner_v1`, and
  `legacyBaselineContract=immutable_scope_v1`. Lock/refresh remained invoker
  functions; capability remained `SECURITY DEFINER`; every function retained fixed
  `search_path=public, pg_temp` and execute grants only for `postgres` and
  `service_role`. Dependent create/update/cancel definitions, hashes, signatures,
  grants, and security mode were unchanged.

#### Gate 3 — exact Production deployment

- A first temporary `vercel link` attempt created `.env.local` and modified
  `.gitignore` only inside an isolated disposable worktree. That worktree was not
  deployed. It was removed after a second clean worktree was created; no repo Source,
  local environment, or tracked release content was changed.
- The deployed worktree was clean at exact Source/tree with no local `.env` file.
  Deployment began at `2026-07-15T09:16:23.9448235Z`; Vercel build passed install,
  Next.js compilation, TypeScript, and all 91 static pages. Deployment
  `dpl_DX9gCUMG4XeWtT27cFHXJgKwbAkm` reached Ready at
  `2026-07-15T09:17:52.134Z`, about four minutes after the migration verification
  gate and inside the approved 15-minute maximum.
- Vercel metadata records Source
  `4ab6a69e23de6f7989b51dfaf624ff631dde420f`, tree
  `397618a391f968ec1135084978ce3589a43f1d89`, and migration
  `20260715060541`. The two aliases not automatically promoted by the CLI deploy
  were explicitly assigned to the same new Ready artifact. Final inspection proved
  all four Production aliases resolve to this deployment. Root and `/api/health`
  returned `200`; unauthenticated Booking preview/create remained `401`.
- Production environment, Entry/dependencies/allowlist/SlipOK values were not
  changed. Both release worktrees were safely removed; unrelated pre-existing
  worktrees were preserved.

#### Gate 4 — authenticated no-write Production UAT

- Used only the existing Owner-controlled authenticated User session. No account,
  profile, child, booking, session, wallet credit, makeup entitlement, or payment
  batch was created or repurposed.
- A read-only aggregate query identified a future Kids Group round at Rama 2 on
  2026-07-23 17:00–19:00 with `15` active learners. No learner identities were
  read or documented. The slot rendered enabled and remained selectable. Booking
  showed no `x/6`, remaining-seat, full, or capacity-disabled state. Confirmation
  was not clicked.
- The restored browser-local Kids Group draft recalculated successfully. Available
  learner evidence showed distinct nickname/full name as
  `น้อง Test - TEST System`; self/adult and Private self-attend showed the profile
  full name once. The account contained no existing child with absent/equal
  nickname and no multi-child selection, so those unavailable Production cases rely
  on the passed rendered Local E2E suite as explicitly allowed.
- Authoritative Kids Group pricing passed in both steps:
  - `4+1`: range `2–6 ครั้ง`, rate `625`, gross/final `625`;
  - `4+4`: range `7–10 ครั้ง`, rate `500`, gross/final `2,000`.
  Step 5 stated previous `4`, new `4`, cumulative `8`, and
  `4 × 500 = 2,000`. Prior payments remained attached to earlier bookings and were
  not shown as a deduction.
- Steps 4-5 used `วิธีคิดราคาการจองครั้งนี้` and exposed none of Progressive,
  Legacy, baseline, scope, revision, ordered pricing, or true-up as required
  customer terminology. There was no fallback price flash. No existing safe coupon
  or zero-price case was available, so neither was manufactured; the passed Local
  E2E evidence remains the acceptance evidence for those branches.
- Adult Group remained one session in range `1 ครั้ง` at `600` total/average per
  session. Private self-attend remained one hour in range `1 ชั่วโมง` at `900`
  total/average per hour. Their pricing formulas and package semantics were not
  changed.
- Browser console errors `0`, hydration logs `0`, Next overlay `0`, and visible
  error dialogs `0`. No Booking create, Pending Edit save, Wallet, Reschedule,
  Makeup, Payment prepare/upload/submit, or SlipOK request was made. Controlled
  write UAT was not run; it was not authorized and was not required for closeout.

#### Gate 5 — monitoring and protected reconciliation

- Deployment monitoring from `2026-07-15T09:16:23Z` through
  `2026-07-15T09:33:15Z` sampled `52` request/log events: error/fatal `0`, 5xx `0`,
  unexpected Booking `409/500/503` `0`, capacity error `0`, capability mismatch `0`,
  dependency unavailable `0`, pricing revision/baseline fault `0`, SlipOK `0`, and
  business mutation requests `0`. Six availability and fourteen preview events
  returned `200`; duplicate middleware/serverless observations were not treated as
  separate business actions.
- Final protected counts matched Gate 1 for bookings `526`, booking sessions
  `2,833`, attendance `1,663`, scopes `4`, pricing snapshots `7`, mutation receipts
  `12`, coupon reservations/usages `0/0`, batches/members `20/27`, attempts `2`,
  allocations `2`, Legacy payments `473`, Ledger `475`, wallet `61`, tiers `11`,
  Finance expenses `1`, and Progressive bookings `7`.
- Notifications increased from `16,686` to `16,692`. Aggregate-only reconciliation
  classified all six as unrelated `reminder` notifications: four to two Head Coach
  recipients and two to one Coach recipient, created between
  `2026-07-15T09:21:01Z` and `09:46:49Z`. Booking preview/availability does not emit
  them, and the monitored UAT made no mutation request. No personal identifier or
  message content is recorded.
- Expected and observed release/UAT-attributable business-data delta is `0`;
  financial delta is `0`. The only release-attributable database change is the
  approved function/capability schema migration. No Production data repair,
  pricing-tier/formula change, historical reprice/backfill, environment change, or
  rollback occurred.

#### Closeout

- Source/Test/Migration Source changed in this release round: **NO / NO / NO**.
  Remote migration: **APPLIED EXACTLY ONCE**. Exact deploy: **READY ON ALL FOUR
  ALIASES**. Authenticated Production UAT: **PASSED — NO-WRITE**. Controlled write
  UAT: **NOT RUN — NOT AUTHORIZED**. Production business/financial data:
  **NOT CHANGED BY RELEASE/UAT**.
- Documentation closeout changes only `PROJECT_STATE.md`, `TODO-CODEX.md`, and this
  record. `AGENTS.md` and `docs/performance/` remain excluded. The task moves to
  Recently Completed; Admin Schedules Performance and Homepage LV remain parked.
  No next task starts in this round.
- Rollback was not used. Restoring old Source or old fixed-capacity DB functions
  would reintroduce the rejected policy and still requires a separate Owner
  decision. No remaining release blocker exists.

Final classification:
**PASS — UNLIMITED SLOT RELEASE DEPLOYED; NO-WRITE PRODUCTION UAT PASSED; TASK DONE**.

### 2026-07-15 - Dashboard Booking Unlimited Slot Production Release Preflight (Historical / Superseded)

Status: **PRODUCTION RELEASE PREFLIGHT COMPLETE; DOCUMENTATION ALIGNED;
MIGRATION/DEPLOY NOT STARTED**.

#### Git and release-candidate proof

- Read-only fetch confirmed branch `spike/next-major-security-upgrade` at matching
  local/remote HEAD `5328c42551a52d4b18f3d8fae9d198d42791bc75`, ahead/behind
  `0/0`. Source `4ab6a69e23de6f7989b51dfaf624ff631dde420f` and deployed
  Source `7d98b062f850a4210fae052cefddd92b994889b8` are ancestors.
- Release Source tree is `397618a391f968ec1135084978ce3589a43f1d89`.
  Production Source tree remains
  `73294ca5419582492fa558623d395c5b3801af5e` under the previously verified
  immutable deployment association.
- Committed migration
  `20260715060541_unlimited_normal_slot_entry.sql` still has SHA-256
  `130E1F7770ECB2F1D4C16CE19ED7CC8DFFD042F33D3602CCF6EC782BC0982BFD`.
- Intentionally excluded work remains the unrelated `AGENTS.md` remainder and
  `docs/performance/admin-schedules-supabase-log-analysis-2026-07-14.md`.

#### Current Production deployment and controls

- Vercel deployment `dpl_Gj3mmRs8iVAxaXEw42ngsdaxh6Q9` is `READY`, target
  `production`, source `cli`, and still serves all four aliases. Vercel exposes no
  Git SHA/ref metadata for this CLI deployment; the deployment ID is unchanged
  from the prior exact Source/tree proof.
- All four public roots returned `200`; a generated `/_next/static/*` asset returned
  `200`. Unauthenticated POST guards for Booking availability, preview, and create
  each returned `401`; no browser draft or authenticated business request was made.
- Safe boolean readback is unchanged: `PROGRESSIVE_PAYMENT_ENTRY_ENABLED=true`,
  pricing writes `true`, coupon lifecycle `true`, payment batch `true`, payment
  review `true`, and shared `SLIPOK_TEST_MODE=true`. The allowlist is absent; no
  UUID member or secret was read or printed.
- Bounded 24-hour logs for the current deployment contained capacity rejection
  `0`, Booking dependency fault `0`, Progressive RPC unavailable `0`, and SlipOK
  activity `0`. Separate observations were three `500` responses from
  `PATCH /api/admin/makeup` and one error-level `/` request that still returned
  `200`; neither matched the capacity/dependency/RPC/SlipOK searches and neither is
  treated as proof about the Unlimited Slot target-creation path.

#### Remote migration and current DB contract

- Linked migration history matches local exactly through `20260713210000`, which
  is present once. `20260715060541` is absent remotely and is the only local-only
  migration; there is no unexpected migration before or after it. No remote DDL,
  DML, migration repair, or data read beyond aggregate/metadata evidence occurred.
- Current normalized effective function hashes (MD5 over whitespace-normalized
  `pg_get_functiondef`) are:
  - lock `progressive_lock_booking_slots_v1(uuid,uuid,learner_type,uuid,uuid,jsonb,uuid,uuid[])`:
    `b5b871c3bda83668902d5ad3bf2b512c`;
  - refresh `progressive_refresh_slot_capacity_v1(uuid[])`:
    `7d63bf278bebebad3595319428026f14`;
  - capability `progressive_pricing_writes_capability_v1()`:
    `b87e256720c9c10e5f053bacc75223b0`.
- Capability response is exactly `ready=true`, `version=2`,
  `legacyBaselineContract=immutable_scope_v1`; `slotEntryPolicy` is absent. The
  lock still contains `PROGRESSIVE_CAPACITY_EXCEEDED`, and refresh still derives a
  `full` status from active occupancy.
- The lock and refresh are invoker functions owned by `postgres`; the capability
  and dependent create/update/cancel RPCs are `SECURITY DEFINER`. Every inspected
  function has fixed `search_path=public, pg_temp` and an ACL limited to
  `postgres`/`service_role`; `PUBLIC`, `anon`, and `authenticated` have no execute
  grant. Create/update call lock and refresh; cancel calls refresh. Their signatures
  and capability version remain the Option A contract expected before the new
  migration.
- Aggregate-only evidence found `25` future non-cancelled slots above six active
  learners, none above twenty, and a maximum future active occupancy of `15`.
  This supports a later no-write visible above-six selection check without exposing
  learner or allowlist data.

#### Source/DB compatibility matrix

| State | Preview/UI | Create/edit and other entry paths | Fail-closed / customer effect | Short controlled interval |
| --- | --- | --- | --- | --- |
| Old Source `7d98b062` + old DB | Current Progressive preview works, but Booking shows occupancy/capacity and disables full slots. | Progressive create/edit can raise `PROGRESSIVE_CAPACITY_EXCEEDED`; old Wallet checks `open` and `current_students < max_students`; Reschedule and Makeup do not share that DB capacity RPC. | Existing capability passes old Source. Technically stable but violates the new Owner policy and still blocks valid customers. | Baseline only; not an acceptable final release. |
| Old Source `7d98b062` + new Unlimited DB | Old preview/UI/availability still shows and blocks capacity. | DB lock no longer rejects capacity, but old client/server availability and Wallet can still block; duplicate, template, timing, ownership, Option A and atomic guards remain. | Old Source accepts capability version `2` even with the added policy field. No integrity guard is weakened by the new DB contract. | **YES**, migration-first bridge only; customer policy remains incomplete. |
| New Source `4ab6a69` + old DB | New UI/preview removes capacity and returns authoritative tier text. | Progressive create/edit calls the capability and fails `503` because `slotEntryPolicy` is absent; Wallet/Reschedule/Makeup and Legacy paths are not protected by that same capability. | Intentional fail-closed mismatch creates a preview-then-confirm failure and inconsistent entry paths. | **NO**, including a deploy-first interval. |
| New Source `4ab6a69` + new Unlimited DB | Non-blocking occupancy, shared learner names, authoritative range and plain Thai copy. | Progressive create/edit, Wallet, Reschedule and Makeup follow unlimited entry while preserving duplicate/lifecycle/template/payment/concurrency guards. | Capability matches `unlimited_learner_v1`; expected release state. | **YES**, target state after verification. |

#### Proposed release order and bounded interval

1. Repeat Git/Vercel/Supabase/env/log baseline immediately before release.
2. Apply exactly `20260715060541`; do not include any other migration.
3. Verify remote history, all three function hashes/definitions, signatures,
   owner/security mode, grants/search path, and capability
   `slotEntryPolicy=unlimited_learner_v1`.
4. Deploy exact Source commit `4ab6a69e23de6f7989b51dfaf624ff631dde420f`
   and verify the build provenance available from Vercel.
5. Confirm every Production alias and generated static asset points to the new
   Ready deployment.
6. Run the bounded no-write UAT below, then scan errors/capability/capacity logs and
   reconcile that no business-data write occurred.
7. Close documentation only after all separately approved gates pass.

- Migration-to-deploy target is immediate; proposed hard maximum is **15 minutes**
  in one staffed release window. Do not apply the migration unless the exact Source
  artifact and deploy operator are ready. If deployment cannot become Ready inside
  that window, stop further actions and escalate; do not deploy new Source first.
- Stop on migration/history/hash/signature/grant/capability mismatch, alias or static
  asset mismatch, build/runtime error, new dependency/RPC fault, unexpected
  business write, or any evidence that duplicate/template/timing/pricing/payment/
  accounting guards changed.

#### Rollback and failure limits

- A Source alias rollback is technically possible, and old Source can operate
  briefly against the new DB, but it restores old capacity UI/availability and
  Wallet blocking. It is therefore not an automatic policy-compliant rollback.
- Restoring old DB helper definitions restores the fixed capacity ceiling and makes
  new Source fail closed. It requires explicit Owner approval and must never be
  treated as a routine rollback or run independently of Source compatibility.
- If migration verification passes but deploy fails, leave the new DB contract in
  place, keep old Source only for the bounded bridge, and retry the exact deployment
  or forward-fix. Prefer forward repair over restoring the rejected DB policy.
- If deploy is healthy but no-write UAT fails, stop confirmation/UAT actions and
  forward-fix. Repointing to old Source or restoring old DB functions requires a
  separate Owner decision because either can restore prohibited capacity behavior.

#### Proposed no-write Production UAT

- Use only an existing Owner-controlled authenticated User state; do not create a
  customer or server-side draft. Verify no `x/6`, full, or remaining-seat state and
  confirm an existing future slot with aggregate occupancy above six remains
  selectable without confirming.
- Verify child `nickname - full name`, nickname-absent/equal/blank fallback, multiple
  children, and self/adult full-name-only rendering.
- Verify authoritative one-session, bounded, and open-ended tier copy; plain Thai
  calculation; coupon gross/discount/final and zero-price copy; no customer-visible
  Progressive, Legacy, baseline, scope, revision, ordered pricing, or true-up terms.
- Where an existing safe history/draft permits, verify `4+1` selects range `2–6` at
  `625` and `4+4` selects range `7–10` at `500`, plus restored browser-local draft
  recalculation. Adult Group and Private must remain unchanged.
- Confirm no console, hydration, or network error. Do not confirm Booking, save a
  pending edit, redeem Wallet, submit Reschedule, create Makeup, or prepare/upload/
  submit Payment. These mutation-success paths cannot be proven in Production by a
  no-write UAT; if Owner requires live mutation proof, classify it separately as
  **OWNER DECISION REQUIRED — CONTROLLED WRITE UAT**.

#### Documentation alignment and remaining gate

- Corrected present-tense claims that the release candidate was local, unstaged, or
  uncommitted. Current docs now separate pushed candidate `4ab6a69` from deployed
  Source `7d98b062` and do not name historical deployments as automatic rollback
  targets for this release.
- Source/tests/migration changed: **NO / NO / NO**. Remote migration/deploy/UAT:
  **NO / NO / NOT RUN**. Environment and Production data: **NO CHANGE / NOT
  CHANGED**. Task Done: **NO**.
- Remaining gate is Owner approval or rejection of the coordinated exact migration,
  exact deploy, and no-write Production UAT plan. No Production write is implied.

### 2026-07-15 - Dashboard Booking Unlimited Slot Entry Commit/Push Closeout (Historical / Superseded)

Status: **SOURCE COMPLETE, TESTED, COMMITTED AND PUSHED; PRODUCTION RELEASE NOT STARTED**.

- Source commit:
  `4ab6a69e23de6f7989b51dfaf624ff631dde420f`.
- Source tree:
  `397618a391f968ec1135084978ce3589a43f1d89`.
- Source message: `fix(booking): remove normal slot capacity limits`.
- Documentation closeout is the commit containing this record; its exact SHA is
  reported in the Git/final handoff because a commit cannot contain its own final
  content-addressed SHA.
- Both commits are pushed without force to
  `origin/spike/next-major-security-upgrade`; local/remote equality and ancestry are
  verified after push.
- Committed migration Source is exactly
  `supabase/migrations/20260715060541_unlimited_normal_slot_entry.sql`, SHA-256
  `130E1F7770ECB2F1D4C16CE19ED7CC8DFFD042F33D3602CCF6EC782BC0982BFD`.

#### Source commit contents

- Permanent rule: only the approved unlimited-capacity Scheduling hunk from
  `AGENTS.md`.
- Tests/scripts: `scripts/check-booking-slot-availability.mjs`,
  `scripts/check-progressive-booking-entry.js`,
  `scripts/check-unlimited-slot-entry-and-price-ux.mjs`,
  `scripts/check-unlimited-slot-entry-runtime.sql`,
  `tests/booking-regression/booking.spec.ts`, and
  `tests/booking-regression/local-supabase.ts`.
- Booking/UI/API: `src/components/dashboard/booking-client.tsx`,
  `src/app/api/bookings/availability/route.ts`,
  `src/app/api/bookings/preview/route.ts`, `src/app/api/bookings/route.ts`,
  `src/app/api/lesson-wallet/route.ts`, `src/app/api/reschedule/route.ts`, and
  `src/app/api/admin/makeup/route.ts`.
- Shared helpers/contracts: `src/lib/learner-display-name.ts`,
  `src/lib/booking-slot-availability.ts`, `src/lib/booking-pricing.ts`,
  `src/lib/pricing.ts`, `src/lib/progressive-booking-preview.ts`,
  `src/lib/progressive-booking-pricing.ts`, and
  `src/lib/progressive-booking-write.ts`.
- Additive migration: exactly
  `supabase/migrations/20260715060541_unlimited_normal_slot_entry.sql`.

#### Commit/push verification and exclusions

- Before commit: branch/local/remote provenance matched expected
  `db161d4a39c25a45932c821b7d0f0295ca8d7e2d`; functional ancestor
  `7d98b062f850a4210fae052cefddd92b994889b8` remained in ancestry; migration
  checksum matched; `git diff --check`, mojibake, focused Unlimited UX `27/27`,
  and Booking Entry `31/31` passed; secret scan passed.
- After Source commit: all 22 committed paths were inspected; context docs were
  absent; migration checksum from the committed Git blob matched; no unrelated
  source, performance work, generated output, credentials, or Production identifier
  was included.
- Documentation commit contains only `PROJECT_STATE.md`, `TODO-CODEX.md`, and
  `DEVELOPMENT_TODO.md`.
- Excluded and intentionally still dirty: the unrelated `AGENTS.md` remainder and
  `docs/performance/admin-schedules-supabase-log-analysis-2026-07-14.md`.
- Remote migration: **NO**. Deploy: **NO**. Feature/Entry: **NO CHANGE**.
  Production UAT: **NOT RUN**. Task Done: **NO**.
- Production remains on Source
  `7d98b062f850a4210fae052cefddd92b994889b8` and deployment
  `dpl_Gj3mmRs8iVAxaXEw42ngsdaxh6Q9`; Production data and financial state are
  unchanged. The next gate is fresh Production preflight and separate Owner
  approval for Remote Migration + exact Deploy + Production UAT.

### 2026-07-15 - Current-State Documentation Alignment (Historical / Superseded)

- Classification before correction:
  **DOCUMENTATION DRIFT — CURRENT STATE MUST BE CORRECTED BEFORE SOURCE FIX**.
- Read-only verification confirmed branch `spike/next-major-security-upgrade`,
  matching local/remote HEAD `db161d4a39c25a45932c821b7d0f0295ca8d7e2d`,
  functional Source `7d98b062f850a4210fae052cefddd92b994889b8`, tree
  `73294ca5419582492fa558623d395c5b3801af5e`, and Ready Production deployment
  `dpl_Gj3mmRs8iVAxaXEw42ngsdaxh6Q9`.
- Production controls remained Entry `true`, all four Progressive dependencies
  `true`, allowlist absent, and shared `SLIPOK_TEST_MODE=true`; migration
  `20260713210000` remained applied once. History Payment is DONE with Production
  UAT passed.
- Current-state documents now label `be61b68`, `dpl_2GQ4...`, `dpl_CJV...`, Entry-off
  checkpoints, pre-fix History classifications, and old rollback notes as historical
  or superseded. Unlimited Slot Entry remains the only active task; Admin Schedules
  Performance and Homepage LV remain parked.
- Functional Source/tests/migration, commit, push, deploy, environment, Production
  data, customer behavior, and financial state changed in this correction round:
  **no / no / no / no / no / no / no / no / no**.

### 2026-07-15 - Dashboard Booking Unlimited Slot Entry + Customer Price UX Source Fix (Historical / Superseded)

Status: **SOURCE COMPLETE, TESTED, COMMITTED AND PUSHED; PRODUCTION RELEASE NOT STARTED**.

#### Approved policy and implemented boundary

- Implemented the Owner-approved unlimited-learner rule for new User booking,
  pending-payment edit, User reschedule, Lesson Wallet redemption, and Admin Makeup
  target selection. Occupancy is informational and no longer decides eligibility.
- Preserved or strengthened learner date/time overlap prevention, authentication and
  ownership, active schedule-template resolution, canonical `schedule_slot_id`,
  future/not-started and cancelled-slot checks, booking/payment status, same-month
  wallet/reschedule rules, mutation idempotency, revision/baseline concurrency,
  coupon consistency, and compensating cleanup. Admin booking remains disabled.
- Pricing tiers/formulas, Option A, historical bookings/payments, Adult Group,
  Private, SlipOK, Ledger, Finance, attendance, payroll, and Head Coach grouping were
  not changed.

#### Source map and result

| File / function | Implemented result | Safety retained | Migration |
| --- | --- | --- | --- |
| `src/components/dashboard/booking-client.tsx` | Removed `x/y`, full/remaining-seat display and occupancy-based disabling; all course types fetch authoritative preview; Steps 4-5 render plain Thai selected-tier/coupon/zero-price evidence. | Draft fingerprint, stale-response guard, learner/session selection, server preview authority and final totals. | No |
| `src/lib/learner-display-name.ts` | New shared pure formatter: distinct trimmed nickname + full name, otherwise one available name; multi-learner join has no blank separator. | Does not invent profile nicknames; child and self/adult contracts remain distinct. | No |
| `src/app/api/bookings/availability/route.ts` + `src/lib/booking-slot-availability.ts` | Availability remains server-authoritative lifecycle/template/slot validation and returns non-blocking `activeOccupancy`; capacity/full/can-fit fields and requested-seat decisions are removed. | Auth/edit ownership, active template, exact date/time/end, canonical slot and cancelled-slot rejection. | No |
| `src/app/api/bookings/route.ts` + `src/lib/progressive-booking-write.ts` | Removed the obsolete capacity error contract; create/edit now fail closed unless the DB capability advertises `slotEntryPolicy=unlimited_learner_v1`. | Option A preview/revision/baseline, mutation replay, ownership, canonical slots and overlap checks. | Yes |
| `src/lib/pricing.ts`, `src/lib/booking-pricing.ts`, `src/lib/progressive-booking-pricing.ts`, `src/lib/progressive-booking-preview.ts`, `src/app/api/bookings/preview/route.ts` | Exact selected tier now crosses the server preview boundary as `{id,minSessions,maxSessions,pricePerSession,packagePrice,unit}`; one, bounded and open-ended ranges are formatted without client tier tables. | DB `pricing_tiers` authority; Legacy/Progressive/Adult/Private formulas and coupon order unchanged. | No |
| `src/app/api/reschedule/route.ts` | Remains capacity-free; duplicate guard now rejects any same-learner interval overlap rather than only exact times. | Verified/scheduled source, cutoff, same month, future active template, real slot, cleanup/log/notification behavior. | No |
| `src/app/api/lesson-wallet/route.ts` | Removed `current_students < max_students` and historical `full` blocking; cached occupancy updates are informational. | Entitlement, attendance/cutoff, same month, future template/slot, credit CAS, no-payment behavior, overlap and cancelled/lifecycle guards. | No |
| `src/app/api/admin/makeup/route.ts` | Capacity remains non-blocking; target creation now validates booking/course relationship, future active template, canonical slot and learner overlap and writes `schedule_slot_id`. | Admin authorization, absence/verified policy, next-month entitlement, audit and notifications. | No |

#### Additive migration Source

- Created exactly one new migration:
  `supabase/migrations/20260715060541_unlimited_normal_slot_entry.sql`.
- SHA-256:
  `130E1F7770ECB2F1D4C16CE19ED7CC8DFFD042F33D3602CCF6EC782BC0982BFD`.
- `CREATE OR REPLACE FUNCTION` keeps the existing signatures for
  `progressive_lock_booking_slots_v1(uuid,uuid,learner_type,uuid,uuid,jsonb,uuid,uuid[])`
  and `progressive_refresh_slot_capacity_v1(uuid[])`. The lock helper still resolves
  and locks canonical slots, rejects cancelled/invalid templates and learner time
  overlap, but no longer compares occupancy with `max_students`. Refresh still
  counts active learners into `current_students`, preserves cancelled slots, and
  normalizes touched non-cancelled slots to `open` without deriving `full`.
- `progressive_pricing_writes_capability_v1()` remains capability version `2`, keeps
  `legacyBaselineContract=immutable_scope_v1`, and adds
  `slotEntryPolicy=unlimited_learner_v1` so mismatched Source/DB fails closed.
- Fixed search paths and existing `SECURITY DEFINER` top-level create/update RPCs
  remain intact. Helper/capability execution is revoked from `PUBLIC`, `anon`, and
  `authenticated`; capability remains granted to `service_role`. There is no DML,
  table rewrite, historical backfill, tier change, or Production repair.
- Applied only through disposable local `supabase db reset`; not applied to remote or
  Production. A rollback to the previous helper definitions would restore the
  prohibited ceiling and therefore requires a coordinated Source/DB rollback, not
  a standalone function rollback.

#### Executable verification

- Full disposable migration-chain reset passed and proved capability version/policy,
  effective grants, and absence of the old capacity/full derivation in effective
  function definitions.
- `scripts/check-unlimited-slot-entry-runtime.sql` passed with transaction rollback:
  `6+1`, `20+1`, pending edit above the old ceiling, overlap against existing data,
  overlap inside one request, cancelled slot, invalid template, past/started target,
  informational occupancy, no partial write, and clean residue.
- Option A runtime rollback SQL passed cleanly; concurrent first booking produced
  exactly one winner and one `PROGRESSIVE_SCOPE_REVISION_CONFLICT` loser (`8/8`),
  one scope/receipt, the preserved baseline, correct `2,000` price, and no payment.
- Deterministic checks passed `265`; rewritten capacity tests retain `6`/`20` as
  regression triggers and now require learner `7`/`21` success rather than deleting
  the cases.
- Rendered Playwright Booking regression passed `9/9`: occupancy `6` and `20`, child
  and self name display, Reschedule `20+1`, Wallet `6+1`, Makeup above `20`, restored
  `4+4`/coupon calculation, stale preview, occupied restored draft, occupancy race,
  and actual `4+4 = 2,000` create. Disposable residue was `0`.
- `npx tsc --noEmit`, ESLint, `npm.cmd run check:mojibake`, production build, and
  post-build clean `.next` dev/E2E asset load passed. Final local checks returned
  `/ = 200`, generated `/_next/static/* = 200`, and unauthenticated Booking
  availability/preview/create APIs each `401`. Build/dev artifacts remain ignored,
  no fixture/backup residue is tracked, and the disposable stack was stopped with
  no backup volume retained.

#### Scope closeout and remaining gate

- Functional Source changed: **yes**. Commit/push: **yes**. Remote
  migration/deploy/environment/Entry/allowlist/Production read-write/UAT: **no**.
  Production data and financial state: **no change**.
- Production remains on Source
  `7d98b062f850a4210fae052cefddd92b994889b8`, deployment
  `dpl_Gj3mmRs8iVAxaXEw42ngsdaxh6Q9`, and therefore still exposes the superseded
  capacity behavior until separately approved commit/push, migration application,
  deploy, and UAT gates complete.
- Admin Schedules Performance remains
  **PARKING LOT — AUDITED; FIX NOT STARTED**; Homepage LV remains parked.
- Next Owner gate: fresh Production preflight, then approve coordinated Remote
  Migration + exact Deploy + Production UAT. Production writes remain unapproved.

### 2026-07-15 - Dashboard Booking Unlimited Slot Entry + Customer Price UX Audit (Historical / Superseded)

#### Owner decision and business reason

- Owner permanently removed fixed learner-capacity ceilings from normal teaching
  rounds. A round may contain more than `6`, `20`, or any configured count; the Head
  Coach divides learners into groups and assigns coaches after booking.
- Occupancy must not block or discourage any of five normal entry paths: new User
  booking, pending-payment booking edit, User reschedule, Lesson Wallet redemption,
  and Admin/User makeup or replacement-date target selection. Admin booking on
  behalf of users remains disabled.
- The decision addresses valid customers being blocked by `0/6`, full-slot UI, and
  `PROGRESSIVE_CAPACITY_EXCEEDED`. It does not change pricing tiers, Legacy or
  Progressive formulas, Option A, historical bookings, Adult Group, Private,
  payment, coupon, Ledger, Finance, attendance, payroll, or coach assignment rules.
- Customer learner headings must use distinct nickname plus full name, or full name
  once. Price explanations must use plain Thai and authoritative tier ranges without
  requiring Progressive, Legacy, baseline, scope, revision, ordered pricing, or
  true-up terminology.
- This round was read-only Source/DB audit plus documentation only. Functional
  Source/tests, migration Source/application, commit, push, deploy, environment,
  Entry/allowlist, Production data, booking/payment actions, and financial state did
  not change.

#### Effective Source dependency map

| File / function | Current behavior and policy conflict | Safety to preserve | Proposed future change | Migration |
| --- | --- | --- | --- | --- |
| `src/components/dashboard/booking-client.tsx` | Fetches availability, shows `x/y`/full/remaining-seat copy, disables full slots and confirmation, maps `PROGRESSIVE_CAPACITY_EXCEEDED`, and describes Kids Group as `4-6` learners. Learner names and pricing terminology vary by step. | Draft fingerprint/stale-preview protection, exact learner selection, start-time checks, authoritative preview, coupon/final totals. | Remove all customer capacity ceilings and disabling; use one learner-name formatter; render authoritative tier range and low-technical Thai explanation in Steps 4-5. | No |
| `src/app/api/bookings/availability/route.ts` + `src/lib/booking-slot-availability.ts` | Canonicalizes active templates/slots and active occupancy, then derives capacity, remaining, `full`, and `canFit`. Progressive UI treats those fields as blocking. | Authentication, edit ownership, active template/date/time/end matching, cancelled-slot detection, canonical slot id. | Keep as server-authoritative non-blocking slot validation and optional internal `activeOccupancy`; remove capacity/full/remaining/can-fit from customer decisions. | No |
| `POST/PUT src/app/api/bookings/route.ts` | Progressive create/edit maps the RPC capacity exception to HTTP `409`; Legacy create/edit has no capacity check. | Auth/ownership, learner ownership, active template and real slot resolution, future checks, price preview/revision/baseline, coupon and compensating cleanup. | Remove capacity error contract only; keep server authority. Add overlap and transaction regression coverage rather than weakening guards. | Yes for Progressive RPC |
| `src/lib/progressive-booking-write.ts` | Carries `PROGRESSIVE_CAPACITY_EXCEEDED` as a known typed RPC error; delegates atomic create/edit to DB. | Service-role boundary, mutation fingerprint/replay, expected revision and Option A baseline. | Remove obsolete capacity error mapping and require a capability contract that proves unlimited-slot policy. | Coordinated |
| `progressive_lock_booking_slots_v1(...)` | Locks canonical slot rows, prevents exact learner/date/time duplicates, then rejects when active occupancy plus requested learners exceeds `schedule_slots.max_students`. | Advisory/row locking, template/date/time/end resolution, cancelled-slot and duplicate guards. | `CREATE OR REPLACE` the same signature to remove only the capacity comparison/error. Preserve locks and safety checks; extend overlap protection separately. | Yes |
| `progressive_refresh_slot_capacity_v1(uuid[])` | Recomputes `current_students` and derives slot `status='full'` at `max_students`. | Accurate informational occupancy and cancelled status. | Keep `current_students` informational if still useful, but never derive a blocking `full` state from occupancy; cancelled remains non-entry. | Yes |
| effective `create_progressive_booking_v1(...)` / `update_progressive_pending_booking_v1(...)` | Atomic create/edit call the lock and refresh helpers, so both inherit the hard capacity ceiling. | Security-definer/service-role-only access, fixed search path, receipt idempotency, revision/baseline/pricing/coupon transaction. | Retain signatures if possible; dependency behavior changes through replaced helpers and a bumped policy capability. | Dependency only |
| Legacy create/edit in `src/app/api/bookings/route.ts` | Does not enforce capacity, but its shared slot resolver does not itself prove general overlapping-session prevention or a DB transaction. | Existing template, ownership, future, exact duplicate, price, rollback behavior. | Keep unlimited behavior; add overlap/atomicity tests and close proven safety gaps within approved Booking scope. | Unknown if later atomic RPC is chosen |
| `src/app/api/reschedule/route.ts` | Already ignores occupancy/capacity. It validates ownership, verified/scheduled source, cutoff, same month, future target, active template, real slot, and exact duplicate. Exact duplicates are blocked, but arbitrary time overlap and full DB atomicity are not proven. | All listed guards, notifications, audit and rollback cleanup. | Do not add capacity. Add overlap/idempotency/atomicity regression and hardening where evidence requires. | Unknown |
| `src/app/api/lesson-wallet/route.ts` | `ensureSlotHasCapacity` requires `status='open'` and `current_students < max_students`; redemption therefore blocks full targets and manually adjusts cached occupancy. | Verified entitlement, ownership, no attendance, 48-hour store cutoff, same month, future active template, real slot, duplicate prevention, credit CAS, no new payment, assignment cleanup. | Replace capacity check with cancelled/lifecycle/template validation; keep occupancy informational. Audit transaction boundary and overlapping-session prevention. | Unknown if later atomic RPC is chosen |
| `src/app/api/admin/makeup/route.ts` + makeup client | Target creation has no capacity ceiling, but the API does not currently prove active target template, future target, exact learner duplicate/overlap, real `schedule_slot_id`, booking/session relationship, idempotency, or atomicity. | Admin authorization, verified/absence review policy, next-month rule, attendance/entitlement audit and notifications. | Preserve unlimited entry and add the missing server-authoritative target-slot/safety contract before calling the path consistent. | Likely for atomic RPC; exact boundary needs implementation design |
| Tests/fixtures | Booking regression and availability checks intentionally assert `5/6`, `6/6`, full disabling and atomic capacity rejection; Lesson Wallet UAT asserts available target capacity. Schema fixtures seed `max_students=6`. | Executable template, duplicate, timing, pricing, coupon, draft, race and cleanup proof. | Rewrite behavior assertions rather than delete them: retain `6` fixtures as a regression trigger but require learner 7 and learner 21 to succeed. | No |

- Capacity occurrence classification:
  - **Hard business capacity limit to remove:** Booking capacity display/disable/error
    handling, availability capacity/full/can-fit decisions, Progressive lock rejection,
    refresh-derived `status='full'`, Lesson Wallet capacity/open-only guard, and tests
    whose pass condition is rejection at `6`.
  - **Informational occupancy only:** active occupancy counting and
    `schedule_slots.current_students`, if retained as a non-authoritative operational
    count that cannot affect entry, pricing, entitlement, payroll, or accounting.
  - **Duplicate learner/time protection to preserve and strengthen:** the current
    exact learner/date/start/end checks in Booking, Progressive RPC, Reschedule, and
    Wallet. General interval-overlap prevention is not proven and remains a required
    Source-fix safety item.
  - **Lifecycle/start-time/template protection to preserve:** active template and
    canonical slot matching, cancelled-slot rejection, future/not-started checks,
    same-month rules, ownership/status/payment requirements, and assignment cleanup.
  - **Stale/dead code:** no effective dead capacity guard was relied on. Hardcoded
    `6` in Booking marketing text conflicts with policy; `max_students=6` in schema
    defaults and fixtures may remain only as compatibility/regression evidence.
  - **Unknown / Need verification:** no separate customer User makeup target-entry
    API was found; the inspected target creation is the Admin makeup path. Whether
    Reschedule, Wallet, and Makeup should share one new atomic RPC is an
    implementation design decision, not established current behavior.

#### Effective migration audit

- Latest applied local/Production definition of
  `progressive_lock_booking_slots_v1(uuid,uuid,learner_type,uuid,uuid,jsonb,uuid,uuid[])`
  and `progressive_refresh_slot_capacity_v1(uuid[])` is migration
  `20260710170000_add_progressive_pricing_transactions.sql`. No later migration
  replaces these helpers.
- Effective create is the 11-argument
  `create_progressive_booking_v1(uuid,learner_type,uuid,uuid,uuid,jsonb,uuid,uuid,bigint,integer,text)`
  from `20260713210000_add_progressive_legacy_baseline_compatibility.sql`. Effective
  pending edit is
  `update_progressive_pending_booking_v1(uuid,uuid,uuid,jsonb,uuid,bigint)` from
  `20260710170000`; effective cancel is
  `cancel_progressive_pending_booking_v1(uuid,uuid,uuid,bigint)` from
  `20260710180000_add_progressive_coupon_lifecycle.sql`.
- Production read-only `pg_proc` and migration-order verification confirmed the lock
  helper still raises `PROGRESSIVE_CAPACITY_EXCEEDED`; create and pending edit call
  it. Only the lock/refresh helpers reference `schedule_slots.max_students` or
  `current_students` among effective Progressive public functions. No pricing,
  entitlement, payment, Ledger, Finance, attendance, payroll, or accounting RPC was
  found using capacity as an input.
- **Migration required: YES.** A new additive, non-destructive
  `CREATE OR REPLACE FUNCTION` migration must supersede the two effective helpers.
  No table rewrite, tier change, historical reprice, or Production data repair is
  currently indicated.
- Preserve `SET search_path = public, pg_temp`. Lock/refresh are invoker functions;
  create/update/cancel and capability remain `SECURITY DEFINER`. Preserve revokes
  from `PUBLIC`, `anon`, and `authenticated`, service-role-only execution, and the
  current top-level signatures unless a coordinated capability bump explicitly
  requires otherwise. Production ACL inspection confirmed only `postgres` and
  `service_role` can execute these functions.
- Add an explicit unlimited-slot policy field/version to
  `progressive_pricing_writes_capability_v1()` and update the server expectation in
  the same Source release so old DB behavior fails closed. Rolling back only the
  function would reintroduce the invalid capacity ceiling; rollback must be a
  coordinated Owner-approved Source/migration decision. Existing cached `full`
  rows need not be destructively rewritten if every entry path ignores occupancy
  state and touched rows are normalized by the new refresh behavior.

#### Learner names, pricing evidence, and customer copy

- `children.full_name` is required and `children.nickname` is nullable. `profiles`
  has `full_name` but no nickname field. No shared learner display formatter exists;
  Booking currently mixes full name, nickname-only, and `full_name (nickname)`.
- Smallest shared boundary is a pure `src/lib/learner-display-name.ts` formatter:
  distinct trimmed nickname/full name -> `{nickname} - {fullName}`; absent or
  whitespace nickname -> full name; equal normalized values -> full name once;
  blank full name with nickname -> nickname only; both blank -> neutral
  `ไม่ระบุชื่อผู้เรียน`. Self/adult uses profile full name only. Multi-child output
  maps the formatter per child and joins the resulting names without blank separators.

  | Case | Required output |
  | --- | --- |
  | nickname `น้องเมย์`, full name `เมย์ ใจดี` | `น้องเมย์ - เมย์ ใจดี` |
  | nickname absent or whitespace, full name `เมย์ ใจดี` | `เมย์ ใจดี` |
  | nickname equals full name `เมย์ ใจดี` | `เมย์ ใจดี` |
  | child learner | Apply the same rule to `children.nickname` + `children.full_name` |
  | self/adult learner | Trimmed `profiles.full_name` only; do not invent nickname |
  | children `น้องเมย์`/`เมย์ ใจดี` and no nickname/`มิน ใจดี` | `น้องเมย์ - เมย์ ใจดี, มิน ใจดี` |
- `pricing_tiers.min_sessions` is the inclusive lower bound,
  `max_sessions` the nullable inclusive upper bound, `price_per_session` the unit
  price, and `package_price` the package price. `max_sessions=null` is open-ended.
- Progressive preview already computes an authoritative nested `selectedTier`
  containing id/min/max, but Booking's client type/render discards that range and
  uses only the rate. Legacy preview returns totals without selected-tier evidence.
  The client separately receives tier rows and fallback defaults; that is not a safe
  substitute for the exact server-selected tier.
- Smallest safe preview contract adds top-level selected-tier evidence from the exact
  authoritative DB calculation for every applicable mode:
  `{id,minSessions,maxSessions,pricePerSession,packagePrice,unit}`. Render `N ครั้ง`
  for one-session, `N–M ครั้ง` for bounded, and `N ครั้งขึ้นไป` for open-ended.
  Adult Group and Private preserve their current formulas and render the exact
  package/session/hour evidence selected by the server. Coupon applies after gross;
  a zero final price still shows gross, discount, selected range, final `0`, and that
  no slip is required.
- Step 4 compact copy: `ช่วงราคา {range} • {rate} บาท/ครั้ง`. Step 5 title:
  `วิธีคิดราคาการจองครั้งนี้`, followed by `เดือนนี้มีรอบเรียนเดิม {previous} ครั้ง`,
  `ครั้งนี้เลือกเพิ่ม {new} ครั้ง`, `หลังจองจะรวมเป็น {after} ครั้ง`,
  `จำนวนรวม {after} ครั้ง อยู่ในช่วงราคา {range}`,
  `ราคาสำหรับการจองครั้งนี้ {rate} บาทต่อครั้ง`, and
  `ยอดชำระครั้งนี้: {new} × {rate} = {gross} บาท`.
- Progressive Kids Group additionally says
  `ยอดที่ชำระสำหรับรายการก่อนหน้าจะยังอยู่กับรายการเดิม และไม่ถูกหักจากการจองครั้งนี้`.
  Legacy Kids Group, if still customer-visible, uses the same neutral title and
  explains paid rounds, total rounds, authoritative range, total monthly amount,
  amount already paid, and this payment without naming Legacy or true-up.
- Coupon copy: `ราคาก่อนใช้คูปอง: {gross} บาท`,
  `ส่วนลดคูปอง {code}: {discount} บาท`,
  `ยอดชำระหลังหักส่วนลด: {final} บาท`. Zero copy:
  `ยอดชำระครั้งนี้: 0 บาท` and `ไม่ต้องแนบสลิปสำหรับรายการนี้`.
- One-session range copy is `ช่วงราคา 1 ครั้ง`; bounded range is
  `ช่วงราคา {min}–{max} ครั้ง`; open-ended range is
  `ช่วงราคา {min} ครั้งขึ้นไป`.
- Exact neutral Legacy explanation, if that mode is still customer-visible:
  `วิธีคิดราคาการจองครั้งนี้`, `เดือนนี้มีรอบที่ชำระแล้ว {old} ครั้ง`,
  `ครั้งนี้เลือกเพิ่ม {new} ครั้ง`, `หลังจองจะรวมเป็น {after} ครั้ง`,
  `จำนวนรวม {after} ครั้ง อยู่ในช่วงราคา {range}`,
  `ยอดรวมของเดือนตามช่วงราคานี้: {after} × {rate} = {target} บาท`,
  `หักยอดที่ชำระแล้วในเดือนนี้: {paid} บาท`, and
  `ยอดชำระครั้งนี้: {charge} บาท`.
- Exact Adult Group explanation:
  `วิธีคิดราคาการจองครั้งนี้`, `เลือกเรียน {n} ครั้ง`,
  `แพ็กเกจที่ใช้: {authoritativeRange}`, `ราคาแพ็กเกจ {package} บาท`,
  `เฉลี่ย {rate} บาทต่อครั้ง`, and `ยอดชำระครั้งนี้: {final} บาท`.
  Exact Private explanation uses the same lines with `{hours} ชั่วโมง` and
  `เฉลี่ย {rate} บาทต่อชั่วโมง`. Coupon and zero-price lines above append after the
  authoritative gross calculation without changing either formula.
- Current customer copy to replace includes `เรท Progressive`,
  `คำนวณราคา Progressive`,
  `สิทธิ์เดิมที่ใช้กำหนดเรท`, `การจอง Progressive ก่อนหน้า`, technical `เรท`,
  Legacy monthly target/deduction/credit wording, and capacity/full messages.

#### Proposed implementation split and executable test matrix

1. Customer Booking UI and authoritative preview contract: add shared learner-name
   formatting, return the selected DB tier evidence for all modes, replace Steps 4-5
   copy, and retain preview/draft/coupon authority.
2. User booking/edit: remove UI/API capacity decisions and obsolete typed error while
   preserving server template/slot/duplicate/timing/Option A/atomic write guards.
3. Reschedule and Lesson Wallet: remove Wallet capacity/status-full blocking and add
   shared overlap/lifecycle/idempotency/atomicity regression coverage; Reschedule
   remains unlimited and receives the same safety proof.
4. Makeup: add server-authoritative active template, future real-slot, learner
   duplicate/overlap, ownership relationship, idempotency and atomic write behavior
   without adding a capacity ceiling.
5. Database RPC Source: add the non-destructive helper replacements and coordinated
   capability contract. Do not apply remotely in the Source-fix round.
6. Rewrite rather than delete the existing full-slot tests. Required matrix:
   `0+1`, `6+1`, and `20+1` learners succeed; same learner exact/overlapping time
   remains blocked; started/past and inactive/nonexistent template remain blocked;
   new booking, pending edit, reschedule, Wallet redemption, and makeup target all
   succeed above old capacity; Progressive `4+1` shows `2–6`/`625`, `4+4` shows
   `7–10`/`500`; coupon gross/discount/final remains correct; restored draft
   recalculates; Adult Group and Private are unchanged; normal customer explanation
   contains no Progressive/Legacy; all learner-name cases pass. Also retain mutation
   replay, stale revision/baseline, race, rollback residue, payment/history,
   attendance, and coach-evidence regressions.
7. Commit/Push is a separate gate after local/disposable checks and Owner approval.
8. Deploy, migration application, Production no-write/write UAT, and any data action
   remain separate later approvals; this audit does not combine them.

#### Out of scope and remaining gate

- No Head Coach grouping redesign, Admin Schedules performance fix, Homepage LV copy,
  tier/formula change, historical reprice/repair, payment, SlipOK, coupon, Ledger,
  Finance, payroll, attendance, deployment, environment, or Production write belongs
  to this audit.
- No conflicting Owner capacity policy, destructive migration, pricing/payroll/
  accounting dependency, or required Production data repair was found. The effective
  RPC is identified confidently. The remaining gate is Owner approval for the
  audited functional Source Fix, additive migration Source, and Local Test scope
  only. Commit/push, remote migration, deploy, and Production UAT remain unapproved.

### 2026-07-12 - Kids Group Legacy vs Progressive Pricing

Purpose: preserve the detailed evidence behind the current
`PRODUCTION POLICY MISMATCH` classification. The prioritized current state and next
actions live in `PROJECT_STATE.md` and `TODO-CODEX.md`.

#### Formula and ordering

- Legacy source (`src/lib/pricing.ts`, `src/lib/booking-pricing.ts`):
  - DB `pricing_tiers` is authoritative; source constants are fallback only.
  - Existing pricing history includes settled `paid` and `verified` bookings only.
  - `totalAfter = existingSettledSessions + newSessions`.
  - `targetMonthlyTotal = totalAfter * rateOf(totalAfter)`.
  - `charge = max(0, targetMonthlyTotal - existingSettledTotal)`.
  - This is a retroactive monthly true-up. A negative raw charge is represented as
    `creditDifference`; prior rows are not automatically rewritten during booking.
- Owner-approved Progressive source (`src/lib/progressive-booking-pricing.ts`):
  - Active ordering includes non-expired `pending_payment`, `paid`, and `verified`;
    cancelled/expired rows are excluded.
  - Order is `created_at`, then booking id for a deterministic tie-break.
  - `cumulativeAfter = previousActiveSessions + newBookingEntitlementSessions`.
  - `grossBookingPrice = newBookingEntitlementSessions * rateOf(cumulativeAfter)`.
  - The current booking's coupon is deducted after gross pricing.
  - No retroactive monthly true-up, difference credit, or reprice of earlier bookings.

#### Owner examples / scenario matrix

| Scenario | Legacy true-up | Progressive booking-level |
| --- | ---: | ---: |
| One booking, 10 sessions | `5,000` | `5,000` |
| Split `5+5` | `3,125 + 1,875 = 5,000` | `3,125 + 2,500 = 5,625` |
| Ten settled one-session bookings | `5,000` after true-up/credit effects | `5,825` |
| Split `8+8` | `4,000 + 2,496 = 6,496` | `4,000 + 3,248 = 7,248` |

Evidence: `scripts/check-pricing-true-up.js`,
`scripts/check-progressive-booking-pricing.js`, Progressive transaction tests, and
the Owner's 2026-07-12 documentation-reconciliation instruction. The separately
named “Formula And Ordering / Scenario Matrix” design document was not found in the
repo: `Unknown / Need verification`.

#### Source, commits, and releases

- Legacy monthly true-up source commit `5897cede58f720c1b5f205af53c9821cff0a39bf`
  was recorded deployed as `dpl_5e6i8M3Mtzy5xNah6xVD9v6PtHwQ`.
- Legacy settled-only follow-up/source repair commit
  `1701a0474ae1fdcf742f6db4c3e3c8c26d39ec2b` excluded `pending_payment` from
  settled history and was recorded in deployment `dpl_2FKH4GbJ1wa3fSn4xnsxehW6pRdB`.
- Progressive pricing foundation was added by `ed1d20d`; transaction support by
  `46ab89b`; coupon/payment layers followed in later commits.
- Progressive Normal Booking Entry commit
  `56daabf30ad60c07b3c3ccb98fe42028e33de1be` is pushed to
  `origin/spike/next-major-security-upgrade` and passed local/disposable runtime
  verification. It was not included in the last confirmed Production release.
- Last confirmed Production source is shared SlipOK corrective commit
  `0fbf98fe7a03f71ecb61642ebb20458e4a6480de`, deployment
  `dpl_P5BQcazfbWjReuuLkGXkZpGoG1Gz`, with Progressive entry flags/allowlist unset.
- Current live deployment/SHA/env state on 2026-07-12 is
  `Unknown / Need verification`: Vercel read-only inspection failed with scope 403.

#### Production repairs made under Legacy true-up

- `ff0728dd-066a-417a-aeaa-0049fed6b931`: `3,248 -> 2,496`; paired first booking
  remained `4,000`; no payment/coupon rows; sessions unchanged. Under Progressive
  `8+8`, the second booking would remain `3,248`, so this repair differs by `752`.
- Four July rows were repaired with payment evidence preserved, no payment/refund/
  coupon rows created, and sessions/tiers untouched:
  - `5d1d9a43-afcd-4d26-8817-68ab948443f2`: `2,800 -> 1,169`.
  - `3f95767e-8418-4b0b-b87d-2cd18811825b`: `14,700 -> 13,600`.
  - `f565a552-65f3-44e0-8826-22a4c9cb0dbb`: `1,299 -> 763`.
  - `ff9cf27f-6415-444d-90b6-89ab05fc2d47`: `2,000 -> 1,500`.
  - Progressive impact for each is `Unknown / Need verification` until ordered
    entitlement/tier/coupon snapshots are reconstructed read-only.
- Two pending rows were corrected from settled history `8 / 4,000`, plus one new
  session at rate `500`: `9112a5cb-006c-4fdd-838d-5534c15b6fb1` `0 -> 500` and
  `60779d60-ac26-4eaf-a34f-703157a32300` `196 -> 500`. Payments, coupons, wallet,
  and attendance were zero; sessions were unchanged. This documented `8+1` case is
  also `500` under current Progressive tiers.
- These are historical repair facts. Current row status and later dependencies are
  `Unknown / Need verification`; no further write is authorized from this record.

#### Documentation drift found and corrected

- `PROJECT_STATE.md` was a long chronological log without a prioritized distinction
  between Owner policy, Legacy behavior, Progressive source, and deployed runtime.
- `TODO-CODEX.md` treated Homepage LV copy as the next task while the pricing policy
  mismatch remained open, and repeated extensive completed history.
- Earlier scoped `PASS` labels could be read as end-to-end policy/runtime agreement.
  They now remain historical scope results only and are superseded for current
  reconciliation by the top-level mismatch classification.
- Legacy monthly true-up examples and Progressive booking-level examples are now
  explicitly separated; no formula is silently treated as the other.

#### Final audit result and pending Owner decision

- Progressive implementation matches the supplied Owner formula and scenarios.
- Superseded by the Owner decision and read-only audit record below.

### 2026-07-12 - Progressive General Rollout Decision and Unpaid-Only Boundary

#### Owner decision

- Progressive replaces Legacy for general Kids Group Production traffic.
- Exact formula:
  `grossBookingPrice = newBookingSessions * rateOf(previousActiveSessions + newBookingSessions)`.
- There is no retroactive monthly true-up, price-difference credit, or automatic
  rewrite of earlier bookings.
- Historical review is limited to genuinely unpaid Kids Group bookings. Paid,
  approved-payment, or verified bookings are excluded from repricing in this round.
- Adult Group and Private pricing are unchanged.
- Deploy, environment/feature controls, allowlist changes, Production UAT writes,
  and Production data repair were not approved.

#### Read-only deployment result and documentation drift

- `DOCUMENTATION DRIFT`: Vercel CLI verification found the current Ready Production
  deployment is `dpl_AG8zaB1Wexi5hCKuh5jeDQzfabuW` at source
  `56daabf30ad60c07b3c3ccb98fe42028e33de1be`, not the previously documented
  `0fbf98f` release.
- Public/project aliases are attached to that deployment. All five Progressive
  control variable names and `PROGRESSIVE_PAYMENT_ALLOWED_USER_IDS` are absent from
  Production. No values, secrets, or UUIDs were exposed.
- Deployed = yes; Enabled = no; Allowlisted = no; Production active = no;
  Production UAT = not performed. No Vercel state changed.

#### Read-only unpaid-booking result

- Query scope: all `454` Production Kids Group bookings across 2026-05 through
  2026-08. Counts: `415 verified`, `33 cancelled`, `6 pending_payment`, `0 paid`.
- Each pending row was checked against payment rows/statuses, coupon usages and
  Progressive reservations, lesson wallet credits, sessions and attendance,
  Progressive payment batches/allocations, finance ledger allocations, current
  pricing tiers, and deterministic active booking order.
- All six pending rows are genuinely unpaid and have no checked downstream
  dependency rows. Five match Progressive price. One proposed repair candidate is
  `d6dad7aa-3e20-4f78-93e0-a7638fc1bb40`: ordered second after one verified
  one-session booking, so `previousActiveSessions = 1`, `newBookingSessions = 1`,
  `rateOf(2) = 625`, expected `625` versus stored Legacy `550`, difference `75`.
- Candidate totals are Legacy `12,800` versus Progressive `12,875`.
- All `415` verified rows have direct approved payment evidence and are excluded;
  no paid or verified row was reopened or repriced.

#### Separate proposed scopes — not performed

- Deploy scope: select and approve a general-traffic gating design because current
  source still requires UUID allowlisting; then separately approve deploy, exact
  Production controls, activation order, controlled UAT, monitoring, and rollback.
- Data-repair scope: after separate Owner approval and a fresh dependency recheck,
  update only `d6dad7aa...` from `550` to `625`. Do not modify the five matching
  candidates or any payment, coupon, wallet, refund, entitlement, session,
  attendance, payroll, or accounting row.
- Current classification is
  **OWNER DECISION CONFIRMED — READ-ONLY DEPLOYMENT AND UNPAID-BOOKING AUDIT REQUIRED**,
  not `PASS`. Superseded for current source status by the 2026-07-13 record below.

### 2026-07-13 - General Kids Group Gating Source

#### Root cause and approved contract

- Deployed source `56daabf` required both `PROGRESSIVE_PAYMENT_ENTRY_ENABLED=true`
  and membership in `PROGRESSIVE_PAYMENT_ALLOWED_USER_IDS`. That was appropriate
  for the earlier staged rollout but did not implement the Owner-approved general
  Kids Group policy.
- Owner approved general `kids_group` selection from the server-resolved course type
  plus the Entry control, without per-user UUID membership. `adult_group` and
  `private` remain Legacy.
- Pricing-write, coupon-lifecycle, and payment-batch dependencies remain mandatory.
  Once Progressive is selected, any missing dependency returns typed `503` with no
  Legacy fallback or partial write.

#### Implementation

- Source commit `5c8cee1e8a81f928b870e643a78e1d2baf39fa06` is committed and pushed to
  `origin/spike/next-major-security-upgrade`.
- Preview and create now call the server-only decision with the DB course type;
  client mode, user, and price fields remain non-authoritative.
- Stored `pricing_scope_id` continues to select Progressive edit/cancel regardless
  of the current Entry flag.
- Payment prepare/upload/submit/status/cancel and History payment eligibility now
  use authenticated ownership plus dependency readiness, not Entry or UUID
  membership. This preserves draining existing Progressive bookings after Entry is
  disabled.
- UUID allowlist parsing was retained as staged/test infrastructure. It is no longer
  general eligibility and was never a substitute for route authentication or batch
  ownership checks.
- No migration, pricing formula/tier, Legacy, Adult Group, Private, SlipOK, payment,
  coupon, wallet, attendance, entitlement, refund, payroll, or accounting behavior
  was otherwise changed.

#### Verification and state separation

- Passed: booking entry `23`, Progressive pricing `17`, transactions `33`, coupon
  lifecycle `38`, payment batches `39`, payment integration `18`, shared SlipOK `6`,
  Legacy pricing regression `14`, TypeScript, ESLint, mojibake, and Production build.
- Post-build protocol passed: this repo's `.next` was removed, dev restarted on
  `127.0.0.1:3000`, home/static assets returned `200`, browser content rendered,
  captured console errors were empty, and no Next error overlay was present.
- Source complete: yes. Committed: yes. Pushed: yes.
- Deployed for `5c8cee1`: no. Enabled: no. Production active: no. Production UAT:
  not performed. Production data repaired: no.
- Production remains deployment `dpl_AG8zaB1Wexi5hCKuh5jeDQzfabuW` at older source
  `56daabf30ad60c07b3c3ccb98fe42028e33de1be`, with Progressive controls absent.
- Owner separately approved the later unpaid repair
  `d6dad7aa-3e20-4f78-93e0-a7638fc1bb40`, `550 -> 625`. It was not performed and
  remains a separate write round requiring a fresh pre-write dependency check.
- Current classification:
  **PASS — GENERAL KIDS GROUP GATING SOURCE ONLY; DEPLOY/ACTIVATION/UAT AND ONE-ROW REPAIR PENDING**.

### 2026-07-13 - Owner-Approved Progressive Unpaid Booking Repair

#### Policy and pre-write proof

- Owner explicitly approved exactly booking
  `d6dad7aa-3e20-4f78-93e0-a7638fc1bb40`, `bookings.total_price 550 -> 625`, using
  `newBookingSessions * rateOf(previousActiveSessions + newBookingSessions)`.
- Fresh Production audit found exactly one target row: `kids_group`,
  `pending_payment`, one child entitlement/session, one `scheduled` session, and
  unchanged `updated_at` from creation.
- Deterministic active order remained one earlier verified one-session booking
  `119752e0...` followed by the target. Therefore `previousActiveSessions = 1`,
  `newBookingSessions = 1`, `cumulativeAfter = 2`, current tier `625`, expected
  booking price `625`.
- Pre-write dependency counts were all zero: payments/payment evidence, coupon
  usages/reservations, lesson wallet, attendance, Progressive batch links,
  allocations, finance ledger, and refund/credit/accounting relations.
- Only the original `create_booking` activity existed. The target had no later edit,
  cancellation, payment, verification, or manual correction evidence.

#### Atomic write

- One linked-Production SQL transaction locked the target booking, target session,
  active booking order, and pricing-tier rows; rechecked all safety predicates; and
  required the exact id, `pending_payment`, `550`, and pre-write `updated_at`.
- Exactly one booking row changed to `625`. Only normal `updated_at` changed beside
  `total_price`; status, learner, branch, course, month/year, entitlement fields,
  pricing-scope fields, and all sessions were preserved.
- The same transaction inserted exactly one activity log:
  `98359d52-4da1-4ef2-bc75-a9b3a29db830`, action
  `owner_progressive_unpaid_booking_repair`.
- Activity details record Owner approval, `550 -> 625`, difference `75`, formula,
  `1 + 1 -> 2`, tier `625`, preserved pending status, zero dependencies, gating
  source `5c8cee1`, Production deployment `dpl_AG8za...`/source `56daabf`, and that
  no deploy or feature activation occurred.

#### Post-write reconciliation and impact

- Independent read-only audit confirmed target `625`, `pending_payment`, the same
  one scheduled session/order, dependency counts still zero, and exactly one repair
  activity log.
- Transaction fingerprints confirmed the other five matching unpaid candidates,
  every paid/verified booking, all target sessions, and all pricing tiers unchanged.
- July Progressive shadow reconciliation now reports `4/4` pending bookings
  `MATCH`, underpriced count `0`, underpriced amount `0`, and no missing tier.
- Customer impact: the genuinely unpaid amount due increased by `75`; no payment,
  refund, credit, wallet, attendance, entitlement, payroll, or accounting entry was
  created or changed.
- Financial impact: booking receivable/net value increased by `75`; cash received,
  payment ledger, and accounting allocations remain unchanged.
- Rollback recorded but not executed: `625 -> 550` only if a fresh audit proves no
  payment, coupon, wallet, attendance, refund, credit, entitlement, or accounting
  dependency occurred after repair. Otherwise stop and re-plan with Owner approval.
- Source complete/committed/pushed: yes (`5c8cee1`). New source deployed: no.
  Progressive enabled: no. Production active: no. Production UAT: not performed.
  One-row data repaired: yes.
- Current classification:
  **PASS — ONE UNPAID PRODUCTION BOOKING REPAIRED; DEPLOY/ACTIVATION/UAT PENDING**.

### 2026-07-13 - Progressive General-Traffic Rollout and Safe Entry Rollback

- Owner approved deploy/activation/UAT for exact source `5c8cee1`. Pre-deploy Git,
  Vercel, migration capabilities, Production counts, ledger, and logs matched the
  documented baseline. All required source checks and Production build passed; the
  payment-integration test required LF normalization because its literal LF match
  is a Windows CRLF false negative.
- Gate 2 deployed Entry-off source as `dpl_9q684Kgc...`; authenticated Owner test
  preview remained Legacy. Gate 3 enabled pricing-write, coupon-lifecycle,
  payment-batch, and payment-review controls and deployed `dpl_7cpBHQY...`; Entry
  and allowlist remained absent and DB counts were unchanged.
- Gate 4 enabled Entry and deployed `dpl_223P3mh...`, Ready at exact SHA `5c8cee1`.
  Stage A passed: Kids Group entered the Progressive path, Adult Group and Private
  remained Legacy, unauthenticated preview returned `401`, and no preview write
  occurred.
- Stage B used the documented Owner test profile and `TEST System` learner. It
  created exactly booking `89533cdf-76cf-4ee5-bb66-ce7bf7bbf5fe` (`700`, one
  session, `pending_payment`), scope `f4acca6c-86b9-44da-88cc-86d8222f28c3`, and
  session `34ad024d-59f3-409d-b431-36e2765f9737`. Pricing snapshots prove sequence
  `1`, cumulative `0 -> 1`, rate/gross/final `700`, coupon `0`.
- Payment prepare created batch `eb5a1c73-fceb-4fd1-b6e6-414fc3fe1410`, amount
  `700`, status `prepared`, one active member. Chrome blocked local file attachment
  because the ChatGPT extension lacks file-URL access. No slip path/hash, submit,
  verification attempt, allocation, payment, coupon, or ledger row exists.
- Primary rollback executed immediately: Entry `false`, four dependency controls
  remain `true`, allowlist absent, shared `SLIPOK_TEST_MODE=true`. Current Ready
  deployment is `dpl_F2gfntqNX8ZiR5yr5dPB6UdeX8Fe`, exact SHA `5c8cee1`, with all
  Production aliases. No source/data deletion or hard source rollback occurred.
- Monitoring found no final-deployment error logs, no duplicate ledger source, and
  no Progressive allocation. Legacy payments/ledger remain `465`; repaired booking
  `d6dad7aa...` remains `625` and `pending_payment`.
- Current classification:
  **BLOCKER — ENTRY DISABLED; PROGRESSIVE ROLLOUT ROLLED BACK SAFELY**.
- Resume only after Chrome file-URL access is enabled. Drain the existing UAT
  booking/batch if valid; do not create a second booking. After full payment,
  Admin/Finance/notification reconciliation passes, re-enable Entry last and repeat
  bounded monitoring.

#### 2026-07-13 - Existing UAT Payment Completed; Entry Remains Disabled

- Owner confirmed Chrome file-URL access and authorized continuation on only booking
  `89533cdf-76cf-4ee5-bb66-ce7bf7bbf5fe`. Pre-continuation read-only verification
  matched deployment `dpl_F2gfntqNX8ZiR5yr5dPB6UdeX8Fe`, exact source `5c8cee1`,
  four dependency controls `true`, Entry `false`, allowlist absent, and shared
  `SLIPOK_TEST_MODE=true`.
- Original prepared batch `eb5a1c73-fceb-4fd1-b6e6-414fc3fe1410` expired normally.
  The product's lazy-expiry path cancelled it with `prepared_expired` and released
  its scope lock. One stale client revision attempt failed closed and created no
  batch; after refreshing authoritative scope revision, exactly one replacement
  batch `d65dc3b8-5a48-4b4a-bea5-b64f2a1133ac` was prepared for the same booking.
- The real User History flow attached the harmless repository favicon PNG, uploaded
  it to the private Progressive bucket, and submitted it. Shared Test Mode created
  no live SlipOK request and resolved verification attempt
  `7da5e1dd-1c5d-436a-8c62-a1f06b67d51c` as `approved`, amount `700`, result
  `TEST_APPROVED`. The replacement batch is approved and the booking is `verified`.
- Allocation `7ec8d0e1-a3fa-4e27-9c6e-5e6779c50e9d` is the only allocation and is
  `700`. `payment_ledger_allocations_v1` contains one Progressive source for the
  replacement batch and booking, also `700`; no legacy `payments` row exists.
  Pricing snapshots, one scheduled session, and total `700` are unchanged; coupon
  reservations/usages remain zero and the pricing scope is unlocked at revision `3`.
- User History shows one successful booking card with no stale upload state. User
  notification `e62d9e2f-f49f-49f1-a138-9ee427655d14` exists once and is visible.
  Finance reconciliation is cash `+700`, booking net `700`, allocation `700`, and
  one distinct Progressive transaction with no batch-header double count.
- The required Admin notification gate failed. No Admin-recipient payment
  notification was created; the approval RPC inserts only the user notification.
  The other two notifications in the count delta were unrelated coach attendance
  reminders. The Chrome session also lacked verified Standard Admin and Super Admin
  identities, so the required role-specific Production UI checks could not be
  completed. Source inspection shows Admin Payments conditionally includes amount
  only when `role === 'super_admin'`, but that is not a substitute for the requested
  Production role UAT.
- Counts changed only as expected for this continuation: bookings `514 -> 514`,
  scopes `2 -> 2`, batches `3 -> 4`, attempts `0 -> 1`, allocations `0 -> 1`,
  legacy payments `465 -> 465`, coupon reservations/usages `0 -> 0`, ledger
  `465 -> 466`, notifications `15889 -> 15892`. Existing repaired booking
  `d6dad7aa-3e20-4f78-93e0-a7638fc1bb40` remains `625`, `pending_payment`.
- Safety gate applied before activation: Entry remains `false`; no environment
  change, redeploy, rollback repetition, second booking, cleanup, migration, source
  change, pricing-tier change, coupon change, or additional repair occurred.
- Current classification:
  **BLOCKER — ENTRY DISABLED; PROGRESSIVE ROLLOUT ROLLED BACK SAFELY**.
- Next work requires separate Owner approval for a narrowly scoped Admin-notification
  source correction and deployment, plus verified Standard Admin and Super Admin
  identities for read-only role UAT. Do not repeat this payment or create another
  Production UAT booking.

### 2026-07-13 - Progressive Admin Payment Notification Source Fix

#### Root cause and implementation

- Production UAT proved booking `89533cdf-76cf-4ee5-bb66-ce7bf7bbf5fe` and batch
  `d65dc3b8-5a48-4b4a-bea5-b64f2a1133ac` approved correctly for `700`, but only
  user notification `e62d9e2f-f49f-49f1-a138-9ee427655d14` was created.
- Source audit proved `approve_progressive_payment_batch_v1` owns booking
  verification, coupon consumption, allocations, batch approval, scope unlock,
  activity log, and the user notification in one transaction. It inserted only for
  `v_batch.user_id`; neither the submit route nor another helper notified staff.
- Route-level notification was not used because it would execute after the atomic
  approval and the shared `notifyUserOnce` helper is a non-atomic check-then-insert.
  A route failure or concurrent retry could therefore leave missing or duplicate
  notifications while payment had already committed.
- Commit `60688a340d473b2bb64f0bee9b1e68cb8cf47c1a` adds migration
  `20260713153000_notify_staff_on_progressive_payment_approval.sql`. It replaces
  only the approval RPC, preserves its payment/booking/allocation/coupon/activity
  semantics and existing user notification, and adds an amount-free operational
  notification linked to `/admin/payments` for every extant profile whose role is
  `admin` or `super_admin`. Profiles have no separate active flag.
- The staff copy contains no batch total, booking total, allocation, revenue, or
  other restricted amount. Admin and Super Admin receive the same operational copy;
  no financial visibility contract was broadened.
- Idempotency remains the approval transaction contract: the batch advisory/row
  locks serialize approval and an already-approved replay returns before either
  notification insert. Prepared, expired/cancelled, rejected, under-review, and
  failed-verification states create no success notification unless a submitted or
  under-review batch actually completes the successful approval transition.

#### Verification and state separation

- Passed deterministic checks: notification `16`, payment batches `39`, payment
  integration/Finance/redaction `18`, booking entry `23`, Progressive pricing `17`,
  Progressive transactions `33`, coupon lifecycle `38`, shared SlipOK `6`, and
  Legacy pricing/payment `14`.
- Passed `npm.cmd run check:mojibake`, `npx.cmd tsc --noEmit`, `npm.cmd run lint`,
  `npm.cmd run build`, and `git diff --check`. After build, `.next` was removed,
  dev restarted on `127.0.0.1:3000`, and `/` plus
  `/_next/static/chunks/webpack.js` returned `200`.
- Source complete: yes. Committed: yes (`60688a3`). Pushed: yes after synchronized
  documentation closeout. Migration added: yes. Migration applied remotely: no.
- Deployed: no. Entry: `false`. Allowlist: absent. Production active: no.
  Production data changed: no. Existing UAT payment was not repeated and no second
  booking or direct notification repair was performed.
- Owner confirms a verified Super Admin Chrome session is ready for later read-only
  Production UAT. Standard Admin identity remains `Unknown / Need verification`.
- Remaining gate: separate Owner approval to apply exactly the new migration and
  deploy the exact source, then read-only Super Admin and verified Standard Admin
  UAT. Entry activation remains a later, separate final gate.
- Source-only classification:
  **PASS — ADMIN PAYMENT NOTIFICATION SOURCE FIX ONLY; DEPLOY/UAT/ENTRY ACTIVATION PENDING**.

### 2026-07-13 - Notification Migration, Exact Deploy, and Read-Only Admin UAT

- Gate 0 passed: local/remote branch HEAD matched documentation commit
  `f5b22a9a3e7e27c16d3a20cd3788a4f3af4b26b5`; source commit `60688a3` is its
  ancestor; only the pre-existing `AGENTS.md` change was dirty. Exactly migration
  `20260713153000` was pending. Migration file SHA-256 was
  `B7C9A44BED917BFFDBD7CAFD12D0C58928CDED97AE46A5897A6D79BCC5D8D778`.
- Prior approval function hash was `2b4ee8a5a7243a54747f3a2632aeb005`, with one
  service-role-only signature, the user insert present, and no staff-role selection.
- Gate 1 applied exactly `20260713153000`. Post-apply function hash is
  `424b3939e86b615b8ded01f0e8038105`; signature/grants remain correct, both user and
  staff inserts are present, staff selection is only `admin`/`super_admin`, staff
  copy links to `/admin/payments` and contains no restricted amount token, and the
  approved replay return precedes both inserts.
- Migration application created no notification/backfill or business data change.
  Baseline and final counts remained: notifications `15931`, bookings `517`, scopes
  `2`, batches `4`, attempts `1`, allocations `1`, legacy payments `467`, ledger
  `468`, coupon reservations/usages `0`. Protected UAT and repaired-booking hashes
  were unchanged; duplicate allocation and Progressive ledger-source counts were
  `0`.
- Gate 2 deployed from a clean detached worktree at exact commit `f5b22a9`, which
  contains source `60688a3`. Vercel linking initially added a local `.env*` ignore
  line, so that first artifact `dpl_9kFSKGs...` was not accepted for UAT. The line
  was removed and the final clean deployment is
  `dpl_3tW1GQdxJGrfjo3XU35wwKLCxuWe`, Ready with all four Production aliases.
- Vercel API did not populate Git SHA metadata for the CLI deployment; exact commit
  evidence is the clean detached worktree HEAD/status and upload source scope.
  Home/static assets returned `200`, protected Admin routes preserved login guards,
  unauthenticated preview returned `401`, and monitoring found no error, 5xx, or
  SlipOK runtime log.
- Production controls remained pricing-write/coupon-lifecycle/payment-batch/
  payment-review `true`, Entry `false`, allowlist absent, and shared
  `SLIPOK_TEST_MODE=true`. No environment value changed in this round.
- Super Admin read-only UAT passed. `/admin/payments` showed the approved Progressive
  UAT batch once with amount `700`, approved state, one booking, exact batch/booking
  ids, Progressive method, and permitted details. `/admin/notifications` loaded the
  recipient-specific Super Admin inbox. No historical staff notification appeared,
  as required, and Chrome console/React/hydration errors were empty.
- Standard Admin UAT: `NEED REVIEW — STANDARD ADMIN IDENTITY NOT AVAILABLE`.
  Source tests still prove amount redaction, but no account was created, changed, or
  repurposed to substitute for Production role UAT.
- Entry-off Kids Group pricing remained Legacy by policy/control. Record:
  **PASS — ENTRY-OFF LEGACY BASELINE CONFIRMED**. The Owner-observed `4` prior + `4`
  new session draft result `1,500` was not repeated because the only verified
  browser identity was Super Admin; no booking confirmation occurred. Adult Group
  and Private remain Legacy by the unchanged entry contract, and the
  unauthenticated preview guard passed.
- Customer impact: none in this round; general Kids Group remains Legacy while Entry
  is off. Financial/data impact: none; no booking, payment, notification, allocation,
  ledger, Finance, coupon, wallet, attendance, entitlement, refund, payroll, or
  accounting row changed. Rollback was not performed.
- Source complete/committed/pushed/deployed: yes. Migration remotely applied: yes.
  Entry enabled/Production active: no. Production UAT: partial because Standard
  Admin remains unavailable. Task Done: no; separate Standard Admin UAT and Owner
  Entry activation decision remain.
- Classification:
  **NEED REVIEW — SOURCE DEPLOYED AND ENTRY DISABLED; STANDARD ADMIN UAT PENDING**.

### 2026-07-13 - Standard Admin Read-Only Production UAT Closeout

- Owner authorized read-only inspection and documentation closeout only. No deploy,
  environment change, Entry activation, booking/payment replay, notification
  insertion, role change, account creation, or Production repair was performed.
- Pre-UAT state matched the release record: deployment
  `dpl_3tW1GQdxJGrfjo3XU35wwKLCxuWe` was Ready on all four Production aliases from
  clean commit `f5b22a9`, containing notification source `60688a3`; migration
  `20260713153000` was applied. Pricing-write, coupon-lifecycle, payment-batch, and
  payment-review controls were `true`; Entry was `false`; allowlist was absent; and
  shared `SLIPOK_TEST_MODE=true` remained unchanged.
- The authenticated Chrome identity was proved from its visible profile name plus a
  unique read-only Production profile match: role exactly `admin`, with zero matching
  `super_admin` profiles. No role or account was changed to prepare the session.
- `/admin` loaded as Standard Admin without monthly/aggregate revenue, baht totals,
  Finance summary, or Super Admin identity/content. `/admin/payments` showed approved
  Progressive batch `d65dc3b8...` and booking `89533cdf...` exactly once with payer,
  learner, course, branch, date/session, identifiers, status, slip, and permitted
  operational detail.
- Standard Admin financial redaction passed in both rendered UI and the technically
  inspectable server payload: no structured payment amount, Progressive batch total,
  booking total price, allocation amount, approved/incomplete total, aggregate
  revenue, or Finance field was delivered. Target value `700` was not exposed as a
  structured value. The server source selects amount fields only for `super_admin`.
- `/admin/notifications` loaded the recipient-specific Standard Admin inbox with no
  Super Admin financial summary. No historical Progressive staff copy exists, as
  required by the future-event-only/no-backfill migration. Existing historical
  Legacy/booking notification messages may contain free-text amounts under their
  pre-existing contract; this is not a structured Progressive field. Future
  Progressive staff copy remains amount-free, targets `admin` and `super_admin`,
  and links to `/admin/payments`.
- Direct `/admin/finance` and `/admin/settings` checks redirected to `/admin` and
  exposed no restricted data. No user navigation or click opened `/admin/coupons`,
  although Vercel logs recorded automatic Next.js menu-link prefetch requests.
  Read-only follow-up proved the two current coupons have no expiry or usage cap,
  zero usages, and zero auto-close candidates, so the render-time guarded update
  could not run and coupon data remained unchanged. No write action was clicked.
  Browser console warnings/errors, React/hydration errors, and observed network 5xx
  were `0`.
- Bounded Vercel monitoring sampled `100` UAT-window requests, all from
  `dpl_3tW1GQdx...`: error-level events `0`, 5xx `0`; target Admin pages returned
  `200`, and Settings returned the expected `307` guard redirect.
- Before/after Production counts were unchanged: bookings `519`, pricing scopes `2`,
  batches `4`, attempts `1`, allocations `1`, legacy payments `469`, ledger rows
  `470`, coupon reservations/usages `0`, and notifications `15978`. Protected
  fingerprints remained UAT booking `b3ace1823603773273d19783fecfa9f4`, approved
  batch `dbcdcb47fde7f6b59d0244bf90b6b7f6`, and repaired booking
  `e99a8144b0c0af731aad4d4ae3c81025`. No row changed and no historical staff
  notification was backfilled.
- Source complete/committed/pushed/deployed: yes through the existing release.
  Migration applied: yes. Dependencies enabled: yes. Entry enabled/Production
  active: no. Super Admin and Standard Admin read-only UAT: passed. Customer,
  financial, and Production data impact in this round: none. Task Done: no, because
  general Kids Group remains Legacy until a separate Owner Entry-activation decision.
- Classification:
  **PASS — STANDARD ADMIN READ-ONLY UAT VERIFIED; ENTRY ACTIVATION OWNER DECISION PENDING**.

### 2026-07-13 - Final Entry Activation Attempt and Safe Rollback

- Owner approved changing only `PROGRESSIVE_PAYMENT_ENTRY_ENABLED=true`, preserving
  the four Progressive dependencies as `true`, UUID allowlist absent, and shared
  `SLIPOK_TEST_MODE=true`; redeploying the exact approved source; performing only
  no-write routing/pricing UAT; and immediately using the primary Entry-off rollback
  if any required proof gate failed. No source change, migration, Booking, Payment,
  historical repricing, or other Production data write was approved.
- Gate 0 matched the documented state: `dpl_3tW1GQdxJGrfjo3XU35wwKLCxuWe`
  Ready on all four aliases from clean commit
  `f5b22a9a3e7e27c16d3a20cd3788a4f3af4b26b5`, containing general gating source
  `5c8cee1` and notification source `60688a3`; migration `20260713153000` applied;
  four dependencies `true`; Entry `false`; allowlist absent; shared Test Mode
  `true`; local/remote documentation HEAD `bbadb64`; only the unrelated unstaged
  `AGENTS.md` change present.
- Entry was set to `true` and the exact source was deployed from a clean detached
  `f5b22a9` worktree as `dpl_HBTap8Rv72uDN1NFHSg3CyR6GqZp`. It reached Ready and
  all four Production aliases pointed to it. The deployed functional tree remained
  unchanged; Vercel CLI metadata did not supply `gitSource.sha`, so the pinned clean
  worktree and uploaded source scope remain the exact-source evidence.
- Adult Group and Private authenticated previews each returned `200` and remained
  Legacy under the inspected server-only course routing contract. They showed one
  session at `600` and `900` respectively. No confirmation button was clicked.
  Unauthenticated booking preview returned the expected `401`.
- The authenticated Standard Admin identity had no child learner. The Kids Group
  learner step showed no child data and disabled continuation. Proceeding would have
  required the prohibited creation or repurposing of Production data. The original
  Owner-controlled User/Parent context and its `4` previous + `4` new safe draft were
  not available, so the required runtime proof of Progressive routing and exact
  `4 * 500 = 2,000` preview could not be completed. No `1,500` or `2,000` preview
  result was manufactured. The browser identity later changed externally to a
  Super Admin session, confirming it was not a stable substitute for that context.
- This inability to prove Entry-on Kids Group routing met the mandatory Safety Gate.
  The approved primary rollback set Entry to `false`, retained all four dependencies
  `true`, retained allowlist absent and shared Test Mode `true`, and redeployed the
  exact same source as `dpl_3RS4MWuNaPPmGS3DxgdJja1dk35G`. The final deployment is
  Ready and owns all four aliases. Entry is now a Vercel Sensitive/write-only value;
  plaintext readback is unavailable, but the exact rollback command set `false`
  before this final deployment. No old-source rollback was performed.
- Baseline/final counts: bookings `519 -> 519`, pricing scopes `2 -> 2`, batches
  `4 -> 4`, attempts `1 -> 1`, allocations `1 -> 1`, legacy payments `469 -> 469`,
  ledger rows `470 -> 470`, and coupon reservations/usages `0 -> 0`. Booking
  status/course/source-scope distribution was unchanged. Pricing tier count/fingerprint
  remained `11` / `5c665704b2f0adffd67d9c7ec3a337db`. Protected fingerprints
  remained UAT booking `b3ace1823603773273d19783fecfa9f4`, approved batch
  `dbcdcb47fde7f6b59d0244bf90b6b7f6`, and repaired booking
  `e99a8144b0c0af731aad4d4ae3c81025`. The target still has one attempt, one
  allocation, one Progressive ledger source, and zero duplicate keys.
- Notifications changed `16032 -> 16034` from two real operational coach-assignment
  events by other users: `8f8cae4d-5ea2-4c6c-95d3-11da26a3e0bb` and
  `142ae692-96ac-4dfe-a7dd-abea07b3b79d`. Their timestamps correlate to
  `save_coach_assignment_groups` activity logs. They are separated from the UAT,
  were not modified, and do not represent activation-created data.
- Bounded Vercel monitoring sampled `100` activation-deployment and `100`
  rollback-deployment requests. Both windows had error-level `0`, 5xx `0`, typed
  dependency 503 `0`, and SlipOK activity `0`. Browser console warnings/errors and
  observed React/hydration errors were `0`. The approved Progressive batch remained
  readable in Admin Payments after rollback.
- UAT-attributable business-data delta, customer impact, and financial impact were
  all `0`. No Booking, Payment, scope, batch, attempt, allocation, ledger, coupon,
  wallet, attendance, entitlement, Finance, notification, refund, payroll, or
  accounting write was performed. General Kids Group returns to Legacy with Entry
  off; Adult Group and Private remain Legacy; existing Progressive records remain
  readable/drainable under the same source.
- Source complete/committed/pushed/deployed: yes. Entry enabled/Production active:
  no after safe rollback. Production UAT passed: no, because the required Kids Group
  runtime proof was not available. Data repaired in this round: no. Task Done: no.
  Remaining gate: verify an existing Owner-controlled User/Parent session with an
  existing child/safe draft, then obtain separate Owner approval before retrying
  Entry activation. Do not create data to reproduce the preview.
- Classification:
  **BLOCKER — ENTRY DISABLED; PROGRESSIVE ACTIVATION ROLLED BACK SAFELY**.

### 2026-07-13 - User/Parent Safe 4+4 Draft Verification

- Owner confirmed Chrome was logged in as a User and authorized only read-only
  identity, existing-child, entitlement-history, browser-local draft, Entry-off
  preview, monitoring, reconciliation, and documentation work. Entry activation,
  environment changes, deploy, Booking confirmation, Payment action, child/account
  changes, source work, migration, and Production data writes were not authorized.
- Gate 0 matched the rollback record: `dpl_3RS4MWuNaPPmGS3DxgdJja1dk35G` was Ready
  on all four aliases from exact functional source `f5b22a9`; all four dependency
  controls were `true`; allowlist was absent; shared `SLIPOK_TEST_MODE=true`; and
  the Entry value remained Sensitive/write-only after the exact rollback command.
  The runtime Entry-off Legacy response below independently confirms Entry is off.
- The visible Chrome identity uniquely matched Production profile
  `e8a4b5c9-880d-4a43-b693-96cb0ce26316`, role exactly `user`. It owns one existing
  child. Profile and child creation/update fingerprints were captured before the
  flow and remained unchanged; no account, role, profile, or child was created,
  repurposed, or edited.
- July Kids Group active deterministic order is booking
  `9634dca8-d3ce-4922-aaa4-f743edf3dd86` then
  `db5c80c2-5b5d-42c2-b569-7be643a9da6c`, ordered by `created_at`, then id. Both
  are `verified`, each has `2` sessions and stored amount `1,250`, so previous
  active sessions = previous settled sessions = `4` and previous settled amount =
  `2,500`. Two later cancelled four-session bookings are excluded.
- No usable restored draft appeared in the normal booking UI. A new browser-local
  draft selected the existing child, Kids Group, Chaengwattana, and four valid
  template-backed future sessions: July `17` 10:00-12:00, `18` 09:00-11:00,
  `19` 09:00-11:00, and `20` 10:00-12:00. Slots were open, capacity was available,
  no duplicate or disabled selection was bypassed, and coupon input remained empty.
- Entry-off summary passed exactly: previous settled `4` / `2,500`, selected new
  `4`, cumulative `8`, authoritative `7-10` tier rate `500`, target total `4,000`,
  and Legacy charge `1,500`. The UI displayed the true-up and prior-payment
  deduction as expected while Entry is off. Owner-policy Progressive arithmetic for
  the same sequence is `4 * 500 = 2,000`, with no deduction or retroactive true-up.
  The booking confirmation button was present but never clicked; the summary tab
  was preserved as an unconfirmed browser-local handoff.
- A new rollout-readiness blocker was proved before any activation retry. Both
  active bookings have `pricing_scope_id=null` and `entitlement_sessions=null`, and
  the matching July `booking_pricing_scopes` count is `0`. The deployed
  `previewProgressiveKidsGroupBooking()` source compares every active booking scope
  with the current scope and fails with `PROGRESSIVE_LEGACY_SCOPE_NOT_READY` before
  pricing when they differ. Therefore the policy result `2,000` is arithmetic only;
  the current Entry-on source would fail closed for this exact account rather than
  return `2,000`. No source defect was changed and no migration/data repair was
  proposed or performed in this round.
- Before/after Production counts were identical: bookings `519`, booking sessions
  `2782`, pricing scopes `2`, batches `4`, attempts `1`, allocations `1`, payments
  `470`, ledger rows `471`, coupon reservations/usages `0`, notifications `16088`.
  Profile, child, User booking, and User booking-session fingerprints matched.
  One unique authenticated `POST /api/bookings/preview` returned `200`; exact
  `/api/bookings` write requests were `0`. Bounded logs sampled `100` requests with
  error-level `0` and 5xx `0`; browser warnings/errors and React/hydration errors
  were `0`.
- Source changed/committed/deployed: no. Environment/Entry/allowlist changed: no.
  Production business data, customer impact, and financial impact: `0`. Entry stays
  configured `false`; general Kids Group remains Legacy.
- Scoped draft result:
  **PASS — USER/PARENT SAFE 4+4 DRAFT VERIFIED**.
- Overall activation result:
  **BLOCKER — LEGACY ACTIVE SCOPE NOT READY; OWNER COMPATIBILITY DECISION REQUIRED**.
  The Owner must define how active Legacy bookings participate in initial
  Progressive Entry before any separately approved source/migration/data scope or
  activation retry. Do not confirm the prepared draft or activate Entry yet.

### 2026-07-13 - Option A Legacy-to-Progressive Compatibility Decision and Audit

- Owner selected Option A. After Entry activation, every new general Kids Group
  booking uses Progressive. Eligible active Legacy Kids Group bookings in the same
  user/course/month period contribute only their entitlement sessions as the
  initial `previousActiveSessions` baseline. Active remains non-expired
  `pending_payment`, `paid`, and `verified`; cancelled and expired pending rows are
  excluded. Legacy stored/paid money is never deducted. Old Legacy bookings are not
  repriced, credited, refunded, assigned Progressive scopes/snapshots, or backfilled.
  Adult Group and Private remain Legacy; Production `pricing_tiers` remains authority.
- This was a read-only source/data/blast-radius audit plus documentation round. No
  source, migration, Production schema/data, Vercel control, deployment, Entry,
  allowlist, browser draft, Booking, Payment, coupon, wallet, attendance, entitlement,
  Finance, Ledger, refund, payroll, or accounting state changed.
- Source root cause is layered:
  - `src/lib/progressive-booking-preview.ts` loads active period bookings and raises
    `PROGRESSIVE_LEGACY_SCOPE_NOT_READY` when any `pricing_scope_id` differs from the
    current scope, including `null` Legacy rows when no scope exists.
  - `src/app/api/bookings/preview/route.ts` maps this to a fail-closed `409`; the
    create route remains server-routed and requires the preview revision.
  - `progressive_assert_scope_membership_v1()` repeats the same rejection inside
    atomic create/edit/cancel after the advisory scope lock.
  - `progressive_reprice_scope_v1()` initializes cumulative sessions to `0` and
    iterates only bookings whose `pricing_scope_id` equals the Progressive scope.
    Removing the TypeScript guard alone would therefore still reject the write and,
    if the SQL guard alone were removed, would still price from the wrong zero baseline.
  - Mutation receipts and expected scope revisions already provide idempotent replay
    and stale-scope detection. Payment batches intentionally select only pending
    Progressive members in one stored scope; Legacy rows must remain outside batch,
    allocation, payment, and ledger membership.
- Canonical Legacy entitlement source is `bookings.total_sessions`, summed once per
  eligible Legacy booking. All `423` active Legacy Kids Group bookings currently
  have `entitlement_sessions=null`; nevertheless every `total_sessions` value equals
  its original/root (`rescheduled_from_id is null`) session-row count. Counting all
  `booking_sessions` would overcount `87` rescheduled bookings. `25` active Legacy
  bookings have wallet dependencies, but wallet storage/redemption does not change
  the purchased booking entitlement. No active Legacy root session falls outside
  its booking month. Monetary columns and payment/ledger rows are not entitlement
  inputs. This preserves sibling aggregation because the booking total already
  counts all child sessions once; `68` active user/month periods contain multiple
  children.
- Production query captured at `2026-07-13T12:03:24Z`: all `459` Kids Group
  bookings and `2,647` related sessions, plus `2` pricing scopes, `4` Progressive
  batches, `1` verification attempt, `1` allocation, `419` Legacy payment rows,
  `420` combined ledger rows for those Kids Group bookings, `0` coupon usages,
  `0` Progressive coupon reservations, and `42` lesson-wallet credits. Active
  status/source counts are `419` verified Legacy, `4` pending-payment Legacy, and
  `1` verified Progressive; one additional Progressive booking is cancelled.
- User/month period blast radius:
  - all recorded active periods: Legacy-only `373`, Progressive-only `1`, mixed
    `0`, active Legacy plus cancelled Legacy `23`, active Legacy plus pending
    Progressive `0`, multiple-child `68`, wallet/reschedule history `96`,
    coupon-affected `0`, and existing scope with unmatched active Legacy `0`;
  - June: `188` Legacy-only periods / `204` active Legacy bookings / `1,133`
    entitlement sessions;
  - July: `184` Legacy-only periods / `218` active Legacy bookings / `1,279`
    entitlement sessions;
  - August: `1` Legacy-only period with `4` sessions and `1` separate
    Progressive-only period with `1` session;
  - current/future July-August potential exposure: `185` Legacy-only periods,
    `219` active Legacy bookings, and `1,283` entitlement sessions. This is a
    compatibility population, not a repair list and not a prediction that every
    period will create another booking.
- Authoritative active Kids Group tiers observed read-only: `1 -> 700`, `2-6 ->
  625`, `7-10 -> 500`, `11-14 -> 433`, `15-18 -> 406`, and `19+ -> 350`.
  Scenario matrix (coupon is applied only after the shown gross price):

| Scenario | Legacy active | Progressive active | New | Cumulative | Rate | Gross | Coupon/final | Preserved Legacy money |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| No prior + new 4 | 0 | 0 | 4 | 4 | 625 | 2,500 | none / 2,500 | 0 |
| Legacy 4 + new 4 | 4 | 0 | 4 | 8 | 500 | 2,000 | none / 2,000 | 2,500, not deducted |
| Legacy 5 + new 5 | 5 | 0 | 5 | 10 | 500 | 2,500 | none / 2,500 | 3,125, not deducted |
| Legacy 8 + new 8 | 8 | 0 | 8 | 16 | 406 | 3,248 | none / 3,248 | 4,000, not deducted |
| Non-expired pending Legacy 4 + new 4 | 4 | 0 | 4 | 8 | 500 | 2,000 | none / 2,000 | historical amount only |
| Verified Legacy 4 + pending Progressive 4 + new 4 | 4 | 4 | 4 | 12 | 433 | 1,732 | none / 1,732 | 2,500, not deducted |
| Cancelled Legacy 4 + new 4 | 0 | 0 | 4 | 4 | 625 | 2,500 | none / 2,500 | preserved but excluded |
| Expired pending Legacy 4 + new 4 | 0 | 0 | 4 | 4 | 625 | 2,500 | none / 2,500 | preserved but excluded |
| Sibling Legacy 2+2 + new 4 | 4 | 0 | 4 | 8 | 500 | 2,000 | none / 2,000 | 2,500, not deducted |
| Wallet/reschedule history on Legacy 4 + new 4 | 4 | 0 | 4 | 8 | 500 | 2,000 | none / 2,000 | 2,500, not deducted |
| Legacy 4 + new 4 with coupon | 4 | 0 | 4 | 8 | 500 | 2,000 | existing coupon contract / `2,000 - discount` | 2,500, not deducted |

- Retry/concurrency contract: preview must return the current scope revision plus
  the expected Legacy baseline/fingerprint. Create must acquire the existing
  user/course/month advisory lock, capture or verify the baseline exactly once,
  reject a stale preview, include the baseline contract in the mutation fingerprint,
  and retain the existing receipt replay. One request creates one scope/booking;
  concurrent stale requests fail and re-preview rather than double-count Legacy.
- Rollback contract remains safe: Entry `false` routes new general bookings to
  Legacy while stored-scope Progressive edit/cancel/payment drain continues. No
  Progressive or Legacy record is rewritten. Before any later reactivation, a
  fresh read-only audit must detect any Legacy booking created in a period that now
  already has a Progressive scope; such a newly mixed period must fail closed until
  its baseline initialization is proved, never silently fall back or double-count.
- Smallest safe later implementation boundary is a combination, not source-only:
  1. update `src/lib/progressive-booking-preview.ts`, preview/create payload typing,
     and `src/lib/progressive-booking-write.ts` to return/pass a baseline count or
     fingerprint alongside expected revision;
  2. add a narrow additive migration with scope-level Legacy baseline metadata and
     a single authoritative active-Legacy entitlement helper;
  3. replace `progressive_acquire_scope_v1`,
     `progressive_assert_scope_membership_v1`, and
     `progressive_reprice_scope_v1`, plus the create/capability signatures required
     to capture and verify the baseline atomically;
  4. keep coupon functions, payment-prefix membership, approval/allocation/ledger,
     Finance, wallet, attendance, and Legacy pricing semantics unchanged.
  Existing Progressive edit/cancel can continue through stored scope and the replaced
  shared repricer. No Legacy booking backfill and no Production business-data repair
  are required. Applying the additive migration and deploying source are separate
  later approvals.
- Required deterministic tests: all eleven pricing rows above; cancelled/expired
  exclusion; sibling aggregation; wallet/reschedule no double count; coupon after
  gross; preview/create stale-baseline conflict; concurrent first-scope creation;
  mutation replay; later Progressive ordering; existing Progressive edit/cancel;
  payment-prefix/drain; Entry-off rollback; Adult/Private Legacy routing; Finance,
  ledger, coupon, and Legacy pricing regressions. Exact `4 + 4` must return `2,000`
  after implementation and must never read/deduct the Legacy `2,500`.
- Current Vercel deployment remains `dpl_3RS4MWuNaPPmGS3DxgdJja1dk35G`, Ready on
  all four aliases. Four dependency controls remain present/true, Entry remains the
  explicit rollback `false`, allowlist is absent, and shared Test Mode remains true.
  Recent deployment error logs returned zero rows. The preserved unconfirmed
  browser-local `1,500` draft was not modified or confirmed.
- Read-only before/after counts were identical: Kids Group bookings `459 -> 459`,
  related sessions `2,647 -> 2,647`, Kids Group pricing scopes `2 -> 2`, all
  Progressive batches `4 -> 4`, attempts `1 -> 1`, allocations `1 -> 1`, all
  payments `470 -> 470`, combined ledger rows `471 -> 471`, coupon usages `0 -> 0`,
  and Progressive coupon reservations `0 -> 0`.
- Source changed: no. Migration created/applied: no. Production data repair: no.
  Deploy/Entry/allowlist change: no. Customer impact and financial impact: `0`.
  Source complete for Option A: no. Task Done: no. Next gate is separate Owner
  approval for the audited source plus additive-migration implementation scope.
- Decision/audit documentation commit
  `b0cab81014a2dde2e245fd4e156a98b1048f1dfc` was pushed to
  `origin/spike/next-major-security-upgrade`; the pre-existing unrelated remainder
  of the `AGENTS.md` worktree change stayed unstaged and excluded.
- Classification:
  **PASS — OPTION A COMPATIBILITY AUDITED; SOURCE FIX OWNER APPROVAL PENDING**.

#### 2026-07-13 - Option A Implementation Gate 0 Documentation Drift

- Owner approved the audited TypeScript plus additive-migration/RPC source scope,
  local/disposable verification, documentation, commit, and push only.
- Fresh `git fetch origin` proved branch `spike/next-major-security-upgrade`, local
  HEAD, and remote HEAD all at `e61d612118b57fb36137e4bb2306715feee5f43f`.
  Its direct parent is the actual Option A audit commit
  `b0cab81014a2dde2e245fd4e156a98b1048f1dfc`.
- The previously recorded full hash
  `b0cab819a201c625c9309463605af6e5495f81a4` was not a Git object. The shared
  seven-character prefix and commit subject matched, but the full provenance did
  not. The three context-document references were corrected.
- Per the explicit Gate 0 rule, source implementation stopped before any
  TypeScript or migration edit. No migration/runtime test, commit of source,
  remote migration, deploy, environment, Entry, allowlist, Production data,
  customer, or financial state changed.
- Classification:
  **DOCUMENTATION DRIFT — SOURCE FIX STOPPED BEFORE IMPLEMENTATION**.

#### 2026-07-13 - Option A Gate 0A Provenance Acceptance and Resume

- Owner accepted corrected Option A audit commit
  `b0cab81014a2dde2e245fd4e156a98b1048f1dfc` and documentation correction commit
  `21e32c7c5ee3254b981f8dabf19f515c6c77e8eb`.
- Fresh fetch proved branch, local HEAD, and remote HEAD at the accepted
  documentation correction commit; the corrected audit, previous closeout, and
  correction commits are all in ancestry. The only pre-existing worktree change
  remained the unrelated unstaged `AGENTS.md` remainder.
- Owner explicitly authorized the previously approved Option A TypeScript,
  additive-migration/RPC source, deterministic/disposable tests, documentation,
  commit, and push scope to resume from Gate 1.
- Remote migration application, Production schema/data writes, deploy, Vercel
  controls, Entry activation, allowlist changes, Booking/Payment actions, and live
  SlipOK remain unapproved.
- Classification:
  **OWNER APPROVAL ACCEPTED — OPTION A SOURCE IMPLEMENTATION AUTHORIZED**.

#### 2026-07-13 - Option A Compatibility Source Implementation Closeout

- Source complete: **yes**. Source commit
  `f8568a6d9c18da3745492d47c01d3ca22da156c8` was pushed to
  `origin/spike/next-major-security-upgrade`. It follows provenance-resume docs
  commit `210b7fc`; the unrelated pre-existing `AGENTS.md` remainder stayed
  unstaged and excluded.
- Migration source created: **yes**, exactly one new additive migration,
  `20260713210000_add_progressive_legacy_baseline_compatibility.sql`. Migration
  applied remotely: **no**. Existing applied migration files were not edited.
- Additive scope contract: nullable `legacy_baseline_sessions`,
  `legacy_baseline_fingerprint`, and `legacy_baseline_initialized_at`, with an
  all-or-none constraint and an immutability trigger. No monetary Legacy baseline
  field exists and the migration performs no Legacy booking, payment, ledger,
  Finance, coupon, wallet, attendance, refund, credit, or accounting DML.
- Canonical helper: `progressive_legacy_baseline_v1(uuid,uuid,integer,integer)` is
  service-role-only/SECURITY DEFINER and sums only `bookings.total_sessions` for
  exact-scope null-`pricing_scope_id` Kids Group bookings that are `paid`,
  `verified`, or non-expired `pending_payment`. The deterministic SHA-256 input is
  sorted by booking id and includes stable id/status/entitlement/expiry evidence;
  raw `booking_sessions`, reschedule descendants, wallet history, and Legacy money
  are not pricing inputs.
- Replaced effective shared functions without removing later coupon/payment fixes:
  `progressive_acquire_scope_v1(uuid,uuid,integer,integer,bigint)`,
  `progressive_assert_scope_membership_v1(uuid,uuid,uuid,integer,integer)`, and
  `progressive_reprice_scope_v1(uuid,bigint,timestamptz,uuid)`. Acquire initializes
  the Legacy count/fingerprint once under the existing advisory lock; existing
  initialized scopes require an exact match and fail
  `PROGRESSIVE_LEGACY_BASELINE_DRIFT`. Pre-compat scopes lazily initialize only an
  authoritative empty baseline.
- New create signature is
  `create_progressive_booking_v1(uuid,learner_type,uuid,uuid,uuid,jsonb,uuid,uuid,bigint,integer,text)`.
  It preserves mutation-receipt replay, advisory/revision locks, slot capacity,
  coupon reservation, activity logging, and no-payment-artifact behavior. Expected
  count/fingerprint are part of the mutation fingerprint and are compared with the
  stored authoritative baseline before inserting the new Progressive booking.
  Capability `progressive_pricing_writes_capability_v1()` is source version `2`
  with contract `immutable_scope_v1`.
- Preview response now separates Legacy baseline, previous Progressive active, and
  new sessions and preserves cumulative-after, rate, gross, discount/final,
  source/mode, scope, and revision. Client payload carries only the opaque expected
  count/fingerprint needed for stale-preview validation; it does not supply trusted
  Legacy ids, price/payment amounts, or arbitrary pricing authority.
- Repricing starts cumulative entitlement at the stored Legacy baseline and walks
  only active scope-owned Progressive rows in `created_at`, then booking-id order.
  Existing edit/cancel and payment rejection continue through this shared repricer;
  Legacy rows are outside membership and are never repriced, snapshotted, assigned
  a scope, or written.
- Exact verified Option A result: Legacy entitlement `4`, historical Legacy amount
  `2,500`, new `4`, cumulative `8`, rate `500`, gross/final without coupon `2,000`.
  The `2,500` remained unchanged and was never deducted. Cancelled and expired
  pending Legacy were excluded; multi-child `2+2` counted `4`; wallet/reschedule
  descendants did not change entitlement; coupon applied only after gross.
- Disposable migration/runtime result: `npx supabase db reset` compiled the full
  chain through `20260713210000`. A transaction-wrapped SQL fixture rolled back
  cleanly after testing Legacy-only/mixed and Progressive-only scope creation,
  exclusions, reschedule/wallet, children, stale revision/baseline, no partial write,
  replay/idempotency conflict, edit/cancel, immutable drift, pre-compat zero-only
  initialization, coupon recalculation, and payment prepare/cancel drain. A real
  two-connection concurrency test passed `8/8`: exactly one first request created
  one scope/booking/receipt at `2,000`; the other failed typed stale revision. All
  fixtures were rolled back/deleted, residue counts were zero, and the disposable
  stack was stopped without backup.
- Deterministic/regression results: Option A `32`, booking entry `25`, booking
  pricing `17`, pricing transactions `33`, coupon lifecycle `38`, payment batches
  `39`, payment integration/Finance/redaction `18`, payment notifications `16`,
  shared SlipOK `6`, Legacy pricing/payment `14`, plus the concurrency `8` above.
  The read-only Progressive pricing shadow audit also completed. `tsc --noEmit`,
  ESLint, mojibake (`225` files), `next build --webpack`, and `git diff --check`
  passed. After build, port `3000` was stopped, only this repo's `.next` was removed,
  dev restarted, `/` and generated `/_next/static/*` returned `200`, unauthenticated
  booking preview returned `401`, browser console errors were `0`, and no visible
  Next error overlay existed.
- Source files changed: Progressive preview/write helpers, booking preview/create
  routes, booking client payload typing, manual database types, booking-entry and
  transaction regressions, three Option A deterministic/runtime/concurrency test
  scripts, and the single new migration. Adult Group, Private, Legacy pricing,
  pricing tiers, payment/Finance/Ledger implementation, environment, allowlist, and
  Production business data were not changed.
- Deploy performed: **no**. Entry: **variable absent, effective false**. Production
  active: **no**. Production data changed: **no**. Customer impact: **none**.
  Financial impact: **none**. Read-only Vercel closeout confirmed production
  deployment `dpl_3RS4MWuNaPPmGS3DxgdJja1dk35G` remains `Ready` with the same four
  aliases; Entry and allowlist names are absent, while the four dependency names
  and shared SlipOK Test Mode name remain present/encrypted.
  Remaining migration/deploy gate: fresh read-only mixed-scope audit plus separate
  Owner approval to apply `20260713210000` and deploy with Entry still false.
  Remaining activation/UAT gate: later separate Owner approval for Entry activation
  and a no-write authoritative `4+4 = 2,000` Production preview with rollback.
- Classification:
  **PASS — OPTION A COMPATIBILITY SOURCE COMPLETE; MIGRATION/DEPLOY/ACTIVATION PENDING**.

#### 2026-07-13 - Option A Migration/Deploy Gate 0 Entry-State Documentation Drift

- Owner approved a fresh read-only mixed-scope audit, exact migration
  `20260713210000`, capability/version and zero-data-delta verification, exact
  Entry-off Option A deployment, bounded monitoring, and documentation closeout.
  Owner required `PROGRESSIVE_PAYMENT_ENTRY_ENABLED` and the UUID allowlist to stay
  absent and did not approve any environment-variable change or Entry activation.
- Fresh fetch proved branch `spike/next-major-security-upgrade`, local HEAD, and
  remote HEAD all at `1503b81ab71e16b8b89fe41d9dcc4e232a5acacc`; source commit
  `f8568a6d9c18da3745492d47c01d3ca22da156c8` is an ancestor and all descendants
  are documentation-only. The only worktree change remained the unrelated unstaged
  `AGENTS.md` remainder (`72` additions / `3` deletions).
- Migration SHA-256 is
  `30C0A711B391FA1F89F98A0589AABAEBD588E0FAD0390D8583D3E2937844A78E`.
  Remote history matched every prior migration through `20260713153000`; exactly
  `20260713210000` remained pending. No applied migration or source file differed.
- Read-only Vercel inspection confirmed deployment
  `dpl_3RS4MWuNaPPmGS3DxgdJja1dk35G` remains Production `Ready` on all four aliases.
  The four dependency names and shared `SLIPOK_TEST_MODE` remain present/encrypted,
  and the UUID allowlist remains absent. However,
  `PROGRESSIVE_PAYMENT_ENTRY_ENABLED` is also present/encrypted. This materially
  conflicts with the approved absent-state prerequisite and the previous current
  snapshot. Vercel CLI does not expose its plaintext, so its exact value is
  `Unknown / Need verification`.
- Safety Gate result: stopped before the mixed-scope audit, Production baseline,
  migration application, capability change, deployment, browser UAT, or monitoring.
  No environment variable, Production schema/data/business row, Booking, Payment,
  coupon, wallet, attendance, notification, Finance, Ledger, refund, credit,
  payroll, or accounting state was changed. Customer and financial impact from this
  round: none.
- Next Owner decision required: explicitly authorize removal of the unexpected
  Entry variable or provide another safe resolution that restores the required
  pre-deploy contract. Then rerun Gate 0/0A and the fresh mixed-scope audit; do not
  resume at migration application.
- Classification:
  **DOCUMENTATION DRIFT — ENTRY VARIABLE PRESENT; MIGRATION/DEPLOY STOPPED**.

#### 2026-07-13 - Isolated Production Entry Variable Cleanup

- Owner explicitly authorized one isolated environment action only: remove exactly
  `PROGRESSIVE_PAYMENT_ENTRY_ENABLED` from the Vercel Production project, preserve
  all other variables, do not replace it with `false` or `true`, and do not apply a
  migration, deploy, activate Entry, change the allowlist/dependencies/SlipOK, or
  write Production business data.
- Fresh Git preflight proved branch `spike/next-major-security-upgrade`, local and
  remote HEAD `a3d344205c5189c4bb0620f676bf4e1b5fceb8d5`, and source ancestor
  `f8568a6d9c18da3745492d47c01d3ca22da156c8`. The only dirty file remained the
  unrelated unstaged `AGENTS.md` remainder (`72` additions / `3` deletions).
- Pre-change Vercel JSON listed `11` Production names. Entry existed as a
  Production-only Sensitive variable; the four Progressive dependency names and
  shared `SLIPOK_TEST_MODE` name were present, and the UUID allowlist was absent.
  Deployment `dpl_3RS4MWuNaPPmGS3DxgdJja1dk35G` was Ready on the same four aliases,
  and remote migration history ended at `20260713153000` with only
  `20260713210000` pending.
- `vercel env rm PROGRESSIVE_PAYMENT_ENTRY_ENABLED production --yes` completed
  successfully. A fresh full JSON comparison proved exactly `11 -> 10`: removed
  Entry only, added `0`, and no type, target, configuration id, creation time, or
  update time changed for any remaining variable. No replacement value was added.
- No deployment was created. The same deployment remains Ready on the same aliases,
  and the Option A migration remains pending. Because Vercel environment changes do
  not alter an existing deployment artifact, its embedded Entry value remains
  `Unknown / Need verification`; the cleanup restores the absent prerequisite only
  for a future separately approved deployment.
- Safe checks before/after returned public home `200` and unauthenticated booking
  preview `401`. Bounded current-deployment searches found `0` error-log rows and
  `0` SlipOK rows. Read-only counts at `2026-07-13T13:58:05.722Z` and
  `2026-07-13T13:59:54.205Z` were identical for all `17` checked tables/views:
  bookings `519`, sessions `2785`, scopes `2`, mutation receipts `3`, coupon
  reservations `0`, payment batches/members `4/4`, allocations/attempts `1/1`,
  payments `470`, coupon usages `0`, wallet credits `60`, attendance `1617`,
  notifications `16137`, pricing tiers `11`, ledger allocations `471`, and Finance
  expenses `1`.
- Source changed: **no**. Migration applied remotely: **no**. Deploy/redeploy:
  **no**. Entry activation: **no**. Allowlist/dependency/SlipOK change: **no**.
  Production schema/business data changed: **no**. Customer impact: **none**.
  Financial impact: **none**. The next migration/deploy round requires separate
  Owner approval and must restart at Gate 0/0A with a fresh mixed-scope audit.
- Classification:
  **PASS — ENTRY VARIABLE REMOVED; MIGRATION/DEPLOY GATE MUST RESTART FROM GATE 0**.

#### 2026-07-13 - Option A Migration Applied and Entry-Absent Source Deployed

- Owner approved one gated execution covering fresh Gate 0/0A, mixed-scope audit,
  exact migration `20260713210000`, capability/data verification, exact Option A
  deployment with Entry absent, read-only smoke/monitoring, and documentation push.
  Entry activation, environment changes, Booking/Payment actions, repair, backfill,
  and additional source/migration changes remained prohibited.
- Git started at branch `spike/next-major-security-upgrade`, local/remote HEAD
  `d4574a76927b3f01e9fd5d8a2328d953c256243f`. Source `f8568a6` is an ancestor and
  the descendant functional tree is identical. Only the unrelated unstaged
  `AGENTS.md` remainder (`72` additions / `3` deletions) existed and stayed excluded.
- Migration SHA-256 matched
  `30C0A711B391FA1F89F98A0589AABAEBD588E0FAD0390D8583D3E2937844A78E`.
  Exactly `20260713210000` was pending. Gate 0A proved the additive columns and
  unchanged acquire/membership/reprice signatures safe for the old Entry-off
  deployment during the short migration-to-deploy interval.
- Fresh Production audit found active Kids Group periods: Legacy-only `373`,
  Progressive-only `1`, mixed `0`; active Legacy bookings `423` / `2,416` sessions;
  existing Progressive scopes with eligible Legacy `0`; multiple-child `68`;
  wallet/reschedule `97`; coupon-affected `0`. Current/future: `185` Legacy-only,
  `1` Progressive-only, mixed `0`, active Legacy bookings `219` / `1,283` sessions.
  Both existing scopes had authoritative eligible Legacy baseline count `0` and
  were unlocked; their revisions remained `4` and `3`.
- `supabase db push --linked --yes` applied exactly migration `20260713210000` once.
  Remote schema contains only the three approved nullable scope baseline fields,
  all-or-none constraint, immutability trigger, authoritative helper, compatible
  scope/membership/reprice/create replacements, and capability update. Existing
  scope baseline fields stayed null; no backfill ran. Anon helper access remained
  denied and service-role grants/search paths remained correct.
- Pricing-write capability is `{ ready: true, version: 2,
  legacyBaselineContract: "immutable_scope_v1" }`. Payment batch and integration
  capabilities remain Ready at version `1`. Pre/post migration protected hashes
  matched for all `21` checkpoints, including Booking/sessions/scopes/snapshots,
  receipts, Payment/batches/attempts/allocations, Ledger, Finance, coupon, wallet,
  attendance, notifications, and pricing tiers.
- A clean detached worktree at exact `d4574a7` deployed the functional-tree-identical
  Option A source. Production deployment `dpl_Cat3qUUPVamdZ8SkVCFTRQQyu4vE` is
  Ready on all four aliases. Entry and allowlist remain absent; the four dependency
  controls and shared `SLIPOK_TEST_MODE` name remain present. No environment value
  was added, removed, or changed in this deployment round.
- Entry-off smoke: public home `200`; generated assets identify the new deployment;
  unauthenticated preview `401`; preserved authenticated Kids `4+4` draft remained
  Legacy `1,500`; Adult/Private source decision remains Legacy; User History showed
  the approved Progressive `700` booking. The approved batch and both existing
  scopes remained readable, and payment drain capabilities remained Ready. No
  confirm/edit/cancel/Payment/batch action was submitted.
- Bounded deployment log searches returned error `0`, 5xx `0`, and SlipOK `0`.
  Browser console/hydration warnings were `0`. Final protected counts were unchanged
  except five attendance rows plus one coach reminder created by timestamp-correlated
  real coach operations after the baseline; attributable migration/deploy business
  delta is `0`. Customer impact: none. Financial impact: none. Rollback: not used.
- Source complete: **yes**. Tests passed: **yes**. Committed/pushed source: **yes**.
  Migration applied: **yes**. Deployed: **yes**. Feature enabled/Production active:
  **no**. Production Entry-on UAT: **no**. Data repaired this round: **no**. Task
  done: **no**. Remaining gate is separate Owner approval for final Entry activation,
  authoritative no-write Production `4+4 = 2,000` UAT, monitoring, and closeout.
- Classification:
  **PASS — OPTION A MIGRATION APPLIED AND ENTRY-ABSENT SOURCE DEPLOYED; ACTIVATION UAT PENDING**.

#### 2026-07-13 - Final Option A Activation UAT Failed; Entry Rolled Back

- Owner approved one final gated round: add only Production
  `PROGRESSIVE_PAYMENT_ENTRY_ENABLED=true`, redeploy exact clean Option A source,
  run authenticated no-write `4+4` UAT, retain Entry only if every mandatory proof
  passed, otherwise immediately remove Entry and restore the known-good Entry-absent
  deployment. Source edits, migrations, Booking/Payment actions, and Production
  business-data writes remained prohibited.
- Git Gate 0 passed on branch `spike/next-major-security-upgrade` at matching
  local/remote HEAD `9ecc6181c093e23fb2b75e30c6ed1b9332051b06`.
  `f8568a6d9c18da3745492d47c01d3ca22da156c8` is an ancestor, and clean deploy
  commit `d4574a76927b3f01e9fd5d8a2328d953c256243f` has an identical functional
  tree. The only dirty file was the unrelated unstaged `AGENTS.md` remainder
  (`72` additions / `3` deletions), which stayed excluded.
- Production preflight passed: `dpl_Cat3qUUPVamdZ8SkVCFTRQQyu4vE` was Ready on
  all four aliases; Entry and allowlist were absent; four Progressive dependencies
  and shared Test Mode were present/true; migration `20260713210000` was applied
  once; pricing capability was Ready/version `2`/`immutable_scope_v1`; payment
  capabilities were Ready/version `1`. Both existing Progressive scopes were
  unlocked/readable with authoritative eligible Legacy baseline `0`.
- Protected pre-activation counts were bookings `519`, booking sessions `2,785`,
  scopes `2`, pricing snapshots `519`, mutation receipts `3`, coupon reservations
  `0`, payment batches/members `4/4`, attempts/allocations `1/1`, legacy payments
  `470`, coupon usages `0`, wallet credits `60`, attendance `1,622`, notifications
  `16,144`, pricing tiers `11`, Ledger rows `471`, Finance expenses `1`, and
  existing Progressive bookings `2`. Target UAT booking/batch and repaired booking
  `d6dad7aa...` fingerprints were captured separately.
- Gate 1 added exactly Sensitive Production Entry with value `true`. Environment
  names changed `10 -> 11`; no other name or metadata changed, allowlist remained
  absent, and the four dependencies/shared Test Mode remained unchanged.
- Gate 2 deployed from a clean detached worktree pinned to exact `d4574a7`.
  Activation deployment `dpl_Hqz23xUgUXYSH1FtoVZUXSgS2Bqh` reached Ready and
  owned all four Production aliases with unchanged migration/capabilities/source.
- Authenticated read-only UAT proved one Production `user`, the unchanged owned
  child, and July eligible Legacy history `2+2=4` sessions with preserved amounts
  `1,250+1,250=2,500`; cancelled rows were excluded and no matching July
  Progressive booking existed. The browser-local draft selected exactly four
  active, template-backed July sessions with no coupon and never called create.
- The authoritative preview selected Progressive and returned the expected
  pricing evidence: Legacy baseline `4`, previous Progressive active sessions `0`,
  new sessions `4`, cumulative `8`, rate `500`, gross `2,000`, coupon discount `0`,
  final `2,000`. There was no Legacy `1,500`, baseline conflict/drift, capability
  error, or booking-create request.
- Mandatory pass condition 12 failed in the customer UI. Alongside the correct
  `฿2,000` total, the summary rendered stale Legacy true-up lines:
  `ยอดรวมตามเรทใหม่: 8 × ฿500 = ฿4,000`,
  `หักยอดที่จ่ายแล้ว: ฿2,500`, and
  `ยอดที่ต้องชำระเพิ่ม: ฿2,000`. This tells the customer that historical Legacy
  money was deducted, contrary to the permanent Option A rule. Source inspection
  localized the issue to the existing Kids Group summary branch in
  `src/components/dashboard/booking-client.tsx`, which does not distinguish the
  Progressive preview mode. No source edit was authorized or performed.
- The immediate primary rollback removed exactly Entry without replacing it with
  `false` and promoted known-good `dpl_Cat3qUUPVamdZ8SkVCFTRQQyu4vE`. It is Ready
  on all four aliases. Final environment names are back to `10`: Entry/allowlist
  absent, dependencies/Test Mode unchanged. The same browser-local draft returned
  Entry-off Legacy `1,500`; Adult Group and Private remain Legacy; unauthenticated
  preview returned `401`; approved Progressive User History and drain capability
  remained readable. No edit/cancel/payment/batch action was submitted.
- Post-rollback protected counts/fingerprints matched every preflight checkpoint
  above except notifications `16,144 -> 16,147`. The three new notification ids
  `d8fd54e1...`, `b3f9cf51...`, and `ec1d2579...` were timestamp-correlated real
  coach-assignment events for separate teaching dates, not activation/UAT writes.
  Activation/UAT-attributable business-data delta is exactly `0`; no Legacy row
  received a Progressive scope or snapshot.
- Bounded activation and rollback monitoring found error `0`, 5xx `0`, dependency
  or baseline fault `0`, and SlipOK activity `0`. Browser/React/hydration errors and
  a Next error overlay were absent. Customer impact: `0`. Financial impact: `0`.
  Rollback used: **yes**. Migration was not reversed.
- Source complete: **no** for activation-ready customer-summary behavior; core
  Option A TypeScript/RPC/migration remains complete. Tests passed: **no** for the
  mandatory Production activation UAT. Committed/pushed: core source **yes**;
  rollback documentation is the follow-up commit. Migration applied: **yes**.
  Deployed: **yes**, final known-good Entry-absent deployment. Feature enabled /
  Production active / Production UAT passed: **no / no / no**. Data repaired this
  round: **no**. Task Done: **no**.
- Next gate requires separate Owner approval for a narrow Progressive summary
  source/test correction, then separately approved Entry-off deployment and final
  activation/no-write UAT retry. Do not reactivate Entry or confirm the draft.
- Classification:
  **BLOCKER — OPTION A ACTIVATION UAT FAILED; ENTRY ROLLED BACK TO ABSENT**.

#### 2026-07-13 - Progressive Summary Fixed; Option A Production Active

- Owner approved one combined closeout round limited to the localized Progressive
  Kids Group Summary correction, narrow deterministic tests, source commit/push,
  corrected Entry-absent deployment, exact-source Entry activation, authenticated
  no-write `4+4` UAT, reconciliation, and documentation. API/RPC/migration/tier,
  Legacy, Adult Group, Private, Booking confirmation, Payment, and Production
  business-data changes remained prohibited.
- Gate 0 passed on branch `spike/next-major-security-upgrade` from matching
  local/remote HEAD `817794a4aaefe885aa46f30f4765e7e8a20902e4`. Core Option A
  `f8568a6` was an ancestor. The only dirty file was the unrelated unstaged
  `AGENTS.md` remainder (`72` additions / `3` deletions), which remained excluded.
- Root cause was exactly the Kids Group summary render in
  `src/components/dashboard/booking-client.tsx`: the component stored only a
  partial authoritative preview and rendered the Legacy monthly true-up block for
  every Kids Group summary. The Progressive server preview/price was already
  correct; no pricing formula or API contract change was required.
- Source commit `aa64adfb765139ca38908ca2409fa2127ffe4a29`
  (`fix(booking): separate progressive summary pricing copy`) changes only
  `src/components/dashboard/booking-client.tsx` and
  `scripts/check-progressive-booking-entry.js`. It introduces a discriminated
  preview state, preserves the server-provided Progressive baseline/ordering/rate/
  gross/final evidence, branches only on authoritative `mode`, and renders separate
  Progressive and Legacy explanations. Coupon and zero-price semantics are
  unchanged; Adult Group and Private remain Legacy. The commit was pushed to
  `origin/spike/next-major-security-upgrade`.
- Verification passed: booking entry `31`, Option A baseline `32`, Progressive
  pricing `17`, transactions `33`, coupon `38`, Legacy pricing/payment `14`,
  `npx.cmd tsc --noEmit`, lint, mojibake `225`, production build `90` routes, and
  `git diff --check`. Post-build protocol stopped port `3000`, removed only this
  repo's generated `.next`, restarted dev on `127.0.0.1:3000`, and verified home
  `200`, generated static asset `200`, unauthenticated preview `401`, and no Next
  error overlay. Deterministic Summary checks supplied the authenticated local UI
  proof because the local Chrome tab could not be attached reliably.
- Corrected clean Entry-absent deployment
  `dpl_GyGnKWq49mTU6NYNavWRVYLwmo3P` reached Ready on all four aliases from exact
  `aa64adf` and became the primary rollback target. Authenticated no-write Entry-off
  UAT preserved the exact Legacy block/result: previous `4` / `2,500`, new `4`,
  cumulative `8`, rate `500`, target `4,000`, deduction `2,500`, charge `1,500`;
  Progressive-only explanation was absent.
- Entry activation added only Production
  `PROGRESSIVE_PAYMENT_ENTRY_ENABLED=true`. The first interactive Vercel attempt
  accidentally answered the default Sensitive prompt instead of the value prompt,
  so its artifact remained default-deny and was rejected by runtime proof. Entry
  was recreated as a non-sensitive flag and pull-back proved exact value `true`.
  Ordinary same-source deployments still reused the Entry-off build cache and were
  also rejected. A final `--force` build of the same clean `aa64adf` source produced
  activation deployment `dpl_CJVW2EMw9pfacn4NeAj4vqPsaSsS`, Ready on all four
  aliases. No source or dependency changed between Entry-off and Entry-on.
- Authenticated Production no-write UAT confirmed the exact Owner case: eligible
  Legacy history `2+2=4`, historical amounts `1,250+1,250=2,500`, cancelled rows
  excluded, previous Progressive `0`, selected new sessions `4`, and coupon `0`.
  The authoritative Progressive result was Legacy baseline `4`, previous
  Progressive `0`, new `4`, cumulative `8`, rate `500`, gross `2,000`, discount
  `0`, final `2,000`.
- The customer Summary visibly showed the Progressive booking-level explanation,
  including `สิทธิ์เดิมที่ใช้กำหนดเรท: 4 ครั้ง`,
  `การจอง Progressive ก่อนหน้า: 0 ครั้ง`, `จองเพิ่มครั้งนี้: 4 ครั้ง`,
  `จำนวนสะสมหลังจอง: 8 ครั้ง`,
  `เรทสำหรับการจองครั้งนี้: 500 บาท/ครั้ง`, and
  `ราคาการจองใหม่: 4 × 500 = 2,000 บาท`. It also stated that historical payment is
  preserved and not deducted. Legacy target-total, prior-payment-deduction, and
  credit-difference wording were all absent. The historical Legacy `2,500` did not
  participate in or appear as a deduction.
- Adult Group and Private remained Legacy through the unchanged server-only entry
  decision and passing deterministic checks. Unauthenticated preview returned
  `401`. Existing Progressive User History and approved batch remained readable;
  pricing capability was Ready/version `2`/`immutable_scope_v1`; coupon, payment
  batch, and payment integration capabilities were Ready/version `1`; both existing
  scopes were unlocked. Migration `20260713210000` remained applied exactly once.
- Protected baseline was captured at `2026-07-13T15:43:51.815Z`; post-UAT was
  captured at `2026-07-13T16:01:11.187Z`. Every count and SHA-256 fingerprint
  matched exactly:

  | Checkpoint | Count | SHA-256 |
  | --- | ---: | --- |
  | bookings | 519 | `d3d5a7c57d7178bc80698672a57634eadb8c4ecca2ea7664201d9fc4ceb040ae` |
  | booking sessions | 2,785 | `ab8269bb6b1fa1e479880d450aa0edecc07b4048e75a966985b136a60f54b752` |
  | pricing scopes | 2 | `86503f5f2eb1197578d774fec9a4a3de8dcf43204c12c07f73bf76e9e74edb48` |
  | mutation receipts | 3 | `0a2e5b22b52817d840b17b40d8b0869475bf08630e4170a8cb7d1bdf83eb3b78` |
  | coupon reservations | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
  | coupon usages | 0 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
  | payment batches | 4 | `662e71bb9eb71ca5d0a830d9129e87ad3c7dc3a243b9c49e3650b37ce0f34faf` |
  | payment batch members | 4 | `f94c8df0f696431f99bf9156a09d04f29069deb98fb2cc2dd7db020af900b075` |
  | verification attempts | 1 | `5b125b6b2bb2e2f5732efdbab8e43cdc4da6afed36b155aef21e6d5218cdfa33` |
  | allocations | 1 | `3100748cd90c49db598f714ebcae865b90d191ff4ad4df9100f7e2fb24419936` |
  | payments | 470 | `3c32d4ea56390b151707b04109b5a8020d5c1ce588c7d943596458ef13f0ed2e` |
  | Ledger | 471 | `ff92de3a57d20a2139f32317379d2588ff69706f391e3fa771703bbc7d88cfbd` |
  | wallet credits | 60 | `08ba708a26efaba9445856a00414092ee867e25741195ea0be88f97c01ac007a` |
  | attendance | 1,622 | `4974ee348f148d676fa3fc2e770cce9619469b3424defa7da4d4910fc017d0e7` |
  | notifications | 16,147 | `402eb8a491c104f5c281fc8f8da6755d9496ea13ec80b287bb32572ca3031df5` |
  | pricing tiers | 11 | `27c184b2bf280bf0352848d0ef04866db278e5ecd5cf20963395301ba520aaa7` |
  | Finance expenses | 1 | `f0dafc3824b411b3d8b131103f5f9043a4536d634e2037138b661d92b8df3846` |
  | existing Progressive bookings | 2 | `41e87af0e6b7d18701a8dec74dd10a810f09c6962d8281b29d5e114be4c8e377` |
  | virtual pricing snapshots | 519 | `33324b5abf3dbd588aa22f3d2c26e0233cf0b12f0c61a03e839a1eed7b31b993` |
  | approved Progressive batches | 1 | `d61ed493eadee3da1c0e5871d3f30f9eefadbe22891df1d6e4c1c573cc4ce020` |
  | repaired booking | 1 | `7ca7308ec459bb39d1c45d0a557774d48b7aba919459f63363a7321c1cb0b541` |

- Final deployment logs sampled `28` requests: errors `0`, 5xx `0`, baseline faults
  `0`, dependency faults `0`, live SlipOK `0`, booking-create POST `0`, and one
  successful preview `200`. Browser console warnings/errors, React/hydration errors,
  and Next error overlay were `0`. No confirmation button was clicked.
- Source complete: **yes**. Tests passed: **yes**. Committed/pushed: **yes** for
  source; documentation closeout is the follow-up commit. Migration applied:
  **yes**. Deployed / Feature enabled / Production active / Production UAT passed:
  **yes / yes / yes / yes**. Data repaired this round: **no**. Task Done: **yes**.
  Customer impact: future new general Kids Group bookings now use Progressive.
  Financial impact: future charges follow Option A; all historical money and
  accounting evidence remain unchanged. Rollback used after the successful final
  artifact: **no**; corrected Entry-absent rollback target remains available.
- Kids Group Pricing Reconciliation is closed and removed from the active blocker
  queue. The next documented task, Homepage LV copy audit/fix, is unpaused but was
  not started.
- Classification:
  **PASS — PROGRESSIVE SUMMARY FIXED; OPTION A ENTRY ACTIVE; PRODUCTION 4+4=2,000 UAT PASSED; PRICING RECONCILIATION DONE**.

#### 2026-07-14 - Production Booking Regression Read-Only Audit

- Owner reported a fresh Production regression on `/dashboard/booking` for the
  controlled July 2026 Kids Group `4+4` case: Step 4 displayed `1,500`, Step 5
  displayed authoritative Progressive `2,000`, and confirmation returned
  `409 PROGRESSIVE_CAPACITY_EXCEEDED`. Owner authorized read-only audit and
  documentation only. No source/test edit, create replay, deploy, Entry change,
  migration, or Production business-data write was authorized.
- Gate 0 passed. Branch `spike/next-major-security-upgrade` started at matching
  local/remote HEAD `8a78d5d7c917787b29cf65425445ed4932179f65`; functional source
  `aa64adfb765139ca38908ca2409fa2127ffe4a29` is its direct ancestor and the HEAD
  delta is documentation only. The unrelated unstaged `AGENTS.md` remainder
  (`72` additions / `3` deletions) remained excluded. Production deployment
  `dpl_CJVW2EMw9pfacn4NeAj4vqPsaSsS` was Ready on all four aliases. Entry was
  exactly `true`, allowlist absent, four Progressive dependencies and shared
  `SLIPOK_TEST_MODE` exactly `true`, migration `20260713210000` applied once,
  pricing capability Ready/version `2`/`immutable_scope_v1`, and payment
  capabilities Ready/version `1`.
  Current Vercel inspection did not expose Git SHA metadata; the exact `aa64adf`
  provenance remains the prior clean-detached deployment record plus the unchanged
  functional tree, rather than a new platform-side SHA assertion.
- Price root cause is the separate Step 4 client render path. In
  `src/components/dashboard/booking-client.tsx`, `existingMonthData` filters same-
  period settled `paid`/`verified` history, `kidsIncremental` calls the Legacy
  monthly true-up helper, and Step 4 renders its `totalBatchPrice`. For the exact
  case this is `8 x 500 - 2,500 = 1,500`. Step 4 does not call
  `/api/bookings/preview`.
- Moving to Step 5 calls `fetchAuthoritativePreview`, which returned Progressive
  baseline `4`, prior Progressive `0`, new `4`, cumulative `8`, rate `500`, coupon
  `0`, gross/final `2,000`. After that preview, create submitted the authoritative
  preview amount/revision/baseline contract; the 409 was not a price conflict.
  Draft restore retained selection/client mutation state but no price or preview;
  it therefore exposed the same deterministic Step 4 Legacy path. Proven cause:
  separate render paths plus preview timing, not corrupted draft state or a stale
  deployment/cache artifact.
- The prior `31` booking-entry checks are source-text assertions around Step 5's
  Summary branches and contracts. They do not execute/render Step 4, transition a
  real component from calendar to Summary, or assert that the two visible totals
  match. A later regression suite must cover the executable calendar -> Summary
  transition for Legacy baseline, zero baseline, coupon, restored draft, and full-
  slot rejection.
- Capacity root cause is independent. The effective
  `progressive_lock_booking_slots_v1` creates/reuses slots, resolves the requested
  template/date/time rows, locks exact slot rows, rejects duplicate learner/date/
  time, and then counts existing active sessions with `cancelled_at IS NULL`,
  session status `scheduled|completed|absent`, and booking status non-expired
  `pending_payment|paid|verified`. It raised `PROGRESSIVE_CAPACITY_EXCEEDED` inside
  `create_progressive_booking_v1`; the route correctly mapped the typed database
  exception to HTTP `409`.
- Exact selected-slot audit using that rule:

  | Date/time | Template id | Schedule slot id | Active/capacity | Result |
  | --- | --- | --- | ---: | --- |
  | 2026-07-20 17:00-19:00 | `8940de2e-022b-4437-bf59-42dd882dfbda` | `ede40674-b21d-4f50-9c98-0cf2f1f20347` | `5/6` | available |
  | 2026-07-21 17:00-19:00 | `680ba191-4e93-4904-92d4-5ff015b69263` | `53c3556a-6067-4ad1-813c-ca8410d17994` | `4/6` | available |
  | 2026-07-22 17:00-19:00 | `fc3937db-bf41-44ef-be1e-5e0f01a5841c` | `25aee5d6-7ca1-4a79-a754-ea1e99697113` | `6/6` | rejected; request would make `7` |
  | 2026-07-23 17:00-19:00 | `b59a3b34-4be7-46a6-9c2b-07045972bf65` | `5266ddfb-8491-4cd2-9214-7c226b2a9bb0` | `1/6` | available |

- Exact booking/session/learner record sets were verified read-only and intentionally
  not copied into documentation as full personal identifiers. All `16` active
  contributors across the four slot counts were other users' verified Legacy
  bookings with scheduled sessions. The current user's Legacy baseline contributed
  zero physical occupancy. There were no duplicate active learners, Progressive
  rows, wallet links, makeup rows, cancelled sessions, or expired pending bookings.
  One valid reschedule descendant contributed on 2026-07-21; its 2026-07-20
  predecessor had session status `rescheduled` and was excluded, so it was not
  double-counted.
- The restored draft's template ids exactly matched the current active templates
  and resolved to the listed current slots. The six July 22 occupants predated the
  incident, so capacity did not race from available to full after Step 4. Step 4
  lists dates from recurring `schedule_templates` and never queries authoritative
  occupancy. The RPC counts live booking/session rows under lock. All four
  `schedule_slots.current_students` cache values were stale at `0`, but neither the
  client nor RPC trusted that cache for the capacity decision. Conclusion:
  expected protection against a genuinely full slot plus stale-availability UX.
- The approved Chrome bridge could not attach to the existing incident tab. Per
  Owner safety rules, the page was not reloaded, the draft was not changed, and no
  create was replayed. Original Network payload/headers and sanitized Session
  Storage detail remain `Unknown / Need verification`; screenshots, source, bounded
  logs, and authoritative database reads supplied the remaining proof.
- Bounded Vercel logs from 09:26:30-09:31:10 Asia/Bangkok contained three unique
  preview `200` events and two unique create `409` events at 09:27:48.849 and
  09:30:45.172. All were Production cache misses served by
  `dpl_CJVW2EMw9pfacn4NeAj4vqPsaSsS`. The log records had empty message/trace fields
  and did not include payload, response body, or selected slot. There were no 5xx,
  baseline/dependency faults, payment/slip route events, or live SlipOK activity.
- Failed-create atomicity passed across a window spanning both requests. Attributable
  created/updated counts were zero for bookings, booking sessions and pricing
  snapshots, July pricing scope, mutation receipts, coupon reservations/usages,
  payment batches/members, verification attempts, allocations, Legacy payments,
  Ledger, wallet, attendance, notifications, Finance, and activity logs. No orphan
  scope/booking/session/receipt, notification, payment artifact, or partial slot-
  count write exists.
- The two symptoms are separate: (A) UI pricing-source divergence on Step 4 versus
  authoritative Step 5, and (B) correct atomic capacity rejection combined with a
  stale-availability UI. Affected scope is any new Progressive Kids Group selection
  where Step 4's Legacy-derived local price differs from server Progressive pricing;
  the availability issue affects any slot whose live occupancy reaches capacity.
- Customer impact: misleading Step 4 price, then corrected Summary, plus late full-
  slot rejection. Financial impact from both observed attempts: none; no Booking or
  Payment existed and no amount was charged. Immediate Entry rollback is not
  recommended because it would route new Kids Group traffic back to the explicitly
  rejected Legacy formula while server pricing/capacity authority remains intact.
- Smallest later fix boundary, pending separate Owner approval: make Step 4 consume
  the same authoritative Kids Group preview used by Step 5; expose authoritative
  capacity/preflight before confirmation while retaining the locked RPC as final
  authority; add executable UI transition/full-slot coverage. Do not change tiers,
  Option A formula, Legacy rows, Adult/Private, coupon/payment policy, or RPC
  financial semantics.
- Source changed: **no**. Tests changed: **no**. Deployment, Entry, environment,
  migration, and Production data changed: **no**. Task Done: **no**. Homepage LV
  Copy Audit/Fix is paused again. Classification:
  **PRODUCTION REGRESSION AUDITED - SOURCE FIX OWNER APPROVAL REQUIRED**.

#### 2026-07-14 - Production Booking Regression Fix Deployed; Authenticated UAT Blocked

- Owner approved one combined closeout round and superseded the earlier rollback
  discussion: continue fixing current source through Localhost, disposable, deploy,
  and Production no-write gates; do not roll back Source or Database. No formula,
  tier, migration, Legacy/Adult/Private, coupon/payment/SlipOK policy, Entry,
  allowlist, dependency, Production repair, or unrelated change was approved.
- Source commit `be61b684b8d278c9e3ca69e5cf4f0f313bd4813e`, tree
  `22296e88b9dafbfe369ae559257ac5900aac3c36`, was committed and pushed only after
  all Localhost gates passed. It uses one draft-fingerprinted authoritative preview
  across Steps 4 and 5, invalidates/aborts stale preview work, blocks transition or
  confirmation without fresh evidence, and submits the same revision/baseline
  evidence used for the displayed gross/discount/final amount. Progressive never
  falls back visibly to Legacy `totalBatchPrice`; Legacy paths remain intact.
- A narrow authenticated read model at `/api/bookings/availability` reports only
  canonical ids, capacity, active occupancy, remaining seats, and full state. The
  helper mirrors the locked RPC status/expiry rules, excludes cancelled,
  rescheduled-source, walleted, expired-pending, and inactive rows, and ignores the
  stale `schedule_slots.current_students` cache. Full selections are disabled or
  invalidated, other valid selections remain, and fresh availability is required
  before Summary/confirm. The RPC remains final authority; capacity races return
  Thai customer copy, refresh availability, and return to selection.
- Exact source/test files: `.gitignore`, `package.json`, `package-lock.json`,
  `playwright.booking.config.ts`, `scripts/check-booking-entry-runtime.mjs`,
  `scripts/check-booking-slot-availability.mjs`,
  `scripts/check-progressive-booking-entry.js`,
  `scripts/check-progressive-legacy-baseline.js`,
  `src/app/api/bookings/availability/route.ts`, `src/app/api/bookings/route.ts`,
  `src/components/dashboard/booking-client.tsx`,
  `src/lib/booking-slot-availability.ts`, and the four files under
  `tests/booking-regression/`.
- Executable gates passed: availability `8`, booking runtime `1`, Progressive
  pricing `17`, booking entry `31`, Option A baseline `32`, concurrency `8`,
  transactions `33`, coupon `38`, payment batches `39`, payment integration `18`,
  notifications `16`, Legacy pricing/payment `14`, plus `6/6` rendered Playwright
  scenarios. Total deterministic/runtime checks were `255`. TypeScript, lint,
  mojibake (`227` files), build (`91` routes), `git diff --check`, and the required
  post-build `.next` cleanup/restart/root/static/authenticated smoke passed.
- Disposable actual flow proved Step 4 `2,000`, Step 5 `2,000`, preview baseline/
  cumulative `4/8`, rate `500`, and created Booking total `2,000` with four
  sessions. Historical Legacy entitlement `4` / stored `2,500` remained unchanged,
  unscoped, and unsnapshotted. Coupon rendered `2,000/200/1,800` consistently.
  Restored drafts recalculated with no `1,500` flash; stale preview responses could
  not win. Adult, Private, and Entry-off Legacy remained unchanged.
- Capacity fixtures proved `5/6` selectable/create success, `6/6` disabled with
  forced typed atomic `409` and no partial financial/business rows, mixed/restored
  drafts preserving valid selections, and a `5/6 -> 6/6` race refreshing to Thai
  customer copy. Application console/page/hydration error counts were zero.
  Teardown reset fixtures and auth; residue count was `0`.
- The exact tested source was deployed from a clean detached worktree as
  `dpl_2GQ4hgxrqSxoy5JCMcUYMJQ4x4Bn`, Ready on all four Production aliases. `/`
  and a generated static asset returned `200`; unauthenticated preview and
  availability returned `401`. Entry remained exactly `true`, allowlist absent,
  four dependencies and shared `SLIPOK_TEST_MODE` exactly `true`, migration
  `20260713210000` applied once, and capabilities unchanged.
- Protected pre/post Production comparison passed `23/23` count plus complete
  SHA-256 fingerprints. Covered counts included bookings `519`, sessions `2,793`,
  scopes `2`, receipts `3`, coupon reservations/usages `0/0`, batches/members
  `4/4`, attempts/allocations `1/1`, payments `470`, Ledger `471`, wallet `61`,
  attendance `1,630`, notifications `16,323`, tiers `11`, Finance `1`, snapshots,
  existing Progressive targets, approved batch, and the repaired booking.
  UAT-attributable Production business-data delta was exactly `0`.
- Deployment monitoring found no 5xx, error-level events, baseline/revision/
  dependency faults, or live SlipOK activity. No Production create request or
  confirmation was issued in this round.
- The in-app browser and Chrome bridges failed to bootstrap. The Computer Use
  fallback could list Chrome but explicitly stopped before navigation because it
  could not determine the current Windows browser URL with sufficient confidence.
  Therefore authenticated Production Step 4/Step 5 `2,000`, full-slot UI,
  Adult/Private UI, existing History/batch readability, response PII inspection,
  and browser console/hydration proof for the new deployment remain
  `Unknown / Need verification`. No unsafe manual continuation was attempted.
- No deployment rollback criterion was observed, so the healthy deployment remains
  active and rollback to `dpl_CJVW2EMw9pfacn4NeAj4vqPsaSsS` was not used. Customer
  impact is the deployed source correction; financial impact this round is none.
  Production data changed: **no**. Data repaired: **no**. Task Done: **no**.
  Homepage LV Copy Audit/Fix remains paused.
- Current classification:
  **BLOCKER - PRODUCTION AUTHENTICATED NO-WRITE UAT COULD NOT BE COMPLETED;
  DEPLOYMENT HEALTHY, PRODUCTION DATA DELTA 0; TASK NOT DONE**.

#### 2026-07-14 - History Payment Selection 409 / Modal-State Read-Only Audit

- Owner supplied authenticated Production evidence that the Booking correction is
  visibly correct: Step 4 and Step 5 both show `2,000`, Legacy baseline `4`, new
  sessions `4`, cumulative `8`, rate `500`, and no Legacy-money deduction. Scoped
  result: **PASS - PRODUCTION STEP 4/STEP 5 PRICE UI VERIFIED**. During the next
  History check, selecting `3,464 + 866 = 4,330` produced visible 409 Network rows
  while a two-item slip modal also appeared. Owner authorized read-only audit plus
  documentation only and prohibited replay, slip upload, batch/Booking/payment
  mutation, source/test change, migration, deploy, environment change, or repair.
- Gate 0 matched exactly: branch `spike/next-major-security-upgrade`, local/remote
  HEAD `be5c6014a4994930bf178e3e7a0c415c845046f6`, functional source
  `be61b684b8d278c9e3ca69e5cf4f0f313bd4813e`, tree
  `22296e88b9dafbfe369ae559257ac5900aac3c36`, Ready deployment
  `dpl_2GQ4hgxrqSxoy5JCMcUYMJQ4x4Bn` on four aliases, Entry `true`, allowlist
  absent, four dependencies and shared Test Mode `true`, migration
  `20260713210000` once, and all four capabilities Ready at expected versions.
  Only unrelated unstaged `AGENTS.md` remained dirty.
- The approved Chrome connector failed twice during bootstrap before reading or
  changing any tab. No reload/navigation/request occurred. Original Network
  payload, response JSON/headers, trace id, idempotency keys, duplicate-payload
  proof, and one-click request count remain `Unknown / Need verification`.
- Exact route was `POST /api/progressive-payments/prepare`. Bounded 13:38-13:43
  Asia/Bangkok logs expanded to the complete 13:40:50.201-13:41:36 window:
  prepare `11` (`200 x5`, `409 x6`) and cancel `200 x5`. Every event was served by
  `dpl_2GQ4...`. There were no upload, submit, status, 5xx, error-level, or SlipOK
  events. Prepare results in order were `200, 409, 409, 200, 409, 200, 409, 200,
  409, 409, 200`; each successful modal was closed and followed by its own cancel.
- Exact selection:

  | Booking | Amount | Progressive order | Eligibility |
  | --- | ---: | --- | --- |
  | `c917f5f6...` | `3,464` | entitlement `8`, sequence `1`, scope revision snapshot `9` | owned, pending, unexpired, prefix member 1 |
  | `1a7d58f8...` | `866` | entitlement `2`, sequence `2`, scope revision snapshot `10` | owned, pending, unexpired, prefix member 2 |

  Both are child Kids Group bookings for July 2026, same User/child/course/month
  scope `c1285993...`, different branches, no coupon, and no Legacy/Progressive
  mix. Their sessions are future scheduled rows with no attendance or wallet
  credit. Neither has a Legacy payment, verification attempt, allocation, Ledger
  row, or active batch member. They are the complete active pending prefix in
  `created_at, id` order; choosing one or both is valid policy.
- The server contract first validates same User/scope and exact prefix, then guards
  expiry, active member/lock, existing payment, attendance/wallet/started session,
  coupon snapshot, amount, scope lock, and revision under advisory/row locks.
  Prepare writes batch/member/scope-lock/activity rows only after all validation.
  The actual 409 was not prefix or selection rejection. Timeline proof shows every
  409 followed a committed `user_cancelled` batch that increased scope revision;
  the still-rendered page sent the earlier revision, so line 408-409 of the prepare
  RPC raised `PROGRESSIVE_SCOPE_REVISION_CONFLICT`. The six exception transactions
  rolled back before insert/update. Original response body is unavailable, but the
  internal typed cause and route mapping are proven by source plus revision/action
  timestamps.
- Current prepare HTTP mapping is narrower than the RPC guard set:

  | Guard/code | Current HTTP | Meaning |
  | --- | ---: | --- |
  | `PROGRESSIVE_SCOPE_REVISION_CONFLICT` | 409 | stale client scope revision; observed and valid |
  | `PROGRESSIVE_PAYMENT_PREFIX_REQUIRED` | 409 | selection skipped an earlier pending member |
  | `PROGRESSIVE_BOOKING_EXPIRED` | 409 | pending booking expired |
  | `PROGRESSIVE_COUPON_STATE_CONFLICT` | 409 | reservation snapshot/state mismatch |
  | `PROGRESSIVE_IDEMPOTENCY_CONFLICT` | 409 | key reused with different fingerprint |
  | `PROGRESSIVE_USER_MISMATCH` / `PROGRESSIVE_UNAUTHORIZED` | 403 | wrong scope owner or ownership safeguard; mixed/cross-scope ids normally fail the earlier prefix guard |
  | dependency unavailable | 503 | required server flags absent |
  | `PROGRESSIVE_SCOPE_LOCKED`, `PROGRESSIVE_PAYMENT_EXISTS`, `PROGRESSIVE_BOOKING_NOT_PENDING`, `PROGRESSIVE_BATCH_AMOUNT_MISMATCH`, capability mismatch | 500 | valid guards currently not mapped to customer conflict status |

  An active prepared/submitted/review batch or active member therefore protects the
  scope; prepare itself does not lazily cancel an old prepared batch before checking
  the scope lock. Status/cancel/upload paths perform lazy expiry. This limitation
  did not trigger here because every successful batch was explicitly cancelled.
- Client root cause is lifecycle/error presentation in
  `src/components/dashboard/history-client.tsx`:
  - Lines 827-870 build one scope group and enforce a local prefix by slicing the
    ordered bookings. The button disables on React `loading`, but there is no ref-
    based synchronous re-entry lock.
  - Lines 465-496 POST prepare and open the modal only after `response.ok` and a
    real authoritative batch. Lines 497-500 do not open it on failure.
  - Lines 540-550 close first, cancel a prepared batch, and refresh, but never set
    a cancel/refresh loading state or clear `progressiveBatch`, `payBookingIds`, or
    `authoritativeBatchTotal`. The underlying button can therefore submit stale
    revision props before refresh completes.
  - Prepare failure stores the raw server message in `error`, but the only rendered
    error blocks are inside the closed payment/detail dialogs (1108-1112,
    1252-1255). The customer sees no useful Thai stale-revision message.
  - The progressive modal total uses authoritative batch total (784-789,
    1094-1095). The observed `4,330 / 2 items` came from one of two valid successful
    batches, not a failed prepare. The source can nevertheless retain a cancelled
    batch id behind a closed modal because close does not clear state.
- Incident batches were exactly five: totals `3,464`, `4,330`, `3,464`, `4,330`,
  `3,464`, at scope revisions `10` through `14`. All five are now `cancelled` with
  reason `user_cancelled`; seven member rows are inactive; slip metadata is null;
  attempts/allocations are absent. Scope revision is now `15`, lock owner/time are
  null, and no active prepared/submitted/under-review batch exists. There was no
  lazy expiry and no current batch/scope repair requirement.
- Failed-prepare atomicity: all six 409s produced zero batch/member/scope/Booking/
  session/receipt/coupon/payment/attempt/allocation/Ledger/wallet/attendance/
  notification/Finance/activity/storage change. Successful actions in the same
  incident are separate: five batches and seven members were inserted, five
  cancellations made those members inactive, ten activity logs were written, and
  scope revision advanced `10 -> 15`. No slip object exists and upload from any
  now-cancelled id would be rejected before storage by the upload route's status
  preflight.
- Reconciliation from the prior protected baseline at 05:25:27Z found five new
  bookings/22 sessions: four bookings/18 sessions belonged to the authenticated
  UAT User and one booking/four sessions was unrelated. The UAT User made four
  creates, two Booking cancels, nine batch prepares, and nine batch cancels in the
  wider window. The one new Legacy payment, 50 notifications, and four activity
  rows were unrelated. Current relevant counts are bookings `524`, sessions
  `2,815`, scopes `3`, mutation receipts `9`, batches/members `13/17`, attempts/
  allocations `1/1`, payments/Ledger `471/472`, wallet `61`, attendance `1,630`,
  notifications `16,373`, tiers `11`, Finance `1`, and activity logs `6,386`.
- Customer impact: repeated stale-revision retries, an apparently contradictory
  409 beside a modal created by a different successful request, and no visible
  typed error. Financial impact: none; no slip/payment/coupon/allocation/Ledger/
  Finance write occurred. Incident Production data did change through valid
  prepare/cancel lifecycle rows; this read-only audit itself changed none.
- Smallest safe source proposal, pending Owner approval: synchronous prepare and
  cancel/refresh guards; clear stale batch/member/total state; refresh and show Thai
  copy for typed revision conflict; render/enable Progressive upload only with a
  current authoritative `prepared` batch id; return structured typed codes and map
  remaining payment guards appropriately. Preserve same-scope contiguous prefix,
  lock/revision/idempotency, coupon, Payment, Ledger, and allocation semantics.
  No migration, unlock, batch repair, or Production data repair is indicated.
- Source/tests/commit/deploy/environment/migration changed by this audit:
  **no/no/docs-only pending/no/no/no**. Entry/dependencies/Test Mode remain true;
  allowlist absent. Classification:
  **PRODUCTION REGRESSION AUDITED - VALID SERVER 409 + CLIENT MODAL BUG; SOURCE
  FIX OWNER APPROVAL REQUIRED**.

#### 2026-07-14 - History Payment Lifecycle Fix and Controlled Production UAT Closeout

- Owner approved the audited smallest boundary: explicit client lifecycle and
  reconciliation, safe structured error mapping/Thai copy, executable rendered
  History tests, disposable/local E2E, exact-source commit/push/deploy, and two
  controlled Production prepare/cancel cycles for the exact `3,464 + 866` prefix.
  The approval did not include slip upload/submission, Payment, verification
  attempt, allocation, Ledger, Finance, coupon, Booking, migration, environment,
  Entry, allowlist, dependency, formula, policy, guard, or data-repair changes.
- Changed source/test files in commit
  `7d98b062f850a4210fae052cefddd92b994889b8` (tree
  `73294ca5419582492fa558623d395c5b3801af5e`):
  - `src/components/dashboard/history-client.tsx`;
  - `src/lib/progressive-payment-route.ts`;
  - `src/app/api/progressive-payments/prepare/route.ts`;
  - `package.json` and `playwright.history.config.ts`;
  - `tests/history-payment-regression/global-setup.ts`, `global-teardown.ts`,
    `local-supabase.ts`, and `history-payment.spec.ts`.
- Client contract now uses `idle | preparing | prepared | cancelling | refreshing
  | conflict | failed`, a synchronous operation ref, stale-generation rejection,
  server-revision reconciliation, immediate upload-evidence invalidation on close,
  and exact scope/member/amount checks before the modal/upload path. A conflict
  refreshes once without retry, retains safe selection, and renders the Thai main-
  surface message instead of exposing a raw RPC code. Cancel failure keeps the
  uncertain batch blocked until authoritative refresh/resume. The RPC remains the
  final same-scope/prefix/revision/idempotency authority.
- Structured route mapping now returns stable `{ code, error, refreshRequired }`
  for known 400/403/404/409/503 cases, including scope revision/lock, prefix,
  expiry, coupon/idempotency, existing payment, pending-state, amount/fingerprint,
  currency, batch state, and capability/dependency errors. Unknown internals remain
  a safe 500 and SQL/stack text is not exposed.
- Executable result: `248` unique checks passed. Deterministic/runtime suites were
  `244` total (payment batches `39`, integration `18`, notifications `16`, pricing
  transactions `33`, coupon `38`, Legacy `14`, SlipOK `6`, booking entry `31`,
  Option A `32`, pricing `17`) and rendered History E2E was `4`. E2E passed both
  before and after build cleanup/restart. TypeScript, lint, mojibake (`227` files),
  build (`91` routes), root/static smoke, and `git diff --check` passed. Console,
  page, and hydration errors were `0`; disposable fixture residue was `0`.
- Local E2E covered one physical rapid double click producing one prepare, current
  authoritative `4,330 · 2 รายการ` modal, cancel/revision wait/re-prepare, forced
  stale revision with typed 409/Thai recovery/no modal/no auto-retry, cancel-failure
  safe reconciliation/resume, and real RPC valid/skipped-prefix behavior. No slip,
  Payment, attempt, allocation, Ledger, or Finance artifact remained.
- The source commit was pushed to `origin/spike/next-major-security-upgrade` and
  deployed as `dpl_Gj3mmRs8iVAxaXEw42ngsdaxh6Q9`, Ready on all four aliases. Root
  and generated static asset returned `200`; unauthenticated prepare with valid
  origin returned `401`. Two earlier deployment attempts
  (`dpl_2x6buY9UgAacgLBsAZ4EZHvPBL8t` and
  `dpl_GyFfc9KgfK9bGU3hSDCWBrpaweVk`) were rolled back to
  `dpl_2GQ4hgxrqSxoy5JCMcUYMJQ4x4Bn` before UAT because Vercel link metadata made
  their detached worktrees fail the exact-clean gate. Neither attempt caused a
  Production business-data write. The final detached worktree stayed clean at the
  exact tested commit/tree.
- Controlled Production UAT selected `c917f5f6...` and `1a7d58f8...` only. Two
  physical prepare clicks returned `200 x2`; both modals showed `4,330 · 2 รายการ`;
  no 409 occurred. Two closes produced cancel `200 x2`; selection/prepare/upload
  controls stayed disabled until each RSC revision refresh completed. No file was
  selected and upload/submit/SlipOK was never invoked. Browser console/hydration
  count was zero.
- Exact UAT data result: two new batches (`b4691d68...`, `818833a6...`) are
  `cancelled`, each total `4,330`, member count `2`, revisions `15`/`16`, and all
  slip fields null; four new member rows are inactive; scope revision is `17` with
  no lock. This is the approved `+2` batch, `+4` member, `+4` activity, `+2`
  revision lifecycle delta. Booking `525`, sessions `2,819`, receipts `10`, coupon
  rows `0/0`, attempts `2`, allocations `2`, payments `472`, Ledger `474`, wallet
  `61`, attendance `1,636`, tiers `11`, and Finance `1` retained their complete
  protected fingerprints. A different user's coach check-in activity and reminder
  notification were separated by timestamp/user/entity as unrelated real activity.
- Production controls remained Entry `true`, dependencies `true/true/true/true`,
  allowlist absent, and shared `SLIPOK_TEST_MODE=true`. Migration
  `20260713210000` remained applied once. Pricing capability stayed Ready/version
  `2`/`immutable_scope_v1`; coupon, payment batch, and integration stayed Ready/
  version `1`. Monitoring found prepare/cancel `200 x2/x2`, zero 409/5xx/error/
  upload/submit/SlipOK, and no final rollback criterion.
- Customer impact: stale revision and duplicate re-entry can no longer expose an
  invalid slip modal; users see a clear Thai recovery path. Financial impact:
  none. Data repair: none. Final classification:
  **PASS - HISTORY PAYMENT LIFECYCLE FIXED; LOCAL E2E AND CONTROLLED PRODUCTION
  UAT PASSED; TASK DONE**. Homepage LV Copy Audit/Fix is unpaused as the next task
  and was not started in this round.

## Phase 0 - Baseline & Readiness

- [x] Confirm current app runs locally with real Supabase project.
- [x] Confirm `.env.local` contains all required values on this machine.
- [x] Confirm registration creates `profiles.phone` correctly.
- [x] Confirm Supabase Storage buckets and policies are ready for payment slips and uploads.
- [x] Set up Supabase CLI locally or choose a manual migration baseline path.
- [x] Create a baseline database migration/snapshot from the current remote schema.
- [x] Confirm local migration history matches the remote project before adding new DB changes.

Notes:
- Supabase CLI is initialized and linked to project `tvnhholicwjtxdhlxfqs`.
- Baseline migration created at `supabase/migrations/20260506082635_current_remote_baseline.sql`.
- Local and remote migration history both show `20260506082635` as applied.
- `payment-slips` is a public Storage bucket with upload/select policies, and user history links to `payments.slip_image_url`.

## Phase 1 - Core UAT

- [x] User flow: register/login, dashboard, booking, payment slip upload, slip view.
- [ ] Admin flow: dashboard, users, coaches, bookings, payments, coupons, complaints.
- [ ] Coach flow: dashboard, today, check-in, attendance, student levels, teaching programs.
- [ ] Head coach flow: assign coaches to teaching slots.
- [ ] Super admin flow: settings and activity logs.
- [ ] Record bugs found during UAT with severity.

## Phase 2 - Blocking Fixes

- [x] Admin overview dashboard compact KPI cards and monthly schedule overview.
- [x] Admin payments audit dashboard for SlipOK-driven payment review and slip viewing.
- [x] Admin schedules operation calendar with monthly filters and daily drill-down.
- [x] Admin users management dashboard with role-safe editing and learner details.
- [x] Admin coaches management dashboard with head coach self-assignment clarity.
- [x] Admin branches operations dashboard with branch status, coach coverage, and booking overview.
- [x] Admin makeup sessions dashboard with overdue detection and one-time next-month makeup creation flow.
- [x] Admin coach check-in audit by teaching slot with mandatory selfie/photo evidence.
- [x] Admin coach payroll review based on assigned teaching slots, verified check-in evidence, and weekly OT rules.
- [x] Admin finance manual expenses for real monthly/yearly net income tracking.
- [x] Admin schedule templates moved to a dedicated "รอบเรียนประจำ" menu, seeded from legacy hardcoded schedules, and booking/makeup flows use DB templates before hardcoded fallback.
- [ ] Fix any auth/session/profile issues.
- [ ] Fix any booking/session/payment data issues.
- [ ] Fix any Storage upload or public URL issues.
- [ ] Fix any coach assignment/check-in/attendance issues.
- [ ] Fix any role/RLS permission issues.

## Phase 2.5 - Admin/System Execution Queue

**Current source of truth for the next Admin/System work.** Work through this queue one item at a time. Do enough checking to confirm the touched flow still works, but do not loop into broad redesigns or repeated QA before the main process/function tasks are complete.

- [x] 1. User Profile Settings for every role
  - Users can edit their own name, phone, avatar, and password.
  - Email must not be editable because it is the login username.
  - Avatar should update `profiles.avatar_url` and be reused by sidebar/ranking/profile surfaces.
- [x] 2. Pricing Settings
  - Super Admin can edit course price tiers through the system.
  - User Booking should use DB settings as the source of truth, not hardcoded pricing.
- [x] 3. Coach OT Settings
  - Super Admin can edit weekly OT threshold and OT rates.
  - Payroll and Finance should read these settings instead of constants.
- [x] 4. Settings Workspace UX
  - Replace the raw Key/Value JSON settings list with user-friendly section panels.
  - Default section should be Admin Menu Permissions.
  - Reuse existing Admin Menu Permissions, Level Settings, Pricing Settings, and Coach OT Settings UI.
  - Keep raw JSON settings hidden from the normal Super Admin workflow; reserve it for developer/debug use only if needed.
- [x] 5. Schedule Templates as DB Source of Truth
  - Confirmed remote DB has 653 active schedule templates, matching the legacy seed migration.
  - User Booking, Reschedule, and Makeup flows now resolve slots from DB templates without hardcoded schedule fallback.
  - Legacy `branch-schedules.ts` remains only as a label/reference file until the remaining imports are cleaned up later.
- [x] 6. Remove Admin Booking Entry Points
  - Admin/Super Admin must not book on behalf of users.
  - Users must create bookings and complete payment themselves.
  - Old `/admin/booking` page now redirects to `/admin`.
  - Old `POST /api/admin/booking` now returns `410 Gone`.
  - Removed the unused Admin booking client component so the cancelled flow is not accidentally reused.
- [x] 7. Coach Teaching Hours / Weekly OT Refactor
  - Rename the Admin menu from "เงินเดือนโค้ช" to "คำนวณชั่วโมงสอน".
  - Keep the existing Head Coach / Coach role and permissions unchanged; the new coach type is payment logic only.
  - Add independent coach employment type: `full_time`, `half_time`, `part_time`.
  - Full-Time: weekly threshold 25 hours; OT Private 400 THB/hour, Group 200 THB/hour.
  - Half-Time: weekly threshold 12.5 hours; OT Private 400 THB/hour, Group 200 THB/hour.
  - Part-Time: no threshold; pay weekly teaching hours directly; Private 400 THB/hour, Group 250 THB/hour.
  - Calculate from verified teaching evidence only: assigned teaching slot + coach check-in + mandatory photo evidence.
  - Base salary is outside this system; this page summarizes weekly teaching hours and extra/payable teaching amounts for the owner.
  - Existing monthly `coach_payouts` implementation is superseded by this weekly teaching-hour model and must be refactored before continuing Coach/User work.
  - Added `profiles.coach_employment_type` and `coach_weekly_teaching_summaries` as the new weekly summary/audit source.
  - Coach management can set employment type without changing Head Coach / Coach role.
  - Admin teaching-hours page now closes weekly summaries from verified teaching slots and stores a server-side snapshot.
- [x] 8. Finance Business Overview Completion
  - Improve monthly/yearly business view with revenue, expenses, OT, net result, branch/course breakdown, and export-ready summaries if needed.
  - Finance now reads coach cost from closed `coach_weekly_teaching_summaries` instead of recalculating OT from live assignments.
  - Monthly/yearly view summarizes approved revenue, closed coach teaching pay, manual expenses, net result, branch/course revenue, coach cost, and monthly trend.
- [x] 9. Admin Menu Permissions QA
  - Verify regular Admin sees only menus allowed by Super Admin and cannot access hidden routes directly.
  - Admin menu labels/settings copy were normalized back to readable Thai for the permission workspace.
  - Added API-level guards for configurable Admin menu domains so hidden menus cannot be used through direct endpoint calls.
  - Mobile notification badge now respects the Admin notification menu permission.
- [x] 10. Admin Ranking QA and Useful Filters
  - Verify Ranking data, avatars, Level 0/default state, child/adult tabs, branch source, and latest Coach/Admin evaluation.
  - Public ranking must support read-only filters, including branch filter, learner type, and level/rank view.
  - Public users can see who is in each branch, each student's rank within that branch, and their overall NA rank.
  - Add branch summary for both public/admin views: selected branch top student, selected branch count, and overall NA top student/level for comparison.
  - Keep ranking source based on latest Coach evaluation in `student_levels`; students with no evaluation must stay at Level 0.
  - Admin and Coach can update student level/rank; public users can only view.
  - Add achievement/badge plan for students who competed or won awards. Prefer a dedicated `student_achievements` data source with emoji/title/description/is_active instead of storing badges in level notes.
  - Admin and Coach can manage achievement emoji/badges; public users can only view active badges.
  - Show achievement emoji after the student name on both public and admin ranking, with achievement detail available in a tooltip/detail area.
  - Keep responsive layout readable on mobile: compact filters, small KPI summary, and ranking rows that do not become too tall.
  - Implemented dynamic branch filters from `branches`, overall NA rank, selected-branch rank, public read-only ranking, and Admin achievement management.
  - Added `student_achievements` table/API for active public badges. Coach UI for managing badges should be wired in the Coach/Level flow.
- [x] 11. Level Settings to Coach Evaluation Flow
  - Confirm Super Admin Level settings feed Coach level evaluation and public/admin ranking consistently.
  - Coach evaluation now uses active Level rows from `levels` as the selectable source of truth instead of free typing from hardcoded copy.
  - `/api/coach/levels` validates that the selected Level exists and is active before writing to `student_levels`.
  - Public/Admin Ranking now resolves the latest evaluated Level against `levels` so edited Level names are reflected in ranking display.
  - Added shared student achievement management for Admin Ranking and Coach Level flow, with preset trophy/medal emoji options ready for awards.
  - Repaired Thai copy in Level constants, Admin Level settings, Coach Level evaluation, and Ranking surfaces touched by this flow.
  - Level settings must be extensible beyond LV 70: Super Admin can add LV 71+ rows, while Coach evaluation can only select active rows from `levels`.
- [x] 12. Admin Regression and Responsive Pass
  - After items 1-11 are completed, run a focused pass on Admin desktop/mobile layout and critical flows.
  - Added Admin shell width guards (`min-w-0`, max readable canvas) so wide tables/cards do not force horizontal overflow under the sidebar.
  - Adjusted Admin schedule calendars and dashboard schedule cards for mobile: compact month labels, shorter day cells, and desktop split layout only at very wide screens.
  - Moved heavy table/grid layouts on Payments, Users, Coaches, Complaints, Makeup, Payroll, and Level Settings to wider breakpoints so tablet/mobile use stacked cards instead of cramped pseudo-tables.
  - Verified `npm run check:mojibake`, `git diff --check`, and `npm run build`; build passes with existing lint warnings from Coach/User areas still tracked as separate technical debt.
- [x] 13. Apply Admin/System DB Migrations
  - Push/apply the committed Supabase migration for extensible Level constraints before relying on LV 71+ in the live DB.
  - Confirm remote DB has the schema needed by recent Admin/System work, including Level extension and coach weekly teaching summary fields.
  - Do this before continuing broad Coach/User feature work so app code and DB constraints do not drift.
  - Applied remote migration `20260515093000_make_levels_extensible.sql`; local and remote migration history now match through `20260515093000`.
  - Remote schema check confirmed Admin/System tables/fields used by recent work exist: `profiles.coach_employment_type`, `coach_weekly_teaching_summaries`, `schedule_templates`, and `student_achievements`.
  - Supabase CLI read-only count/constraint queries timed out intermittently after migration, but migration history confirms the constraint migration was applied successfully.
- [x] 14. Admin/System Smoke Test After Migration
  - Verify the committed Admin flows against the real DB: Settings workspace, Admin menu permissions, Level settings, Pricing settings, Coach teaching rules, User management, Schedule templates, Ranking, Finance, and responsive mobile layout.
  - Record only real blockers found during this smoke test; avoid repeated redesign unless a main flow is broken.
  - Verified `npm run check:mojibake` and `npm run build`; production build passes with existing Coach/User lint warnings still separated as technical debt.
  - Verified remote migration history matches local through `20260515093000`.
  - Verified remote DB read sanity with service role: branches 7, course types 3, pricing tiers 11, levels 70, active schedule templates 702, profiles 7, payments 6, student achievements 5.
  - Verified `/api/health` on localhost returns 200 after restarting the stale dev server.
  - Verified public Home and Ranking render after restart; Admin routes redirect unauthenticated users to login with redirect params.
  - `coach_teaching_rules_settings` is not yet stored in `system_settings` until Super Admin saves the Coach OT settings once, but current code has default fallback so this is not a blocker.
- [x] 15. Start Coach-First / User-Last Completion Queue
  - After Admin/System DB and smoke test are stable, continue with Coach/User work.
  - Work through this queue in order: finish Coach flows and Coach QA first, then User flows last. Admin/System is now the stable base; only touch Admin/System for real blockers found while connecting Coach/User flows.
  - Realistic Supabase seed data is available for development via `npm run seed:realistic`, with verification via `npm run seed:verify`. Seed accounts use `seed.nasc+...@example.com` and are tagged with `NASC_SEED` where tables support notes/details.
  - [x] 15.1 Coach Level Evaluation + Achievement
    - Coach must see all students they are responsible for.
    - Coach can evaluate student Level from active master `levels`, not free text or hardcoded ranges.
    - Coach can add/disable award emoji badges after student names.
    - Public Ranking, Admin Ranking, and Coach Ranking/Level views must display the same latest Level and active achievements.
    - Implemented assignment-first coach student access: regular Coach sees assigned students only; Head Coach can fall back to branch students when no direct assignment exists.
    - Level and achievement APIs now verify that Coach/Head Coach is allowed to manage the selected student; Admin/Super Admin keep all-access behavior.
    - Active achievements continue to flow through shared `student_achievements`, so Public/Admin/Coach ranking surfaces use the same award source.
  - [x] 15.2 Coach Teaching Flow
    - [x] 15.2.0 Coach-Student Memory / Suggested Coach
      - Read coach-student history from real `coach_assignments` + `booking_sessions`, not manual-only preference.
      - Show Head Coach/Coach which coaches a learner has studied with, including last taught date and total sessions together.
      - If a learner studied with multiple coaches, show all history; suggest the strongest/default coach without blocking Head Coach override.
      - Keep User booking user-owned. This memory only helps assignment after booking, not Admin booking on behalf of users.
      - Use this memory to reduce repeated manual assignment for learners who regularly study with the same coach.
      - Implemented shared `getCoachStudentMemoryMap` helper and wired it into Head Coach assignment plus Coach student views.
    - [x] 15.2.1 Coach Schedule from Real Assignments
      - Coach dashboard, today schedule, attendance, and check-in pages now read from `coach_assignments` first.
      - Removed branch-wide fallback from Coach schedule/attendance surfaces so Coach sees only assigned teaching slots.
      - Added shared `getCoachAssignedTeachingDay` helper to keep assigned slot, student, attendance, and check-in context consistent.
    - [x] 15.2.1.1 Coach Group Assignment by Student Level
      - Upgrade Head Coach assignment from "assign coach to slot" into "group learners inside a slot, then assign one coach per group".
      - Add DB migration for group assignment source of truth, likely `coach_assignment_groups` and `coach_assignment_group_students`.
      - Store group membership per `booking_session_id` so the system knows exactly which coach is responsible for which learner in each teaching round.
      - Show each learner with latest Level, learner type, parent/self context, coach history, and warning states such as no Level or mixed Level range.
      - Auto-suggest groups by Level bands and coach-student history, but keep Head Coach manual control to move learners, rename groups, add/remove groups, and change coach.
      - Keep User booking user-owned; grouping happens after booking/payment and is a Head Coach operation.
      - Preserve compatibility with existing `coach_assignments` during transition, but group assignment should become the main source for learner responsibility.
      - Implemented `coach_assignment_groups` and `coach_assignment_group_students`, pushed migration `20260515190000_add_coach_assignment_groups.sql` to Supabase, added Head Coach grouping UI, and added `/api/coach/assignment-groups`.
      - Group saves still sync selected coaches back to `coach_assignments` for transitional compatibility with existing Coach schedule/check-in pages.
    - [x] 15.2.1.2 Coach Assignment UX: day/slot picker + duplicate coach prevention
      - Head Coach assignment now uses a day picker first, then a slot picker, so one busy day does not render every teaching round and group editor at once.
      - The selected slot is the only slot expanded for group editing; other rounds stay as compact selectable cards with student count, course type, saved status, and warning badges.
      - Coach dropdown options are disabled/greyed when the same coach is already used by another non-empty group in the selected teaching round.
      - Save is blocked when a draft still has the same coach assigned to multiple groups in the same slot, matching the server-side duplicate coach validation.
      - Auto-group suggestions avoid assigning the same available coach to multiple Level groups in the same slot where possible.
    - [x] 15.2.1.3 Auto-suggest Draft Confirmation
      - Auto-suggest and manual grouping changes are shown as Draft until Head Coach clicks "บันทึก/ยืนยันกลุ่ม".
      - Coach-facing schedule/check-in/attendance surfaces continue to read saved assignment groups only; unsaved draft changes remain local to the Head Coach assignment screen.
      - Selected slot cards and the expanded editor show Draft versus saved assignment state clearly.
      - The save button changes to a confirmation action and is disabled once the current grouping already matches saved assignment data.
      - The "จัดตาม Level" action is labeled as Draft so Head Coach understands it is a suggestion, not an automatic assignment commit.
    - [x] 15.2.2 Coach Check-in Per Assigned Slot + Required Photo QA
      - Coach check-in is per teaching session/slot, not per workday, and must require photo evidence.
      - Check-in should remain tied to the assigned slot while learner responsibility comes from assignment groups.
      - Check-in API now validates the logged-in Coach/Head Coach, assigned slot/group responsibility, Bangkok current date, 30-minute-before to 30-minute-after-start check-in window, duplicate check-ins, and required image evidence.
      - Coach check-in UI uses front-camera capture only, removes browse/file picker entry points, requires GPS permission, and sends a camera-capture source flag with the selfie.
      - Check-in API requires valid GPS coordinates and rejects uploads that do not come through the camera-capture flow.
      - Attendance is locked until the assigned Coach/Head Coach has checked in for that specific teaching slot, so check-in evidence becomes required before marking learners.
      - Build and mojibake checks passed after the change.
    - [x] 15.2.3 Attendance From Coach Assignment Groups
      - Update Coach pages after the group model exists so `/coach/today`, `/coach/attendance`, `/coach/students`, and Level evaluation use learner-level group responsibility.
      - Attendance must write against the real `booking_sessions` records and the correct student/child.
      - Coach should only mark attendance for learners in their assigned group.
      - `getCoachAssignedTeachingDay` now prefers `coach_assignment_groups` / `coach_assignment_group_students`; legacy slot assignment is used only when a slot has no group assignment yet.
      - Attendance API validates the booking session, student identity, and coach group responsibility before writing attendance.
      - Coach dashboard, Today, Students, Check-in, and Attendance copy touched in this flow were cleaned back to readable Thai.
    - [x] 15.2.4 Weekly Teaching Hours Integration
      - Weekly teaching hours now connect to Admin "คำนวณชั่วโมงสอน" and use verified evidence only.
      - Added shared `getCoachTeachingHourSourceRows` source of truth: assignment groups first, legacy assignment fallback only when no group exists for the slot.
      - A teaching slot is counted only when it has assigned learners, Coach check-in, selfie/photo evidence, GPS location, and attendance records.
      - Admin payroll, weekly close API, Coach dashboard, and Coach hours page now read from the same verified source.
      - Payroll UI shows missing evidence buckets: no check-in, no photo, no location, and no attendance.
      - Build and mojibake guard passed; localhost smoke test for `/admin/payroll`, `/coach/hours`, and `/coach` returned 200 after restarting the dev server.
    - [x] 15.2.4.1 Coach Schedule Calendar Detail
      - `/coach/today` is now "ตารางสอนของฉัน" and accepts `?date=YYYY-MM-DD` to show any assigned teaching day.
      - Added a monthly calendar/detail view for Coach using saved assignment/group source data only.
      - Coach dashboard calendar days now link into `/coach/today?date=YYYY-MM-DD`.
      - Coach sidebar label changed from "รอบสอนวันนี้" to "ตารางสอนของฉัน" to match the expanded monthly workflow.
      - The selected day still shows the real assigned slots, assigned learner groups, check-in status, and learner list from `getCoachAssignedTeachingDay`.
    - [x] 15.2.5 Attendance UX From Schedule
      - `/coach/attendance` now accepts `?date=YYYY-MM-DD` and optional `?slot=...` so Coach can enter attendance from the selected teaching day/round.
      - `/coach/today` adds a per-slot attendance action after the Coach has checked in; locked slots point Coach to check in first when it is the teaching day.
      - Attendance UI clearly shows the selected date, selected slot state, all-day fallback, and a return path to "ตารางสอนของฉัน".
      - Attendance remains locked without the specific slot check-in, matching the API rule that weekly teaching hours require check-in, selfie/photo, location, and attendance evidence.
      - Coach schedule/attendance source now keeps `absent` sessions visible after marking a learner absent, so refresh does not make the learner disappear from the round.
  - [x] 15.3 Coach Completion QA Gate
    - Do this before any User feature work.
    - Housekeeping status on 2026-05-19: Coach/Admin completion gate is closed for the current development queue. Child items `15.3.1` through `15.3.8` and `15.4` are complete enough to move into User flow; keep any new Coach issues as regressions or follow-up bugs, not as a reason to restart the whole Coach queue.
    - Known QA limitation kept for context: direct Supabase seed sign-in works, authenticated HTTP QA passed, and unauthenticated browser route guards passed; the in-app Browser form automation did not complete the login redirect, so real logged-in browser QA should be repeated manually or with a stable browser session when available.
    - Recommended remaining execution order before starting User flow:
      - [x] 15.3.4 Coach pages high-volume UX pass
        - Goal: remove long endless Coach lists the same way Admin lists were cleaned up.
        - Check and improve `/coach/today`, `/coach/checkin`, `/coach/attendance`, `/coach/students`, `/coach/hours`, and `/coach/programs`.
        - Use compact summaries, filters, pagination, collapsible sections, and detail dialogs/drawers where needed.
        - Do not change the existing assignment/check-in/attendance/hour source of truth unless a real bug requires it.
        - Implemented: `/coach/programs` now paginates the template library and submitted program list; `/coach/levels` now paginates searchable learner evaluation rows; `/coach/checkin` now caps daily check-in history with expand/collapse controls; `/coach/students` keeps search/filter pagination capped at 12 learners per page.
        - Verified existing `/coach/today`, `/coach/attendance`, and `/coach/hours` already use selected-day, collapsible slot, or weekly grouping patterns, so this pass did not change their business flow.
      - [x] 15.3.5 Coach program flow final check
        - Verify one assigned teaching slot can have only one active teaching-program submission per Coach.
        - Verify draft/delete/revise/reuse template flows work correctly and do not create duplicate submissions.
        - Verify Admin review status and returned notes appear correctly back on `/coach/programs`.
        - Implemented/verified: Coach program API already blocks duplicate `coach_id + schedule_slot_id` submissions, only allows assigned slots, and only allows editing `draft`/`rejected` programs.
        - Added Coach UI action for `rejected` programs so Coach can revise and resubmit the original slot instead of creating a duplicate.
        - Program submit now closes the modal immediately and refreshes the server data, reducing accidental double-click resubmits while the server-side duplicate guard remains authoritative.
        - Confirmed draft deletion uses the in-app `AlertDialog`, template reuse/preset/reuse-old flow still feeds the same single program form, and Admin review notes/status are shown in the Coach program list/detail.
      - [x] 15.3.5.1 Coach Dialog Accessibility Cleanup
        - Fix Coach-side Radix Dialog warnings before the Coach QA gate: every `DialogContent` must include a `DialogTitle`.
        - Add a visible or visually-hidden `DialogDescription` / `aria-describedby` where needed so the console stays clean during authenticated browser QA.
        - Scope this cleanup to Coach pages/components touched by the Coach completion queue; do not redesign dialog flows or change business logic.
        - Implemented: Coach mobile sidebar `SheetContent` now includes an sr-only `SheetTitle` and `SheetDescription`, fixing the Radix Dialog title warning seen on `/coach`.
        - Implemented: Coach Level evaluation dialog now includes `DialogDescription`; Coach program dialogs already had titles/descriptions and were rechecked.
        - Verified with `npm run check:mojibake` and `npm run build`; remaining build warnings are existing User/Dashboard/API lint debt outside this Coach accessibility scope.
      - [x] 15.3.6 Coach check-in + attendance end-to-end
        - Verify the 30-minute before to 30-minute after teaching-start check-in window.
        - Verify selfie/front-camera capture, GPS/location requirement, duplicate check-in prevention, and assigned-slot validation.
        - Verify attendance remains locked when that specific slot has no valid Coach check-in.
        - Verify attendance writes are tied to real assignment groups and only allowed for responsible Coach/Head Coach.
        - Implemented: attendance now links locked slots directly to `/coach/checkin?slot=...`, and the check-in page preselects that exact assigned slot.
        - Implemented: Coach check-in UI shows the per-slot check-in window and disables submit outside the allowed 30-minute-before to 30-minute-after range while the API remains the authoritative guard.
        - Implemented: attendance updates the latest existing record instead of relying on `upsert` without a DB unique constraint, preventing duplicate attendance rows when Coach changes present/late/absent.
        - Implemented: shared Coach schedule reads attendance ordered by `checked_at`, so if older duplicate rows already exist the latest status wins in Coach UI.
        - Verified with `npm run check:mojibake`, `npm run build`, and unauthenticated browser route smoke for `/coach/checkin`, `/coach/attendance`, and `/coach/today`.
      - [x] 15.3.7 Coach level/ranking/achievement final check
        - Verify Coach can evaluate only learners they are responsible for.
        - Verify Level evaluation feeds Coach/Admin/Public ranking consistently.
        - Verify achievement emoji shows consistently on Coach/Admin/Public ranking and only authorized roles can manage it.
        - Verified: `/api/coach/levels` requires Coach/Head Coach/Admin/Super Admin and checks `canManageStudentForCoach` before writing `student_levels`.
        - Verified: `/api/student-achievements` uses the same `canManageStudentForCoach` guard for Coach/Head Coach, while Admin/Super Admin keep all-student access through the shared staff-all-access rule.
        - Verified: Coach Level page loads only students from `getCoachVisibleStudents`, then reads latest Level and active `student_achievements` for that visible set.
        - Verified: Public `/ranking` and Admin `/admin/ranking` share `RankingContent`/`RankingBoard`, read latest `student_levels`, active `student_achievements`, and dynamic branch filters from the same data source.
        - Verified: Public ranking has no achievement management action; Admin ranking can open the shared achievement manager; Coach manages achievements only from visible students in `/coach/levels`.
        - Verified with `npm run check:mojibake`, `npm run build`, and browser smoke for `/ranking`, `/admin/ranking`, and `/coach/levels`.
      - [x] 15.3.8 Coach regression
        - Run `npm run check:mojibake`, `npm run build`, and authenticated smoke tests for core Coach pages.
        - Verify mobile responsive for Coach dashboard, schedule, assignment, check-in, attendance, hours, students, and programs.
        - Commit and push after this gate passes.
        - Verified: `npm run check:mojibake` passed after the Coach regression pass.
        - Verified: Coach-scope scan found no native `alert/confirm/prompt`, no `<img>` usage, and no new `any` debt in Coach routes/components/libs.
        - Verified: `npm run build` passed. Remaining warnings are existing User/Dashboard/API/Auth lint debt outside this Coach regression scope.
        - Verified: unauthenticated route guard browser smoke still redirects Coach routes to login without console errors.
        - Verified: Supabase seed auth works for Head Coach seed account; Browser form automation did not complete the login redirect even though direct Supabase sign-in passed, so this is recorded as a tool/browser-smoke limitation rather than a Coach runtime error.
        - Fixed: Coach student list source filter now uses the real `assigned_slot` source value, so the "เคยได้รับมอบหมาย" filter can match students returned from assignment-slot history.
        - Seed QA note: `npm run seed:verify` executed against Supabase and duplicate coach/group slots remained `0`; current QA data has a small non-blocking drift from extra test rows (`assignment_groups` 197 vs 196, `assignment_group_students` 246 vs 245, `notifications` 32 vs 29).
      - After Coach is complete, start `15.5 User Booking / Payment / History` as the next major queue because User flow touches booking, pricing, coupon, SlipOK, schedule, and history together.
    - Verify Coach pages end-to-end with realistic Supabase data: `/coach`, `/coach/today`, `/coach/students`, `/coach/levels`, `/coach/assign-groups`, `/coach/checkin`, `/coach/attendance`, `/coach/hours`, and `/coach/notifications`.
    - Verify Head Coach can group learners by Level and coach history, assign coaches, and manually override suggestions.
    - Verify regular Coach sees only assigned learners/groups, cannot evaluate unrelated learners, and cannot mark attendance outside their responsibility.
    - Verify mobile responsive for Coach dashboard, group assignment, check-in camera/location, attendance, and hours.
    - Verify stale Next dev cache is handled by restart after build before browser checks.
    - Fix Coach-side mojibake, runtime errors, and warnings only in files that affect the Coach completion gate.
    - QA progress:
      - [x] Coach-side lint/mojibake pass: removed old `any`/mojibake debt from Coach programs and Coach assignment API without touching User flow.
      - [x] `npm run check:mojibake` passed.
      - [x] `npm run build` passed; remaining warnings are outside Coach scope and stay for the later User/shared debt pass.
      - [x] Cleared stale `.next` dev cache, restarted dev server, and confirmed localhost loads again after the known CSS/chunk cache failure mode.
      - [x] Unauthenticated route guard smoke passed for Coach routes: `/coach`, `/coach/today`, `/coach/students`, `/coach/levels`, `/coach/assign-groups`, `/coach/checkin`, `/coach/attendance`, `/coach/hours`, `/coach/notifications`, `/coach/programs`.
      - [x] Realistic seed data verification passed against Supabase.
      - [x] Expanded realistic seed data for authenticated Coach QA: 7 active branches, 7 Head Coaches, 21 Coaches, 21 Users, 21 children, 35 bookings, 245 booking sessions, 147 schedule slots, 196 assignment groups, 28 check-ins, 35 attendance rows, and cleanup command `npm run seed:cleanup`.
      - [x] QA note: first seed verification found stale seed state (`coach_assignments` expected 196, got 193). Reran `npm run seed:realistic`, then `npm run seed:verify` passed with 196 synced assignment groups and zero duplicate coach/group slots.
      - [x] Authenticated HTTP QA passed on production server for Head Coach and Coach routes: `/coach`, `/coach/today?date=2026-05-17`, `/coach/today?date=2026-05-18`, `/coach/attendance?date=2026-05-17`, `/coach/checkin`, `/coach/students`, `/coach/levels`, `/coach/hours`, `/coach/notifications`, `/coach/programs`; Head Coach `/coach/assign-groups` returned 200 and regular Coach `/coach/assign-groups` redirected to `/coach`.
      - [x] Attendance API guard passed with real seed data: assigned learner after check-in returned 200, unrelated learner returned 403, and assigned learner without slot check-in returned 403.
      - [x] Reran `npm run seed:realistic` after the attendance write tests and confirmed `npm run seed:verify` returned canonical counts again, including 35 attendance rows.
      - [x] Runtime note: production build/server was used for authenticated QA to avoid the known local dev stale `.next` chunk/CSS failure. No Coach route 500 was reproduced in production QA.
      - [x] Authenticated browser QA limitation documented: Head Coach/Coach screens passed authenticated HTTP QA, while the Browser form-login issue is a tool/session limitation to retry later, not a blocking Coach runtime bug.
  - [x] 15.3.1 Head Coach / Coach UX Hardening From QA
    - Completed before `15.4 Coach Notifications / Reminders`; this section is kept as historical implementation context for the Coach-side completion work.
    - Keep the existing assignment/check-in/attendance/hour source of truth intact. This pass should improve UX and workflow clarity without changing User booking ownership.
    - Assignment wording and status states:
      - Replace visible "Draft ยังไม่ยืนยัน" copy with "ยังไม่ได้มอบหมาย" where the round/group has not been saved into real assignment data.
      - Use clear saved state copy: "มอบหมายแล้ว" with a green check for slots/groups already saved.
      - If a saved assignment is edited locally before saving, do not call it "มอบหมายแล้ว"; show a separate "มีการแก้ไขยังไม่บันทึก" state so Head Coach does not confuse local changes with confirmed assignments.
      - Keep auto-suggest as a local recommendation only until Head Coach clicks save/confirm.
    - Head Coach assignment month-scale navigation:
      - Replace the short 7-day-only day picker with a month-aware planner that can handle real booking volume for the whole current month and future months.
      - Default to the current month, with previous/next month controls and quick filters for "ยังไม่ได้มอบหมาย", "มอบหมายแล้ว", branch, course type, and date range.
      - Day cards should summarize total slots, total learners, unassigned slots, saved slots, and warning severity.
      - Any day with at least one unassigned slot should show a red alert indicator; days with all booked slots assigned should show a green check.
      - After choosing a day, show slot cards grouped by time/course/branch with red alert for unassigned slots and green check for assigned slots, so Head Coach does not need to open each slot to discover work.
      - Keep only one selected slot expanded for group editing to avoid rendering a huge form for a busy month.
    - Assignment slot list at high volume:
      - Add status tabs or segmented control: "ต้องมอบหมาย", "มอบหมายแล้ว", "ทั้งหมด".
      - Add compact slot rows/cards with time, branch, course type, learner count, Level range, saved/unassigned state, and responsible coach names.
      - Preserve duplicate coach prevention: a coach already assigned to a non-empty group in the same slot must be disabled/greyed and blocked by server validation.
    - Coach attendance UX for busy days:
      - Attendance should group learners by teaching slot and assignment group, not show one long flat list.
      - Add a sticky daily slot summary at the top: total slots, checked-in slots, completed attendance, missing attendance.
      - Each slot card should show status: upcoming, open for attendance after check-in, completed, missing, or locked because Coach has not checked in.
      - For a day with 3 slots and 18 learners, show collapsible slot sections; expand the selected/active slot first and keep completed slots collapsed by default.
      - Past slots should not disappear. They should remain visible with their final status so Coach/Admin can audit attendance and weekly hours evidence.
      - Attendance actions should remain locked when there is no check-in for that specific slot.
    - Coach student list UX for more than 20 learners:
      - Replace the simple card list with searchable/filterable student management.
      - Add search by student name, parent name, phone, branch, Level, course type, and last taught date.
      - Add filters for assigned now, previously taught, active this month, Level band, child/adult, and branch.
      - Use pagination or incremental loading so the page does not become one huge scroll when a Coach has many historical learners.
      - Keep the coach-student memory visible: total sessions together, last taught date, latest Level, and current responsible group/slot where applicable.
    - Coach hours UX for many monthly rows:
      - Add month/week filters and a weekly accordion/table so a busy month does not become an endless vertical list.
      - Keep KPI cards compact, then show weekly summaries first; expand a week to see slot-level evidence.
      - Add evidence filters: complete, missing check-in, missing photo/location, missing attendance, not yet taught.
      - Keep the calculation source tied to verified assignment groups, check-in selfie/location, and attendance evidence.
    - Teaching programs workflow:
      - Split "โปรแกรมสอน" into reusable program templates and per-slot program submissions.
      - Coach can create, edit, archive, and reuse their own program templates, such as warm up, footwork, rally, or Level-specific drills.
      - When preparing for a real assigned slot, Coach selects one of their templates, can adjust details for that slot, then submits it to Super Admin/Admin review.
      - Program submission must link to the real `schedule_slot_id`, assignment group, coach_id, branch, date, time, course type, and learner group.
      - Coach should be able to see submission status: draft, submitted, reviewed/approved, returned for revision.
      - Super Admin/Admin review UI can come after Coach submission source is stable, but the DB/API should not be hardcoded to free text only.
      - All Coaches should submit teaching programs for all teaching systems/course types where they are assigned.
    - Seed and QA requirements for this hardening pass:
      - Expand or adjust realistic seed data to include at least one Head Coach day with 3 teaching slots and around 18 assigned learners, plus one Coach with more than 20 historical learners and a month with many teaching-hour rows.
      - Keep `npm run seed:cleanup` able to remove all generated seed data before deployment.
      - Verify `npm run check:mojibake`, `npm run build`, and authenticated Coach/Head Coach smoke tests after implementation.
    - Implementation status on 2026-05-17:
      - [x] Head Coach assignment now uses month-aware planning, status filters, red unassigned warnings, green saved checks, and clearer Thai status copy: unassigned, saved, and changed-but-unsaved.
      - [x] Duplicate coach prevention remains active: the seed verifier confirms `duplicate_coach_group_slots = 0`, and the UI keeps already-used coaches unavailable for another non-empty group in the same slot.
      - [x] Coach attendance now groups by assigned teaching slot and student group, adds daily summary cards, keeps past slots visible, and collapses busy days instead of rendering one long flat list.
      - [x] Coach student list now supports search, filters, and pagination for larger history lists.
      - [x] Coach hours now uses weekly summaries and expandable evidence rows instead of an endless monthly list.
      - [x] Teaching program submission is now linked to real assigned slots and can reuse preset/previous content before saving draft or submitting.
      - [x] Realistic seed verification passed after reseed: 7 branches, 7 Head Coaches, 21 Coaches, 21 Users, 245 booking sessions, 196 assignment groups, 28 check-ins, 35 attendance rows, and 28 teaching programs.
      - [x] Coach Program Template Library: add a persistent per-coach template table/API/UI so each Coach can create, edit, archive, and reuse their own teaching-program templates separately from per-slot submissions.
      - [x] Follow-up debt closed: Admin Payroll weekly close now uses an app dialog instead of the old `window.prompt`. Product UI must continue to avoid browser-native `alert`, `confirm`, or `prompt`.
  - [x] 15.3.2 Admin Teaching Program Review Page
    - Keep this in the Coach completion queue before moving to User flow.
    - Add an Admin/Super Admin page/menu for reviewing teaching programs submitted by Coaches.
    - Filters: status, coach, branch, date range, course type, and assigned slot.
    - Each row/card should show coach, branch, date/time, course type, learner group, submitted content, notes, and review status.
    - Admin/Super Admin can approve or return for revision with notes; Coach should see the result and revise only returned/draft items.
    - Notifications for submitted teaching programs should link to this review page instead of a generic admin log page.
    - Do not allow duplicate per-slot submissions: one Coach can have only one teaching program per assigned schedule slot.
    - Implementation status on 2026-05-18:
      - [x] Added Admin menu/page `/admin/teaching-programs` for filtering submitted programs by status, coach, branch, course type, and date range.
      - [x] Added detail view plus approve/return-for-revision actions using app dialogs, not browser-native alerts/prompts/confirms.
      - [x] Added Admin review API with activity logs and per-coach notifications back to `/coach/programs`.
      - [x] Coach submitted-program notifications now link directly to `/admin/teaching-programs`.
      - [x] High-volume UX pass: changed the review page from long stacked cards into a compact work queue with detail panel and pagination.
      - [x] Admin Ranking image runtime error from DiceBear seed avatars fixed by adding `api.dicebear.com` to the Next image allowlist.
      - [x] Admin Payroll high-volume UX pass: changed the long all-coach card list into a summary table with detail drawer, and replaced the weekly-close `window.prompt` with an app dialog.
  - [x] 15.3.3 Admin List UX Scalability Pass
    - Do this before closing Coach/Admin QA and before starting User flow, because Admin must monitor Coach workflow at realistic volume.
    - Goal: remove long endless Admin lists where data can grow daily or monthly; use compact queue/table, filters, pagination, and detail drawer/dialog instead.
    - Keep already-approved pages stable. Do not redesign pages that were recently accepted unless a real bug appears.
    - Priority 1: `/admin/coach-checkins`.
      - Default to today/week instead of dumping the whole month.
      - Add summary by coach and status: total assigned rounds, checked in, late, missing, missing photo/location.
      - Show abnormal items first and open slot/selfie/GPS evidence in a drawer.
      - Support date range, branch, coach, and status filters without rendering every row as a large card.
    - Priority 2: `/admin/logs`.
      - Replace the long card stream with compact audit table, pagination, and JSON detail drawer.
    - Priority 3: `/admin/notifications`.
      - Add pagination or compact queue for Admin inbox/history so broadcasts and event notifications do not become endless scroll.
    - Priority 4: `/admin/coupons`.
      - Replace high-volume coupon cards with a compact summary table and detail drawer for usage history.
    - Priority 5: `/admin/finance`.
      - Compact manual expenses, coach payout summaries, and branch/course breakdowns.
      - Replace remaining browser-native `confirm` with app dialog.
    - Later pass: add pagination/page-size to Admin users, coaches, complaints, and other table-like pages if realistic data volume makes them too long.
    - Verification required after each batch: `npm run check:mojibake`, `npm run build`, and smoke test the touched Admin pages after restarting/clearing stale Next dev cache when needed.
    - Implementation status on 2026-05-18:
      - [x] Added shared Admin `ListPagination` control for consistent page-size and next/previous behavior.
      - [x] `/admin/coach-checkins` now defaults to week scope, shows KPI/status summary, coach summary, abnormal-first rows, filters, pagination, and evidence detail dialog.
      - [x] `/admin/logs` now uses compact audit table, filters, pagination, and JSON detail dialog instead of endless cards.
      - [x] `/admin/notifications` inbox and history now paginate separately.
      - [x] `/admin/coupons` now paginates coupon cards while keeping existing detail/edit flow intact.
      - [x] `/admin/finance` manual expenses now paginate and delete through an app dialog instead of browser-native confirm.
      - [x] Added pagination/page-size to `/admin/payments`, `/admin/users`, `/admin/coaches`, `/admin/complaints`, and `/admin/branches`.
      - [x] Verified `npm run check:mojibake`, `npm run build`, and HTTP smoke checks for touched Admin pages.
      - [x] Follow-up: added the same pagination/page-size pattern to `/admin/ranking`, `/admin/makeup`, and `/admin/payroll` where realistic data volume can still create very long pages.
      - [x] Follow-up: added `/admin/payments/settings` for bank transfer display data shown to users on slip upload, with a clear warning that the displayed account must match SlipOK.
  - [x] 15.4 Coach Notifications / Reminders
    - [x] Notify Coach when assigned to a teaching slot/group.
    - [x] Notify Coach when a slot has learners but check-in has not happened near the allowed window, where technically feasible.
    - [x] Notify Coach/Head Coach for attendance gaps that block weekly teaching hours.
    - [x] Badge counts must be per logged-in Coach, not global.
    - Implementation status on 2026-05-17:
      - Assignment group save now creates per-coach schedule notifications linked to `/coach/today?date=YYYY-MM-DD`.
      - Coach check-in success now creates an attendance reminder linked to the assigned attendance page for that slot.
      - Coach layout/notifications page now creates idempotent check-in-window reminders and attendance-gap reminders before unread badge/count rendering.
      - Coach notification page now uses Coach-specific copy while reusing the shared notification list/read actions.
      - Verified with `npm run build`, `npm run check:mojibake`, `npm run seed:verify`, and authenticated Head Coach/Coach smoke tests.
  - [x] 15.5 User Booking / Payment / History
    - User booking must read available slots from DB `schedule_templates` only.
    - Same-day booking is allowed only for future sessions that have not started yet.
    - Booking price must use DB `pricing_tiers`.
    - Coupon usage must decrement availability and appear in user history.
    - SlipOK payment success must make booking/payment/history statuses consistent without manual admin approval.
    - Production pricing true-up closeout on 2026-07-02:
      - Source commit `5897cede58f720c1b5f205af53c9821cff0a39bf` (`fix(pricing): true up kids group monthly tiers`) is deployed to production alias `https://www.newathleteschool.com` via deployment `dpl_5e6i8M3Mtzy5xNah6xVD9v6PtHwQ` (Ready).
      - kids_group split sibling monthly bookings now true-up to the final monthly tier total: `targetMonthlyTotal = finalMonthlyPerSession * (existingSessions + newSessions)` and `incrementalPrice = max(0, targetMonthlyTotal - existingPersistedBookingTotals)`.
      - Dry-run proof passed: single 16 sessions = `THB 6,496`; split 8 + 8 = `THB 4,000 + THB 2,496 = THB 6,496`; existing 8 then add 1 keeps expected 7-10 tier behavior.
      - Coupon limitation remains: true-up subtracts persisted `bookings.total_price`; coupon true-up semantics need owner decision because no pre-discount subtotal snapshot exists.
      - Branch-scope limitation remains: preserved current same `user_id + course_type_id + month/year + status` scope; branch-specific monthly pricing needs owner decision if required.
      - Owner-approved production DB repair for the existing July mismatch is complete: target booking `ff0728dd-066a-417a-aeaa-0049fed6b931` was updated from `bookings.total_price = 3248` to `2496`; paired booking `10254533-f76a-4985-bf0d-af18942a3b85` remained `4000`; combined July 2026 total is now `6496`.
      - Post-repair verification passed: both bookings remain `pending_payment`; payment rows remain 0; coupon usages remain 0; `booking_sessions` were unchanged by fingerprint; booking status was unchanged; activity log `07150189-0a5e-4fe6-bd20-24c47b4b9a75` exists with action `pricing_true_up_repair`.
      - Owner-approved July 2026 current-month DB repair for 4 additional kids_group mismatch groups is complete. Owner policy: ignore June historical mismatches; repair July 2026 current-month mismatches even when payment exists; keep payment rows as evidence of actual transfer and do not modify `payments.amount`; do not create refund/coupon/payment rows; do not touch `booking_sessions`, `pricing_tiers`, Trin/Bin, or June groups.
      - Root cause for these groups: old incremental pricing charged `final tier per-session * newSessions` and did not true-up earlier higher-tier bookings. The source fix prevents future repeats.
      - Exact rows: `5d1d9a43-afcd-4d26-8817-68ab948443f2` `2800 -> 1169` log `04cf71ee-5718-49a7-8a5f-364d44a9184f`; `3f95767e-8418-4b0b-b87d-2cd18811825b` `14700 -> 13600` log `e2aa73ff-b1b9-4168-b58a-28ffc3128a1d`; `f565a552-65f3-44e0-8826-22a4c9cb0dbb` `1299 -> 763` log `c953f942-7d67-44d0-b8a5-b0abefa213a0`; `ff9cf27f-6415-444d-90b6-89ab05fc2d47` `2000 -> 1500` log `e46f9fb1-608e-48d6-a6a5-0c0bd7a7746a`.
      - Post-repair group totals: Ningnong `7700`; Kanokpan `16100`; Siripong `4763`; Janyawat `4000`. Latest batch total July reduction is `3767`; total July reduction including Trin/Bin is `4519`.
      - Post-write verification passed: payments unchanged by fingerprint; `booking_sessions` unchanged by fingerprint; `pricing_tiers` unchanged by fingerprint; no coupon rows created; no booking/payment/refund/coupon created; non-target bookings in those groups unchanged; Trin/Bin remains matched at `6496`; June guarded bookings unchanged.
      - Rollback condition for these exact DB repairs: rollback only before further dependent accounting/credit/payment action; if later accounting action exists, stop and re-plan.
      - Production smoke passed with no console/runtime/hydration/React #418 errors. UI price preview is `NEED REVIEW` only because reproducing the exact target case would risk entering booking creation flow.
      - Remaining limitations: coupon true-up semantics still need owner decision if a coupon case appears later; branch-scope policy for future business rules remains owner decision, while this July repair followed current source scope.
      - No source code, migration, deploy, booking/payment/refund/coupon creation, slip upload, `ยืนยันการจอง`, or product write action beyond the exact owner-approved DB repairs was performed.
    - Audit notes on 2026-05-19 before implementation:
      - Booking page already reads `schedule_templates`, enforces same-day future slots in the UI, and posts new bookings through `/api/bookings`.
      - `/api/bookings` revalidates price from DB `pricing_tiers`, validates coupon usage, decrements coupon usage, and sets bookings to `pending_payment`.
      - Gap: newly created User booking sessions do not currently persist `schedule_slot_id`; Coach assignment/check-in/attendance flows rely on `schedule_slot_id`, so User-created sessions must resolve/create the real `schedule_slots` row before insert.
      - Gap: pending-booking edit mode in `booking-client` still mutates `booking_sessions` directly from the client and should be moved behind a server API or removed.
      - Gap: `history-client` still has old "choose dates later" and delete-session flows that insert/delete sessions directly, bypass DB schedule templates, server pricing, and Coach assignment linkage.
    - [x] 15.5.1 Resolve User bookings to real `schedule_slots`
      - For every selected session, find or create the matching `schedule_slots` row from DB template/date/branch/course/start/end.
      - Save `schedule_slot_id` on `booking_sessions` for new bookings and pending edits.
      - Keep same-day future-slot validation on both client and server.
      - Completed on 2026-05-19:
        - `schedule_templates` now carry template ids into the booking calendar, including one-hour private subslots.
        - `/api/bookings` resolves every posted session against an active DB template, creates/reuses the matching `schedule_slots` row, and saves `schedule_slot_id` on `booking_sessions`.
        - Pending booking edit now goes through server-side `PUT /api/bookings` instead of mutating `booking_sessions` directly from the client.
        - Verified `npm run check:mojibake` and `npm run build`; build passes with existing lint warnings in older User/API files.
    - [x] 15.5.2 Remove or refactor old pending edit/delete/date-pick paths
      - Replace direct client mutations in history/booking edit with server-side APIs that validate ownership, payment status, DB templates, pricing, and coupon consistency.
      - Do not allow arbitrary dates/times that are not backed by DB schedule templates.
      - Completed on 2026-05-19:
        - Removed the old manual "choose dates later" dialog from User history so Users can no longer insert arbitrary dates/times outside DB schedule templates.
        - Removed the pending-session delete action from the history detail modal; pending bookings now use the calendar edit flow from `15.5.1`.
        - Pending booking cancellation now goes through `DELETE /api/bookings`, which validates ownership and `pending_payment` status before deleting sessions and marking the booking cancelled.
        - Verified there are no remaining direct `booking_sessions` insert/delete calls in `history-client` or `booking-client`.
        - Verified `npm run check:mojibake` and `npm run build`; build passes with existing lint warnings in older User/API files.
    - [x] 15.5.3 Payment/history final consistency
      - Verify SlipOK success creates payment records, updates booking status, keeps coupon history visible, and does not require Admin manual approval.
      - Make pending/paid/verified history copy clear for User.
      - Completed on 2026-05-19:
        - Hardened `/api/verify-slip` so every submitted booking id must belong to the current user, still be `pending_payment`, and match the expected payment total before a slip can update records.
        - SlipOK/test-mode success now creates payment rows, updates booking status consistently (`verified` when approved, `paid` when still pending), and sends User/Admin notifications.
        - User history now uses clearer status copy for `pending_payment`, `paid`, and `verified`, keeps coupon usage visible, and no longer exposes Admin-style approve/reject controls.
        - Booking edit/create API now resolves sessions through DB schedule templates and real `schedule_slots`, validates ownership, recalculates pricing server-side, and keeps coupon usage/counts consistent.
        - Cleaned warnings in touched User/payment files and repaired mojibake in the booking flow before verification.
        - Verified `npm run check:mojibake` and `npm run build`; build still reports older lint warnings in User dashboard/schedule/reschedule/children/notifications files that are outside this payment/history pass.
  - [x] 15.6 User Schedule / Reschedule / Makeup
    - User schedule must show month/day/session overview clearly.
    - Absence/overdue session logic must connect to makeup rules.
    - Reschedule and makeup choices must come from DB schedule templates.
    - User must not see or perform Admin-only actions.
    - Audit notes on 2026-05-19 before implementation:
      - Schedule page already shows verified sessions by month and excludes old `rescheduled` sessions.
      - Reschedule UI reads `schedule_templates` and applies the 24-hour rule plus same-month rule for normal users.
      - Gap: reschedule currently mutates `booking_sessions` directly from the client and does not save `schedule_slot_id` for the new session.
    - [x] 15.6.1 Server-side User reschedule API
      - Validate ownership, verified booking, 24-hour rule, same-month rule, DB template availability, and schedule-slot resolution on the server.
      - Save the new session with `schedule_slot_id` and mark the old session as `rescheduled` atomically as much as Supabase allows.
    - [x] 15.6.2 User schedule UX pass
      - Keep month/day overview compact on mobile and desktop.
      - Show rescheduled-from context and makeup/reschedule status without long vertical lists.
    - Completed on 2026-05-20:
      - Added `/api/reschedule` so User reschedule validates ownership, verified booking, scheduled/non-makeup session, 24-hour rule, same-month rule, DB template coverage, real `schedule_slot_id`, same-slot duplicate prevention, and learner-specific duplicate prevention.
      - Removed direct client-side `booking_sessions` mutation from `reschedule-client`; the User UI now calls the server API and keeps Admin-only makeup/cross-month control out of the User page.
      - User schedule/reschedule pages now use typed server data, compact month/day views, rescheduled-from context, and crowded calendar indicators with `+N` instead of long overflowing dots.
      - Cleaned User-side lint warnings in the touched schedule/reschedule/notification/dashboard/children/complaint helper path.
      - Verified `npm run check:mojibake` and `npm run build`; build passes without lint warnings.
    - Hotfix 2026-05-23:
      - Reschedule modal now disables the original same date/time/branch/course slot and labels it `(รอบเดิม)` so users cannot choose the same class again.
      - `/api/reschedule` now rejects the same original slot by date/time/branch context before creating/reusing a target `schedule_slot_id`, and duplicate checks now compare learner/date/time/branch/course instead of relying only on slot id.
      - Checks passed: `npx tsc --noEmit`, `npm run lint`, and `npm run check:mojibake`.
  - [x] 15.7 Shared Notifications
    - Notification badge counts must be correct per recipient user, coach, admin, or super admin.
    - Important events should create notifications: booking created, payment verified, makeup granted, coach assigned, attendance/absence where useful.
    - Admin broadcast notifications must appear as one unread notification per recipient, not as a global shared count.
    - Audit notes on 2026-05-19 before implementation:
      - Payment verified currently notifies the User and Admin roles.
      - Booking created currently notifies Admin/Super Admin; User-facing booking-created feedback should be checked after booking flow cleanup.
      - Reschedule currently notifies Admin roles and branch coaches, but should be called only after the server-side reschedule succeeds.
    - Completed on 2026-05-20:
      - Added `notifyUserOnce` shared helper so event notifications that may be triggered repeatedly can avoid duplicate unread rows for the same user/title/message/link.
      - Booking creation now also notifies the User that the booking was created and needs slip upload, while keeping Admin/Super Admin notification intact.
      - Admin makeup creation now notifies the booking owner that a makeup session has been granted.
      - Coach attendance now notifies the booking owner when a learner is marked absent or late, with the assigned slot label and schedule link.
      - Verified badge-count behavior remains per `notifications.user_id` in Admin, Coach, and User layouts; Admin broadcast route inserts one row per recipient.
      - Verified `npm run check:mojibake` and `npm run build`; build passes without lint warnings.
  - [x] 15.8 Coach/User Regression Pass
    - After 15.1-15.7 are done, run build, mobile responsive checks, and end-to-end smoke tests.
    - Fix lint debt only in touched files or in areas that put the completed flow at risk.
    - Completed on 2026-05-20:
      - Verified `npm run check:mojibake`, `npm run lint`, `npm run build`, and `git diff --check`.
      - `next lint` passes with no ESLint warnings or errors.
      - Public smoke passed for `/` and `/auth/login` on the local dev server.
      - User/Coach protected route smoke passed unauthenticated guards: `/dashboard/*` and `/coach/*` routes return redirects to login instead of 500/error HTML.
      - Browser automation could not open localhost in the in-app browser because the browser surface returned `ERR_BLOCKED_BY_CLIENT`; HTTP smoke was used as the fallback verification path.
      - No additional code changes were required during this regression pass.
  - [x] 15.9 User High-Volume UX Pass
    - Audit User-facing pages for long vertical lists before production UAT.
    - Focus pages: history, notifications, children/learners, complaints, schedule, reschedule, and booking summaries.
    - Add compact grouping, pagination, filters, or detail dialogs only where real high-volume data can become hard to scan.
    - Keep booking/payment/business rules unchanged; this pass is layout and usability only.
    - Verify mobile and desktop after changes with `npm run check:mojibake`, `npm run lint`, and `npm run build`.
    - Completed on 2026-05-20:
      - Added pagination to User notifications so high-volume broadcasts and event messages do not render as one long page.
      - Added learner search and pagination to the User children/learners page.
      - Added status filtering and pagination to User complaints.
      - Collapsed booking history and reschedule sessions by month with “show more” controls.
      - Added a bounded scroll area to selected-date schedule details for days with many sessions.
      - Verified `npm run check:mojibake`, `npm run lint`, `npm run build`, and `git diff --check`.
  - Completed on 2026-05-20:
    - Coach-first/User-last implementation queue is closed through `15.9`.
    - Remaining verification should continue under `18. Real Login UAT By Role` and `19. User Payment / Booking Final UAT`, not by reopening the full `15.x` implementation queue.
    - Keep Admin/System changes limited to real regression fixes while the stabilization queue is active.

  - [x] 16. Home Index Polish Before User Flow
    - Do this before starting `15.5 User Booking / Payment / History` because it affects the public entry point, login UX, and first impression before User-side completion work.
    - Scope: Home Index and public auth polish only. Do not change booking/payment/user business logic in this pass.
    - Smooth public navigation:
      - Improve `PublicNavbar` section navigation so clicking menu items scrolls smoothly to the correct section with sticky-header offset.
      - Replace the current browser-default black focus outline with brand-consistent accessible focus styling.
      - Support navigating from other routes back to `/#section` and scrolling after the Home page loads.
      - On mobile, close the sheet first, then scroll smoothly without jumpy layout behavior.
    - Login redirect loading:
      - Add a clear loading/redirect state after successful login in both `AuthModal` and `/auth/login`.
      - Keep submit buttons disabled while signing in and while redirecting to the role dashboard to prevent repeat clicks.
      - Show user-friendly copy such as "กำลังพาไปหน้าแดชบอร์ด..." instead of closing the modal abruptly.
      - Preserve existing role-based redirect logic from `getHomePathForRole`.
    - Hero motion / badminton identity:
      - Add restrained badminton-themed motion on the Home hero, such as a floating shuttlecock, racket accent, or motion trail.
      - Prefer lightweight CSS/Tailwind animation; do not add a new animation library for this polish pass.
      - Respect `prefers-reduced-motion` so users who reduce motion are not forced to see animation.
      - Keep the hero clean and inspection-friendly; avoid decorative orbs, heavy gradients, or animation that competes with the main CTA.
    - Expected files:
      - `src/components/layout/public-navbar.tsx`
      - `src/components/shared/auth-modal.tsx`
      - `src/app/auth/login/page.tsx`
      - `src/app/page.tsx`
      - `src/app/globals.css` only if keyframes or shared motion/focus styles are needed.
    - Verification:
      - Run `npm run check:mojibake`.
      - Run `npm run build`.
      - Browser smoke desktop/mobile for `/`: menu clicks, section offsets, ranking link, login modal loading state, and console errors.
      - Browser smoke `/auth/login`: loading state, disabled repeat submit, and role redirect behavior where a real session can be tested.
    - Completed:
      - `PublicNavbar` section navigation now uses real anchor fallback plus custom easing scroll with sticky-header offset, focus-visible styling, and route/hash support.
      - Follow-up fix: removed the `prefers-reduced-motion` CSS override that forced section links to jump instantly; reduced-motion users now get a shorter controlled scroll instead of a hard jump while hero motion remains disabled.
      - `AuthModal` and `/auth/login` now keep a redirect/loading state after successful login and disable repeat submit while routing to the role dashboard.
      - Home hero now has restrained badminton-themed CSS motion and respects `prefers-reduced-motion`.
      - Verified `npm run check:mojibake` and `npm run build`; build passes with existing lint warnings in older Dashboard/User/API files.
      - Browser smoke verified `/` section anchor fallback and `/auth/login` render with no console errors. Login modal could not be smoke-opened in the current browser session because the public navbar was already in an authenticated/loading state, but the modal code path was covered by build/type checks.

## Next Stabilization Order Before Deploy

- [x] 17. TODO Housekeeping / Close Completed Planning Items
  - Reconcile parent/child checklist status so `DEVELOPMENT_TODO.md` matches the real state of the system.
  - Confirm `Phase 3 - Make npm run build pass` status after recent successful builds.
  - Confirm `15. Start Coach-First / User-Last Completion Queue` parent status now that core children through `15.9` are completed.
  - Keep only real remaining work open so future development does not loop back into completed flows.
  - Completed on 2026-05-20:
    - Marked parent `15. Start Coach-First / User-Last Completion Queue` complete because all tracked child items through `15.9` are complete.
    - Marked parent `15.5 User Booking / Payment / History` complete because `15.5.1` through `15.5.3` are complete.
    - Kept role-based UAT, payment/booking final UAT, seed cleanup, production env, and staging deploy open because those require real login/staging validation.
    - Reconfirmed current local checks: `npm run check:mojibake`, `npm run lint`, `npm run build`, and `git diff --check`.

- [x] 18. Real Login UAT By Role
  - Super Admin: settings, payment settings, ranking, teaching program review, payroll, finance.
  - Admin: allowed menu visibility, payment monitoring, complaints, notifications.
  - Head Coach: assign groups, coach suggestion, calendar, student grouping.
  - Coach: schedule, check-in, attendance, level/ranking, teaching program, hours.
  - User: booking, coupon, slip upload, history, schedule, reschedule, notifications.
  - Completed 2026-05-20:
    - Verified seed auth users exist and reset seed passwords to `NascSeed@2026` for repeatable UAT.
    - Verified seed data counts via `npm run seed:verify`.
    - Real session route smoke tested by role with Supabase SSR cookies:
      - Super Admin: `/admin`, `/admin/settings`, `/admin/payments`, `/admin/ranking`, `/admin/teaching-programs`, `/admin/payroll`, `/admin/finance` returned `200`.
      - Admin: `/admin`, `/admin/payments`, `/admin/complaints`, `/admin/notifications` returned `200`; `/admin/settings` correctly redirected back to `/admin`.
      - Head Coach: `/coach`, `/coach/assign-groups`, `/coach/today`, `/coach/students`, `/coach/programs`, `/coach/hours` returned `200`.
      - Coach: `/coach`, `/coach/today`, `/coach/checkin`, `/coach/attendance`, `/coach/levels`, `/coach/programs`, `/coach/hours` returned `200`; `/coach/assign-groups` correctly redirected back to `/coach`.
      - User: `/dashboard`, `/dashboard/booking`, `/dashboard/history`, `/dashboard/schedule`, `/dashboard/reschedule`, `/dashboard/progress`, `/dashboard/notifications` returned `200`.
    - Note: in-app Browser client could open local pages, but Supabase client-side login was blocked by the test environment's external network path, so final UAT used real Supabase Auth sessions and Next route requests instead of UI form clicks.

- [x] 19. User Payment / Booking Final UAT
  - Verify same-day booking allows only slots that have not started.
  - Verify coupon usage deducts usage count and appears in user history.
  - Verify SlipOK success keeps booking, payment, and history statuses consistent.
  - Verify user can view slip, booking history, schedule, and notification state correctly.
  - Completed 2026-05-20:
    - Ran real authenticated UAT as `seed.nasc+adult.group.chaengwattana@example.com` against localhost + Supabase.
    - Verified same-day started slot `13:00` was rejected and same-day future slot `19:00` was bookable.
    - Created a one-use UAT coupon, confirmed `/api/validate-coupon`, booking usage row, `current_uses = 1`, and auto close after max use.
    - Uploaded a UAT slip through `/api/verify-slip` with `SLIPOK_TEST_MODE=true`; confirmed `bookings.status = verified`, `payments.status = approved`, amount, slip URL, and user notification link.
    - Confirmed `/dashboard/booking`, `/dashboard/history`, `/dashboard/schedule`, and `/dashboard/notifications` render with the authenticated user session.
    - Cleaned up the temporary UAT booking, coupon, payment, coupon usage, slip file, sessions, and UAT notifications after verification.
    - Tightened User history session loading so it fetches only `booking_sessions` for bookings visible on that page instead of scanning all sessions.

  - [x] 19.1 User Schedule Coach / Attendance Context
  - Improve `/dashboard/schedule` so User can understand each real class session, not only the date and time.
  - Connect `booking_sessions.id` to `coach_assignment_group_students.booking_session_id`, then `coach_assignment_groups.coach_id`, then `profiles` so each session can show the assigned Coach/Head Coach name, avatar, and role when available.
  - Connect `attendance` for each visible booking session so the User can see whether the learner is pending, present, late, absent, completed, rescheduled, or makeup.
  - Extend the data shape passed into `ScheduleCalendarClient` with coach info, assignment status, attendance status, and a user-friendly session display status.
  - Redesign the calendar cells and selected-day detail cards:
    - Keep calendar cells compact with session counts/status indicators, especially on mobile.
    - Show session cards below the calendar with time, branch, learner, course type, assigned coach, attendance status, makeup/reschedule context, and clear fallback text such as "ยังไม่ได้มอบหมายโค้ช".
    - Avoid long overflowing day content; use bounded detail areas and concise badges.
  - Regression checks:
    - User with multiple children.
    - Self/adult learner.
    - Assigned coach versus not-yet-assigned coach.
    - Checked attendance versus no attendance yet.
    - Makeup and rescheduled sessions.
    - Mobile and desktop layout.
  - Completed:
    - `/dashboard/schedule` now joins coach assignment groups and attendance rows for each real booking session.
    - Selected-day session cards show learner, course, branch, assigned coach/head coach, assignment fallback, attendance/check-in status, makeup, and reschedule context.
      - Calendar cells stay compact with session count and bounded status indicators for mobile and desktop.
      - Checks passed: `npm run check:mojibake`, `npm run lint`, `npm run build`, `git diff --check`.

  - [x] 19.2 Attendance Gap Review Rule Across User/Admin/Coach
    - Replace the simple past-session display rule with a safer shared business rule for missing attendance.
    - Core rule:
      - If attendance exists for the learner, use the real attendance status: present, late, or absent.
      - If `booking_sessions.status` is already `completed` or `absent`, use that persisted status.
      - If the session is in progress, show "กำลังเรียน".
      - If the session is in the future, show "รอเรียน".
      - If the session has ended and the slot has attendance records for some students, any learner without attendance should be treated as "ขาดเรียน".
      - If the session has ended and the entire slot/group has no attendance records at all, do not automatically mark every learner as absent; route the slot to Admin review as "ต้องตรวจสอบการเช็คชื่อ".
    - User schedule behavior:
      - Past slot with partial attendance and this learner missing/absent: show "ขาดเรียน".
      - Past slot with no attendance for the whole slot/group: show "รอตรวจสอบการเช็คชื่อ" with a clear note that Admin/Coach must review.
      - Once Admin confirms absence, show "ขาดเรียน" and allow the normal makeup rule to apply.
    - Admin makeup behavior:
      - Do not auto-list whole-slot attendance gaps as actionable makeup until Admin confirms or attendance is entered.
      - Continue listing confirmed absent sessions and partial-attendance missed learners as makeup candidates.
      - Add status visibility so Admin can distinguish "ขาดเรียน" from "ต้องตรวจสอบการเช็คชื่อ".
    - Admin review UI:
      - Add or extend an Admin screen, likely under `เช็คอินโค้ช` or `วันชดเชย`, for ended slots/groups with zero attendance records.
      - Show date, time, branch, course type, assigned coach/group, student count, coach check-in status, selfie/location evidence, and current review status.
      - Actions should include: request coach correction, enter attendance retrospectively, confirm all absent, close/ignore with reason.
    - Coach workflow:
      - Keep blocking attendance until the coach check-in requirement is satisfied.
      - Add clear warnings for slots that ended without attendance so Coach/Head Coach can correct before Admin has to intervene.
    - Teaching hours/payroll behavior:
      - Do not automatically remove coach teaching hours only because all attendance is missing.
      - Mark the slot as missing attendance evidence for Admin review; coach hours should require check-in/photo/location and review status before closing.
    - Implementation notes:
      - Prefer a shared helper/service for derived session status so User schedule, Admin makeup, Coach attendance, and payroll do not drift again.
      - Existing quick UI change that labels all past unmarked sessions as "ขาดเรียน" must be revisited under this rule before final UAT.
    - Regression checks:
      - Past slot with no attendance for any student.
      - Past slot with partial attendance.
      - Past slot where this learner is explicitly absent.
      - Past slot where this learner is present/late.
      - Coach checked in but forgot attendance.
      - Coach did not check in and no attendance exists.
      - Admin confirms all absent and makeup eligibility appears.
      - Admin enters retrospective attendance and User schedule updates.
      - Mobile and desktop views for User schedule and Admin review.
    - Completed:
      - Added shared `src/lib/session-attendance-status.ts` so User/Admin screens derive class status from the same rule instead of each page guessing separately.
      - `/dashboard/schedule` now counts attendance in the learner's assignment group or whole slot fallback, so a past class with partial attendance can mark the missing learner as absent, while a class with zero attendance for everyone becomes `attendance_gap_review`.
      - User schedule now shows a separate orange review note for ended slots with no attendance records instead of saying the learner is absent immediately.
      - `/admin/makeup` now uses the same rule, excludes whole-slot attendance gaps from actionable makeup, and adds a review queue with a compact list and a "confirm absent" action.
      - Added `PATCH /api/admin/makeup` for Admin to confirm an ended normal session as absent, after which the normal makeup eligibility flow can apply.
      - Payroll/teaching-hours behavior remains guarded by the existing `has_attendance` evidence check; the new rule does not remove coach hours automatically when attendance is missing.
      - Checks passed: `npm run check:mojibake`, `npm run build`, `git diff --check`.

  - [x] 19.3 Admin Attendance Gap Resolution
    - Complete the Admin/Super Admin workflow for ended teaching rounds where Coach forgot all evidence: no attendance records, and possibly no coach check-in.
    - This is a follow-up to `19.2`; do not treat every no-attendance round as automatic student absence.
    - Admin review screen should show:
      - Date, time, branch, course type, assigned coach/group, learner list, and booking/session status.
      - Coach check-in status, selfie/photo evidence, location evidence, and check-in time if available.
      - Clear severity:
        - Attendance missing but coach checked in: likely Coach forgot attendance.
        - Attendance missing and coach did not check in: evidence gap for both Coach and learners.
    - Required Admin/Super Admin actions:
      - Confirm all absent: write/update attendance as `absent`, make the normal makeup rule eligible, and add audit log.
      - Enter retrospective attendance per learner: allow `present`, `late`, or `absent` with required reason/note.
      - Send back to Coach/Head Coach for correction: create notification/task state without making makeup eligible yet.
      - Close/ignore with reason: for cancelled/wrong data/no-action cases, without creating makeup.
    - User schedule result:
      - Confirmed `absent` shows as absent and can flow to makeup eligibility.
      - Retrospective `present` or `late` shows as attended and must not create makeup.
      - Pending coach/admin review stays as review status, not absent.
    - Coach/payroll result:
      - Student attendance correction must not automatically approve Coach teaching hours when Coach check-in/photo/location evidence is missing.
      - Slots with missing Coach evidence should remain visible for Super Admin review before weekly teaching-hour closing.
    - Audit requirements:
      - Store who resolved the gap, when, what action was selected, and the reason/note.
      - Avoid browser native `confirm`, `alert`, or `prompt`; use the project dialog design system.
    - Regression checks:
      - Coach checked in but forgot all attendance.
      - Coach did not check in and no attendance exists.
      - Mixed retrospective attendance: some present, some absent.
      - Confirm all absent creates makeup candidates.
      - Present/late retrospective attendance does not create makeup candidates.
      - Send back to Coach keeps User/Admin status pending review.
      - Mobile and desktop review layout.
    - Completed 2026-05-21:
      - `/admin/makeup` review queue now shows assigned coach/group, coach check-in time, and photo/location evidence state for ended sessions with zero attendance.
      - Admin/Super Admin can resolve each attendance gap as confirmed absent, retrospective present/late/absent, send back to assigned Coach, or close the case with a required audit reason where needed.
      - `PATCH /api/admin/makeup` now writes retrospective attendance, updates session status, sends user/coach notifications, and logs each resolution path to Activity Log.
      - Confirmed absent flows back into normal makeup eligibility; retrospective present/late closes the gap without creating makeup eligibility.
      - Close/ignore uses a completed session state plus Activity Log reason to keep the case out of makeup while preserving an audit trail.
      - Coach can retroactively check in only for slots Admin returned via `attendance_gap_request_coach_review`; normal past slots remain blocked.
      - `/coach/attendance` now exposes a "เช็คอินย้อนหลัง" path for Admin-returned gaps, then normal attendance can be recorded after selfie/location check-in exists.
      - Checks passed: `npm run check:mojibake`, `npm run lint`, `npm run build`, `git diff --check`.
    - [x] 19.3.1 Pre-commit UAT for Admin-returned attendance gap
      - Find or create one disposable ended slot with assigned Coach, learner session, no attendance, and no/optional check-in.
      - Admin action: send the gap back to Coach and verify notification + Activity Log.
      - Coach action: open the returned slot, retroactively check in with selfie/location, then mark attendance.
      - Verification: Admin makeup queue no longer shows the gap after attendance exists.
      - Verification: User schedule shows absent/present/late correctly and makeup eligibility follows the same shared rule.
      - Completed 2026-05-21:
        - Added `npm run uat:attendance-gap`, a guarded disposable Supabase UAT that creates only `uat.nasc+attendance.gap.*@example.com` accounts and `NASC_UAT_ATTENDANCE_GAP` schedule data.
        - UAT verifies Admin-returned attendance gap detection, Coach retroactive check-in permission, present/late/absent attendance outcomes, booking session status mapping, and gap queue closure after attendance exists.
        - UAT auto-cleanup passed after the run: 3 profiles, 1 slot, and 3 sessions removed.
        - Check passed: `npm run uat:attendance-gap`.

  - [x] 20. Seed Data Cleanup / Production Readiness
  - Prepare a safe cleanup plan for seed/demo data in Supabase before production.
  - Separate master data that must remain, such as levels, pricing, schedule templates, branches, and system settings.
  - Review Supabase buckets, storage policies, RLS behavior, and required production env vars.
  - Completed 2026-05-20:
    - Added `npm run prod:check` as a read-only production readiness checker for Supabase env vars, seed/demo data, master data, required system settings, placeholder media URLs, and Storage buckets.
    - Added `PRODUCTION_READINESS.md` with the safe order for backup, checking, seed verification, seed cleanup, and post-cleanup verification.
    - Confirmed current remote master data is present: 7 active branches, 3 course types, 702 active schedule templates, 70 active levels, 11 pricing tiers, and required buckets `avatars`, `coach-checkins`, and `payment-slips`.
    - Confirmed production warnings that must be resolved before deploy: 51 seed auth/profile users still exist, placeholder payment/check-in URLs still exist, `SLIPOK_TEST_MODE=true`, and `coach_teaching_rules_settings` has not been saved yet in `system_settings`.
    - Checks passed: `node --check scripts/production-readiness-check.js`, `npm run check:mojibake`, `npm run lint`, `npm run prod:check`, and `git diff --check`.

  - [x] 20.1 User Lesson Wallet / Same-Month Learning Credit
  - New owner requirement before deploy: users can move a paid/verified learning session into a same-month "lesson wallet" when they cannot choose a new date yet.
  - Hard rules:
    - A session can be moved into the wallet only if the booking is paid/verified, the session has not started, no attendance exists, and the request is at least 48 hours before the session start time.
    - If the user forgets to move it before the 48-hour cutoff, the session remains on the schedule and normal absence/makeup rules apply; no late wallet action.
    - Wallet credits can only be redeemed into another available schedule slot in the same month and before that target slot starts.
    - Redeeming a wallet credit does not create a new payment because it uses the already-paid session entitlement.
    - Walleted sessions are not absent, not completed, not makeup-eligible, not coach-payable, and must not be included in coach attendance/hour calculations.
    - Unused wallet credits expire at the end of the original booking month and do not carry over.
  - Safety design:
    - Do not delete the original booking/payment record; preserve audit history.
    - Add DB support for lesson wallet credits and/or a clear `booking_sessions` wallet status/mapping.
    - When a session is moved into the wallet after Head Coach assignment exists, remove only that learner from `coach_assignment_group_students`, reduce slot occupancy, and only notify Head Coach/Coach when active learners remain unassigned after the cleanup.
    - If the learner was the only student in a group, keep the assignment auditable but ensure empty groups are not treated as payable teaching evidence.
    - When redeemed into a new slot, create/reactivate a scheduled session that enters the normal Head Coach assignment flow again.
  - Required implementation:
    - DB migration for wallet credit records, status/audit fields, and safe indexes.
    - User UI for "เก็บเข้ากระเป๋า" and "ใช้วันเรียนจากกระเป๋า" with 48-hour cutoff messaging.
    - User schedule/history must show walleted, redeemed, and expired states clearly.
    - API guards for paid booking, same-month redemption, target slot capacity, cutoff time, no attendance, and no started session.
    - Head Coach/Coach assignment cleanup when a learner is removed from an assigned group; notifications must avoid creating reassignment work when the remaining learners are still assigned.
    - Admin visibility/audit trail for wallet actions before deploy.
  - UAT cases:
    - Store before Head Coach assignment.
    - Store after Head Coach assignment but before 48-hour cutoff.
    - Block store within 48 hours.
    - Block store after Coach check-in or attendance exists.
    - Redeem in same month into an available slot without payment.
    - Block redeem into full/past/wrong-month slots.
    - Expire unused wallet credit at month end and confirm it does not become makeup.
  - Completed 2026-05-21:
    - Added DB migration/schema/type support for `lesson_wallet_credits` and `booking_sessions.status = walleted` so original booking/payment history stays auditable.
    - Added `/api/lesson-wallet` with store/redeem/expire guards: verified booking only, no makeup, no attendance, 48-hour store cutoff, same-month redeem, future target slot, template validation, capacity check, duplicate learner prevention, slot count updates, assignment cleanup, notifications, and activity logs.
    - Added User schedule action “เก็บเข้ากระเป๋า” only on eligible sessions and a new `/dashboard/lesson-wallet` page for active/redeemed/expired credits and same-month redemption without payment.
    - Kept walleted sessions out of coach access/assignment duplicate logic and slot attendance scope, while showing wallet status clearly in User schedule/history and Admin schedule views.
    - Applied remote Supabase migration `20260521170000_add_lesson_wallet_credits.sql` with `supabase db push`.
    - Added `npm run uat:lesson-wallet`, a guarded disposable Supabase UAT that creates only `uat.nasc+lesson.wallet.*@example.com` accounts and `NASC_UAT_LESSON_WALLET` schedule data.
    - UAT verifies migration table usability, storing a verified paid session into the wallet, 48-hour/no-attendance guards, coach assignment cleanup, slot count decrement, same-month redemption into a future slot, original booking/payment reuse without new charge, wrong-month detection, expired credit handling, and cleanup.
    - UAT auto-cleanup passed after the run: 3 profiles, 6 slots, 5 sessions, and 2 wallet credits removed.
    - Checks passed: `npm run uat:lesson-wallet`, `npm run check:mojibake`, `npm run lint`, `npm run build`, and `git diff --check`.

- [ ] 21. Phase 3 Deploy Readiness
  - Review dependency vulnerabilities and update only when safe.
  - Prepare production environment variables.
  - Deploy staging.
  - Smoke test staging across Super Admin, Admin, Head Coach, Coach, and User roles.
  - Completed 2026-05-21:
    - Ran Production readiness re-check against the real Supabase remote.
    - Confirmed seed/demo users are gone: 0 seed profiles and 0 seed auth users.
    - Confirmed required master data exists: 7 active branches, 3 course types, 702 active schedule templates, 70 active levels, and 11 pricing tiers.
    - Confirmed required Storage buckets exist: `avatars`, `coach-checkins`, and `payment-slips`.
    - Added `npm run prod:save-default-settings` to save missing production-safe defaults without hand-editing JSON in the app.
    - Saved `coach_teaching_rules_settings` into `system_settings`; `prod:check` now finds all 3 required settings.
    - Remaining warning before production deploy: `.env.local` still has `SLIPOK_TEST_MODE=true` for current testing. Production must remove it or set it to false and use real SlipOK credentials.
    - Checks passed: `npm run prod:save-default-settings`, `npm run prod:check`, `npm run check:mojibake`, `npm run lint`, `npm run build`, and `git diff --check`.
  - Re-check 2026-05-21 after pricing/wallet fixes:
    - Re-ran `npm run prod:check` against the real Supabase remote after wallet UAT cleanup; result remains READY WITH WARNINGS/PASSES.
    - Confirmed no seed/demo users remain: 0 seed profiles and 0 seed auth users.
    - Confirmed master data still exists: 7 active branches, 3 course types, 702 active schedule templates, 70 active levels, 11 pricing tiers, 3 required system settings, and Storage buckets `avatars`, `coach-checkins`, `payment-slips`.
    - Verified lesson wallet UAT again: store guard, assignment cleanup, slot count decrement, same-month redeem, no extra payment path, expired/wrong-month guards, and auto-cleanup all passed.
    - Verified kids group incremental pricing code path now charges only the newly added sessions at the tier for the final monthly count, e.g. existing 2 + new 1 uses the 3-session tier for 1 new session instead of recalculating the whole month.
    - Remaining warning before production deploy is still intentional for testing: `SLIPOK_TEST_MODE=true`. Production must set it to false/remove it and use real SlipOK credentials.
    - Checks passed: `npm run lint`, `npm run check:mojibake`, `npm run prod:check`, `npm run uat:lesson-wallet`, `npm run build`, and `git diff --check`.
  - SlipOK real-mode check 2026-05-21:
    - Compared local implementation with `SlipOK API Guide.docx`; updated SlipOK verification to send `log=true` and `amount` with file uploads so SlipOK can validate receiver/deduplicate/check amount according to the guide.
    - Added live SlipOK quota validation to `npm run prod:check` when `SLIPOK_TEST_MODE=false` and real credentials are present.
    - Current real SlipOK blocker: quota endpoint returns code `1003` / `Package ของคุณหมดอายุแล้ว`, so real slip auto-approval cannot work until the SlipOK package/branch is renewed or corrected.
    - Checks passed after code changes: `npm run lint`, `npm run check:mojibake`, `npx tsc --noEmit`, and `git diff --check`.
    - `npm run build` did not complete in this local run because Google Fonts DNS lookup failed for `fonts.googleapis.com`; this is a network/font fetch issue, not a TypeScript error from the SlipOK changes.

- [x] 21.1 Booking Duplicate Guard + Payment Review Actions
  - Production blocker found during real SlipOK testing: the same learner can still create and pay for a duplicate booking on the same date/time/branch.
  - Safe booking rule:
    - One learner must not have duplicate active sessions for the same `date + start_time + end_time` even if the branch/course differs, because the learner cannot attend overlapping rounds.
    - Active booking statuses for duplicate checks: `pending_payment`, `paid`, `verified`.
    - Active session statuses for duplicate checks: `scheduled`, `completed`, `absent`.
    - Ignore sessions/bookings that are `rescheduled`, `walleted`, or `cancelled`.
    - Server API must enforce this even if the UI is bypassed.
  - Booking fixes:
    - Disable already-booked learner slots in the User booking calendar and label them clearly as `จองแล้ว`.
    - Add duplicate guard to `POST /api/bookings` before inserting booking/session rows.
    - Add the same guard to `PUT /api/bookings`, excluding the booking being edited.
    - Return a clear error such as `น้อง A มีรอบเรียน 28 พ.ค. 17:00-19:00 ที่แจ้งวัฒนะอยู่แล้ว`.
  - Payment review fixes:
    - Keep auto-approval when SlipOK passes and local validation passes.
    - For SlipOK failures, Admin/Super Admin must have explicit actions:
      - `อนุมัติด้วยตนเอง`: mark payment `approved`, booking `verified`, and notify the user.
      - `ตีกลับให้แนบสลิปใหม่`: mark payment `rejected`, move booking back to `pending_payment`, store the admin reason, and notify the user to upload a new slip.
      - `ปฏิเสธและยกเลิกการจอง`: mark payment `rejected`, booking `cancelled`, and prevent the sessions from continuing into Coach assignment/attendance flow.
    - User history must show the admin reason and a clear re-upload path when a slip is sent back.
  - UAT required:
    - Duplicate same learner/date/time/branch is blocked in both UI and API.
    - SlipOK `1014` or other failure can be sent back with a reason; User can upload a new slip.
    - Manual approval verifies the booking and payment without requiring SlipOK to pass.
    - Cancelled payment booking no longer appears in active scheduling/coach flows.
  - Completed 2026-05-21:
    - User booking calendar now disables already-booked same-learner same-time slots and labels them `จองแล้ว`.
    - `POST /api/bookings` and `PUT /api/bookings` now reject duplicate active sessions server-side; `PUT` excludes the booking currently being edited.
    - Admin payment review now supports three explicit actions from the payment detail dialog: manual approve, send back for re-upload, and reject/cancel booking.
    - Admin review actions store notes, notify the User, log Activity Log entries, and update booking/payment status consistently.
    - User history now surfaces the latest rejected payment note and keeps the re-upload path visible while the booking is back in `pending_payment`.
    - Checks passed: `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `git diff --check`, `npm run build`, and `npm run prod:check`.
    - Note: local non-escalated `prod:check`/`build` can fail on network access to Supabase/Google Fonts inside sandbox; escalated checks passed. Production warning remains only `SLIPOK_TEST_MODE=true` until real mode is intentionally enabled.

- [x] 21.2 Coach Assignment Visibility / Past Slot Lock
  - Critical issue found 2026-05-22: Head Coach can confirm a coach assignment, Admin sees the assigned coach, but User schedule can still show `ยังไม่ได้มอบหมายโค้ช`.
  - Fix the read model so User schedule/history uses the same confirmed `coach_assignment_groups` / student-to-coach assignment source as Admin and Coach pages.
  - User-facing schedule must show the assigned coach name once Head Coach has saved/confirmed the group for that learner/session.
  - Filter default fixes for high-risk operational pages:
    - Admin Makeup page should open with `ทุกสาขา` + `ทั้งหมด` instead of hiding records behind `ยังชดเชยได้`.
    - Head Coach group assignment page should open with `ทั้งหมด` instead of `ต้องมอบหมาย`.
    - Default filters should prioritize visibility first; users can narrow down after they see the full workload.
  - Past-slot rule:
    - Head Coach/Admin must not be able to newly assign or reassign learners/coaches after the class date/time has already passed.
    - Past confirmed assignments should remain view-only for audit, attendance, teaching hours, and User history.
    - If a past class has no assignment/attendance, it must go through the attendance gap resolution flow instead of normal assignment.
  - API/server guards must enforce the same rule even if the UI is bypassed.
  - UAT required:
    - Future assigned slot: Head Coach confirms -> Admin sees coach -> User sees the same coach.
    - Past slot with existing assignment: visible read-only everywhere.
    - Past slot without assignment: normal assign controls are blocked and the record routes to attendance gap review.
    - Coach schedule, attendance, makeup, teaching hours, and User schedule remain consistent after the change.
  - Completed 2026-05-22:
    - User schedule now reads confirmed `coach_assignment_groups` with service access and falls back to legacy `coach_assignments` only when no assignment group exists for that slot.
    - User schedule, attendance status, and coach visibility now share the same assignment source used by Admin/Coach pages.
    - Head Coach assignment page now opens with all statuses visible by default and locks started/past slots as read-only.
    - `POST /api/coach/assignment-groups` now rejects started/past slots server-side, so UI bypass cannot create backdated assignments.
    - Admin Makeup page now opens with `ทุกสาขา` + `ทั้งหมด` to avoid hiding review records behind an action-only filter.
    - Checks passed: `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `git diff --check`, `npm run build`.

- [x] 21.3 Production Env / SlipOK Real Mode Final Check
  - Confirm production `.env` values before staging/deploy:
    - `NEXT_PUBLIC_SUPABASE_URL`
    - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
    - `SUPABASE_SERVICE_ROLE_KEY`
    - `SLIPOK_TEST_MODE=false`
    - `SLIPOK_API_URL`
    - `SLIPOK_API_KEY`
  - Confirm the SlipOK branch/account shown to users matches the account SlipOK validates.
  - Run `npm run prod:check` in real mode and confirm the only remaining warnings are intentional.
  - Verify `payment-slips`, `avatars`, and `coach-checkins` buckets/policies still work before staging.
  - Do not commit real secrets into the repository.
  - Mobile check-in hardening 2026-05-22:
    - Coach check-in now detects insecure mobile contexts and explains that camera/GPS require HTTPS instead of showing a generic permission error.
    - Camera capture now waits for real video metadata/frame readiness before enabling selfie capture, reducing black-preview/blank-capture issues on mobile browsers.
    - GPS errors now distinguish denied permission, unavailable position, and timeout so Coach/Admin know what to fix during field use.
    - Real SlipOK credentials validated through `npm run prod:check`; quota is readable, remaining quota is 98, and package end date is 2026-05-26.
    - Checks passed: `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `git diff --check`, `npm run build`, `npm run prod:check`.
  - Final real-mode re-check 2026-05-23:
    - Confirmed required local env keys are present without printing secrets: Supabase URL/publishable key/service role key, `SLIPOK_TEST_MODE=false`, `SLIPOK_API_URL`, and `SLIPOK_API_KEY`.
    - `npm run prod:check` can read real SlipOK quota and reports: seed profiles `0`, seed auth users `0`, required Storage buckets present, active branches `7`, course types `3`, active schedule templates `702`, active levels `70`, pricing tiers `11`, system settings `3`, SlipOK quota remaining `98`, and package end date `2026-05-26`.
    - No production secrets were committed; real `.env.local` remains local only.
    - Checks passed: `npm run prod:check`, `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `npm run build`, and `git diff --check`.

- [x] 21.3.1 User Lesson Wallet Display + Re-Wallet Flow
  - Refine `/dashboard/schedule` wallet visibility so the calendar is not overloaded with duplicate wallet statuses.
  - Display rules:
    - `walleted` + active credit: show as purple "อยู่ในกระเป๋า" because the lesson entitlement is still unused.
    - `walleted` + redeemed credit: hide from the main calendar/session list because the target session already shows "ใช้สิทธิ์จากกระเป๋าวันที่ ...".
    - `walleted` + expired credit: prefer showing in `/dashboard/lesson-wallet` rather than cluttering the schedule calendar, unless a clear expired audit indicator is needed.
  - Re-wallet rule:
    - A session created from wallet redemption may be stored back into the wallet again if it is still in the same month, at least 48 hours before start, has no attendance, and is not a makeup session.
    - Re-walleting must not create a new payment; it must keep using the original paid booking entitlement.
    - If the redeemed session was already assigned to a Coach group, remove only that learner from the assignment group. Only notify Head Coach/Coach when active learners remain without any group assignment.
  - Backend/API safety:
    - Confirm `/api/lesson-wallet` handles repeated wallet -> redeem -> wallet -> redeem chains without duplicate active credits, duplicate learner slots, or extra payment rows.
    - Keep same-month, future-slot, capacity, and duplicate learner guards.
  - UAT required:
    - Store original session A into wallet.
    - Redeem into session B.
    - Store session B into wallet again.
    - Redeem into session C in the same month.
    - Verify only the active/relevant schedule entries are visible, payment count does not increase, and Coach assignment cleanup happens per learner only.
  - Completed 2026-05-23:
    - `/dashboard/schedule` now shows walleted sessions only when the wallet credit is still active; redeemed/expired wallet source sessions are hidden from the main calendar/list to avoid duplicate status noise.
    - Target sessions redeemed from wallet continue to show the source context, such as "ใช้สิทธิ์จากกระเป๋าวันที่ ...".
    - `/dashboard/lesson-wallet` now disables already-booked target slots for the same learner/date/time/branch/course and labels them "จองแล้ว".
    - `/api/lesson-wallet` now blocks duplicate wallet redemption by learner/date/time/branch/course, not just by selected `schedule_slot_id`.
    - Extended `npm run uat:lesson-wallet` to cover wallet -> redeem -> wallet -> redeem chains.
    - UAT now verifies re-walleting a redeemed/assigned session decrements the old target slot, removes only that learner from Coach assignment groups, creates the new target session, keeps the original booking/payment count unchanged, and blocks duplicate target slots before wallet redemption.
    - Checks passed: `node --check scripts/uat-lesson-wallet.js`, `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `npm run uat:lesson-wallet`, `npm run build`, and `git diff --check`.
  - Production hotfix 2026-05-23:
    - `/api/lesson-wallet` now verifies that the `lesson_wallet_credits` row was actually updated from `active` to `redeemed`; if another request already used the same credit, it rolls back the newly-created session and slot count, then returns a conflict instead of silently creating an extra class.
    - `/dashboard/lesson-wallet` blocks repeated redeem clicks while the request is running.
    - Admin dashboard and Admin schedule now apply the same visibility rule as User schedule: wallet source sessions are shown only while the wallet credit is still active; redeemed/expired wallet sources are hidden from operational calendars.

- [x] 21.3.2 Coach Assignment Stability After Wallet Store
  - Owner requirement: when a User stores a lesson into the wallet after Head Coach has already assigned groups/coaches, the system must remove only that learner and must not create unnecessary reassignment work.
  - Safe rules:
    - If the affected slot/group still has active learners after the wallet action, keep the existing Coach/group assignment as confirmed and do not force Head Coach to assign again.
    - If the removed learner was the last learner in a group, keep the old group auditable but exclude the empty group from Coach schedule, check-in, attendance, teaching programs, and teaching-hour/payroll evidence.
    - If the whole slot has no active learners left after wallet store, Coach should no longer see the slot as work to teach/check in for; it should behave like a slot with no booking.
    - Only show Head Coach "needs assignment" when active learner sessions remain in the slot but are not assigned to any group.
  - Required implementation:
    - Adjust `/api/lesson-wallet` store flow to compute post-wallet slot state after removing the learner from `coach_assignment_group_students`.
    - Send Head Coach/Coach notifications only when a real review is needed; avoid noisy "review group" alerts when the remaining learners are still fully assigned.
    - Ensure Coach schedule, check-in, attendance, teaching programs, and teaching-hour calculations ignore empty assignment groups and slots with no active learners.
    - Extend lesson-wallet UAT to cover: 3 learners -> wallet 1, 1 learner -> wallet 1, one group emptied while other groups remain, and active unassigned learner remains.
  - Completed:
    - `/api/lesson-wallet` now computes post-wallet assignment state after removing the learner from group students.
    - Coach/Head Coach notifications are sent only when active learners remain without assignment; normal remaining assigned groups do not create reassignment noise.
    - Coach schedule, check-in authorization, teaching programs, and teaching-hour/payroll sources ignore empty groups after wallet actions.
    - Lesson wallet UAT covers multi-learner group removal, emptied group audit retention, split groups, re-wallet chains, duplicate target guards, and payment reuse.
    - Checks passed: `node --check scripts/uat-lesson-wallet.js`, `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `npm run uat:lesson-wallet`, `npm run build`, and `git diff --check`.

- [x] 21.4 Dependency Vulnerability Review
  - Run dependency audit and review only actionable `critical`/`high` issues first.
  - Avoid broad dependency upgrades that could destabilize Next.js, Supabase, Drizzle, or UI behavior.
  - If fixes require package updates, run `npm run lint`, `npx tsc --noEmit`, `npm run check:mojibake`, and `npm run build`.
  - Document any intentionally deferred vulnerability with reason and risk.
  - Completed 2026-05-22:
    - Ran `npm audit --audit-level=moderate`; initial result was 11 vulnerabilities from transitive packages plus Next.js.
    - `npm audit fix` without `--force` did not produce a lockfile-safe fix, so broad forced upgrades were avoided.
    - Added safe npm overrides for transitive dependencies only: `ajv`, `brace-expansion`, `flatted`, `glob`, `minimatch`, `picomatch`, `ws`, and Next's nested `postcss`.
    - Updated direct `postcss` dev dependency to a patched 8.5.x range.
    - Reduced audit result to 1 remaining high-severity Next.js advisory group.
    - Deferred `npm audit fix --force` because it would install `next@16.2.6` and `eslint-config-next@16.2.6`, a breaking framework upgrade that must be handled as a separate upgrade window.
    - Checks passed: `npm run lint`, `npx tsc --noEmit`, `npm run check:mojibake`, `npm run build`, `npm run prod:check`, and `git diff --check`.

- [x] 21.4.1 Next.js Major Security Upgrade Spike
  - Review the remaining `npm audit` high-severity Next.js advisory group separately from routine dependency patching.
  - Test upgrade path from Next 14.2.35 to the current secure Next major on a separate branch before production deploy.
  - Re-run role smoke tests after upgrade because routing, middleware, image handling, and App Router behavior can be affected.
  - Completed 2026-05-23 on branch `spike/next-major-security-upgrade`:
    - Upgraded `next` and `eslint-config-next` to `16.2.6`, upgraded ESLint to `9.39.1`, and confirmed `npm audit --audit-level=moderate` reports 0 vulnerabilities.
    - Migrated Supabase server client usage for async `cookies()` and updated App Router pages that receive `searchParams` to the Next 16 Promise-based shape.
    - Replaced deprecated `.eslintrc.json` with ESLint 9 flat config and scoped lint to `src` to match the prior app lint surface.
    - Locked local dev/build to webpack with `next dev --webpack` and `next build --webpack` because the project still has webpack configuration and Next 16 defaults to Turbopack.
    - Renamed request `middleware` convention to `proxy` and converted Tailwind config plugin loading to ESM import so Next 16 dev server opens cleanly.
    - Smoke checked public/protected routes on `http://127.0.0.1:3002`: public pages returned 200 and protected Admin/Coach/User pages returned expected auth redirects.
    - Checks passed: `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `npm run build`, `npm audit --audit-level=moderate`, `npm run prod:check`, and `git diff --check`.
    - Not merged into `main` yet; keep this as a reviewed spike branch before deciding whether to promote the framework upgrade.

- [x] 21.5 Staging Deploy Preparation
  - Prepare staging environment variables in the target host.
  - Confirm build command, install command, Node version, and output settings.
  - Run local checks before deployment: `npm run prod:check`, `npm run lint`, `npx tsc --noEmit`, `npm run check:mojibake`, and `npm run build`.
  - Confirm Supabase migrations are already applied and no seed/demo data is required for production.
  - Prepare a rollback point before first staging deploy.
  - Completed 2026-05-23 on branch `spike/next-major-security-upgrade`:
    - Added Node engine requirement `>=20.9.0` and documented staging settings: install `npm ci`, build `npm run build`, start `npm run start` for Node hosts.
    - Added `vercel.json` so Vercel uses `npm ci` and `npm run build`, preserving the Next 16 webpack build flag configured in `package.json`.
    - Updated `.env.example` and production docs to prefer `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, keep `NEXT_PUBLIC_SUPABASE_ANON_KEY` only as fallback, and use `SLIPOK_TEST_MODE=false` for staging/production.
    - Fixed Supabase browser/server/proxy clients to read `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` first with `NEXT_PUBLIC_SUPABASE_ANON_KEY` fallback, preventing auth/client breakage if the host only configures the newer Supabase publishable key.
    - Confirmed production readiness against remote Supabase: 0 seed profiles, 0 seed auth users, required master data present, required buckets present, and SlipOK quota readable.
    - Rollback plan documented in `PRODUCTION_READINESS.md`: keep last stable `main`, keep this branch separate until smoke passes, and redeploy stable `main` if staging reveals a framework/runtime blocker.
    - Checks passed: `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `npm run build`, `npm audit --audit-level=moderate`, `npm run prod:check`, and `git diff --check`.

- [ ] 21.6 Staging Smoke Test Across Roles
  - Super Admin: settings, payment settings, ranking, teaching program review, payroll/teaching hours, finance.
  - Admin: allowed menu visibility, payment review actions, complaints, notifications, attendance gap handling.
  - Head Coach: schedule, coach suggestion, group assignment, duplicate coach prevention, student grouping by level.
  - Coach: schedule calendar, check-in selfie/location window, attendance, level evaluation, teaching program, teaching hours.
  - User: booking, duplicate booking guard, pricing tier calculation, coupon, SlipOK upload, history, schedule, reschedule, lesson wallet, notifications.
  - Confirm mobile responsive basics for Admin, Coach, and User critical pages.
  - Record any staging-only issue as a new TODO item instead of silently patching unrelated flows.

- [x] 21.6.1 Production Blocker: Attendance Gap Without Assigned Coach
  - Real production case found 2026-05-23: Head Coach can forget to assign a coach/group, the class time can pass, and the Admin makeup/attendance-gap flow becomes stuck because there is no assigned coach to send back to and the existing absence confirmation is too strict for this no-assignment state.
  - Safe resolution rules:
    - If the class really happened but the coach assignment was forgotten, Admin/Super Admin must be able to record a retroactive audited assignment, choose the actual coach, and save attendance for each learner.
    - If no class happened because the school forgot to assign a coach, Admin/Super Admin must close the case as a school/system issue and return the lesson entitlement to the learner, preferably through makeup/wallet credit, without marking the learner absent.
    - If the learner truly did not attend even though no assignment exists, Admin/Super Admin may confirm absence only with a required reason/audit note.
    - Head Coach must not be allowed to perform normal backdated assignment after the class has passed; past no-assignment classes should be handled through the Admin attendance-gap audit flow only.
  - Keep downstream flows aligned: User schedule/makeup/wallet, Coach teaching hours, attendance evidence, and Admin audit log must reflect the selected resolution.
  - Treat as a production blocker before broad owner review because it can leave paid lessons stuck between makeup, attendance, and coach assignment flows.
  - Completed:
    - Admin/Super Admin attendance-gap review now supports three audited outcomes for past sessions without assigned coach:
      - record real attendance by selecting the actual coach; the system creates a retroactive assignment group and writes attendance to that coach,
      - confirm learner absence with a required reason/audit note,
      - return the lesson entitlement into the learner lesson wallet when the school/system caused the missed class.
    - "Send back to coach" is blocked when no coach exists for that round, so the flow no longer sends a task into nowhere.
    - Head Coach normal backdated assignment remains locked after class time; past no-assignment cases are handled through Admin audit flow.
    - User is notified when Admin returns entitlement to the lesson wallet.

- [x] 21.6.2 Production QA Fixes: Admin Schedule Status + SlipOK Mode Visibility
  - Admin schedule status mismatch found 2026-05-23: Admin schedule can still show a past attended round as `รอเรียน` while User schedule correctly shows `มาเรียนแล้ว`.
  - Fix the Admin schedule read model/status mapper to use the same attendance/session truth source as User schedule, and cross-check Coach pages for the same status consistency:
    - `present` / checked attendance should render as `มาเรียนแล้ว`.
    - Past sessions with no attendance should route into the attendance-gap/makeup review states, not remain `รอเรียน`.
    - Wallet/reschedule/makeup states must remain consistent with User schedule and Admin makeup pages.
  - Admin payment review should visibly show current SlipOK mode:
    - Display `SlipOK ใช้งานจริง` when production verification is active.
    - Display `SlipOK TEST MODE` with a clear warning when test mode is active.
  - Do not add a web UI toggle for SlipOK mode. Mode changes must stay in Vercel environment variables and require redeploy, so production payment behavior cannot be changed accidentally from the app.
  - Keep SlipOK API URL/key in environment variables only; never expose secrets in UI.
  - Completed:
    - Admin schedule now derives status from the same session/attendance truth used by User schedule, including completed attendance, in-progress, attendance-gap review, wallet, reschedule, and makeup states.
    - Admin schedule displays coach names from saved coach assignment groups first, with legacy slot assignment as fallback.
    - Coach schedule detail now displays learner status from attendance rows first, so checked students show `มาเรียนแล้ว` / `มาสาย` / `ขาดเรียน` instead of staying `รอสอน`.
    - Coach schedule detail shows a completed attendance badge when all learners in that assigned slot are checked, reducing duplicate check-name actions.
    - Coach attendance/schedule wording now says `บันทึกผลครบแล้ว` for completed attendance so an absent result is not misread as the student attended.
    - Coach monthly calendar and teaching-hour source now ignore assignment groups whose sessions were moved to wallet/rescheduled/cancelled, preventing ghost orange dots and non-payable hours after wallet actions.
    - Admin payment review now displays server-side SlipOK mode clearly as live production verification or TEST MODE without exposing API keys and without adding a risky UI toggle.
    - Verification target: `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `npm run build`, `npm run prod:check`, and `git diff --check`.

- [x] 21.6.3 Verified Booking Gate for Teaching/Assignment Surfaces
  - Production blocker found 2026-06-01: Admin overview, Admin schedules, and Head Coach assignment can treat `pending_payment` / `paid` bookings as teaching-ready rows, while payment review still shows those bookings are not fully verified.
  - Business rule: only `bookings.status = verified` is a real teaching session that can show as scheduled/learning, be assigned to Coach, appear on Coach schedule/check-in/attendance, and count toward teaching hours.
  - Keep `/admin/payments` broad enough to show pending/paid/verified payment review states; do not hide payment problems from Admin.
  - Fix Admin overview and Admin schedules operational calendars to load verified bookings only.
  - Fix Head Coach assignment to load verified bookings only and add server-side assignment API validation so non-verified booking sessions cannot be saved into assignment groups.
  - Fix Coach schedule/student-memory access helpers to ignore pending/paid bookings on teaching surfaces.
  - After code changes, run `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `npm run build`, `npm run prod:check`, and `git diff --check`.
  - Completed:
    - Admin overview and Admin schedules now load only `bookings.status = verified` into operational teaching calendars and "today/scheduled" counts.
    - Head Coach assignment now loads only verified booking sessions, so unpaid or slip-pending learners cannot be grouped from the UI.
    - `/api/coach/assignment-groups` now validates submitted booking sessions server-side and rejects any session whose booking is not `verified`.
    - Coach schedule, Coach student access, Coach-student memory, and teaching-hour/payable source helpers now ignore pending/paid bookings on teaching surfaces.
    - Payment audit remains broad and still shows pending/paid/verified states for Admin review.
    - Read-only production audit found 20 existing assignment-group student rows tied to non-verified booking sessions and 122 pending/paid sessions that the old calendar query could show; this code now hides/blocks them from teaching surfaces, but no production cleanup was performed.
    - Verification passed: `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `npm run build`, `npm run prod:check`, and `git diff --check`.

- [x] 21.6.4 Payment Pending Visibility for User/Admin
  - Production follow-up found 2026-06-01: after gating teaching surfaces to verified bookings only, `pending_payment` / `paid` bookings can correctly disappear from teaching calendars, but User/Admin still need a clear place to see and resolve those incomplete bookings.
  - Business rule:
    - `bookings.status = verified` is the only status that enters teaching, assignment, coach schedule, attendance, and teaching-hour flows.
    - `pending_payment` means the user has not completed slip upload yet and must see an obvious path to continue payment.
    - `paid` means a slip/payment exists but the booking is not verified yet, so Admin must be able to track it and User must understand the booking is not complete.
  - Add User-facing visibility on schedule/history/dashboard so incomplete bookings do not look lost after being removed from teaching calendars.
  - Add Admin payment visibility for booking-level incomplete items, including bookings that do not have a payment row yet.
  - Do not change verified booking behavior.
  - After code changes, run `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `npm run build`, `npm run prod:check`, and `git diff --check`.
  - Completed:
    - User schedule now shows a clear incomplete-payment banner when the user has `pending_payment` or `paid` bookings that are intentionally excluded from the teaching calendar.
    - The banner explains that those bookings do not enter teaching/assignment flow until verified, summarizes waiting-slip/waiting-review counts, and links to booking history for slip upload/review.
    - Admin payment review now includes a booking-level "รายการจองที่ยังไม่สมบูรณ์" section for `pending_payment` / `paid` bookings, including bookings with no payment row yet.
    - Admin can search, paginate, see learner/branch/course/month/session/amount, and copy booking/payment ids for follow-up without changing verified payment review behavior.
    - Follow-up closeout 2026-07-04: `/admin/payments` multi-child learner display now falls back from `bookings.child_id -> children` to unique learner names from `booking_sessions.child_id` when `bookings.child_id` is null by design. Source commit `abe01e11324bbb1d5bc29034fe516f0bfa655220` deployed as `dpl_CdVyyJMkYWcSJJBZrWY6aajcZ1Mf`; production smoke confirmed `ปันนา, ปีนัง`, `เอมี่, เอลซ่า`, and `ภูเมธ, ซานต้า, ซันเดย์, ตุลย์` display correctly, single-child `Tigger` still displays, search/detail modal use the derived learner name, and console errors/warnings were 0.
    - This learner-name fallback is display/read-model only. It did not change payment approval/reject/send-back/cancel logic, payment status/amount logic, pricing, SlipOK behavior, DB/migrations, booking/session/payment/coupon data, or write behavior; no payment write action was clicked.
    - Verified booking behavior remains unchanged: verified bookings are still the only rows that enter teaching, assignment, coach schedule, attendance, and teaching-hour flows.
    - Verification passed: `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `npm run build`, and `git diff --check`.
    - `npm run prod:check` passed readiness checks with one environment warning: local `SLIPOK_TEST_MODE=true`; production must keep SlipOK live credentials configured in Vercel before deploy.
    - Follow-up closeout 2026-07-04: User Payment / Slip Upload reliability hardening deployed as source commit `bc5e013b4b0d90b517f908d9aaf34e7caad5f43b` (`fix(payment): harden slip upload reliability`), deployment `dpl_B2895m9DiJwxm3xWEhu64BUYDhAj`, production alias `https://www.newathleteschool.com`.
    - Reliability risk addressed: the slip upload flow could feel stuck or unclear when SlipOK was slow/timeout-prone or when a partial failure occurred after upload/payment insert.
    - Fix details: SlipOK request now has a 25s `AbortController` timeout with typed `SLIPOK_TIMEOUT`; `/api/verify-slip` returns clearer safe messages/codes for storage upload failure, SlipOK timeout/rejection/invalid slip, payment insert failure, and booking update failure after payment insert; `/dashboard/history` shows upload/verify/refresh/failed states and disables duplicate submit/file changes while pending.
    - Business semantics preserved: SlipOK approved still creates payment `approved` and booking `verified`; timeout/rejected/manual-review still records payment `pending` and booking `paid`; payment approval/reject/send-back/cancel semantics, pricing, DB migrations, and direct DB repair were not changed/performed.
    - Production read-only smoke passed: production alias, `/dashboard/history`, and `/admin/payments` loaded; pending payment/upload UI rendered without submitting a slip; console errors/warnings were 0; no React hydration error or React #418 was found.
    - Post-deploy read-only inconsistency audit passed: payments scanned 392, paid/verified bookings 392, and 0 rows for payment-exists-but-booking-pending, approved-payment-but-booking-not-verified, paid/verified-booking-without-payment, and duplicate-payment-per-booking checks.
    - Browser slip-upload write smoke remains `NEED REVIEW` because no clearly disposable/test pending booking existed. No production slip upload was performed, no booking/payment/slip/coupon was created, and no payment/write action was clicked.
    - Follow-up closeout 2026-07-08: `/dashboard/booking` draft preservation deployed as source commit `85aa80a90bd645b63e7bab1fbca408fa66cf2c73` (`fix(booking): preserve draft state`), deployment `dpl_AZhW1vNkdGm4oZiMZvVb4hx152qr`, production alias `https://www.newathleteschool.com`.
    - Reliability issue addressed: booking wizard state lived only in React `useState`, so refresh/remount/auth refresh/returning to the page could lose selected course, learner, branch, and session draft state.
    - Fix details: `/dashboard/booking` now preserves a validated client-only `sessionStorage` draft scoped by `nabs:booking-draft:v1:{userId}:new` or `nabs:booking-draft:v1:{userId}:edit:{bookingId}`. It persists selection state (`step`, course/learner/child/private attend/branch/month/year/session map/active tab/update time) but does not persist price source of truth, coupons, payment state, API errors, or loading state.
    - Draft restore validates course type, child ids, branch ids, active learner key, and session shape; corrupt/invalid drafts are removed. UI shows `กู้คืนแบบร่างการจองล่าสุดแล้ว` and `ล้างแบบร่าง`; draft clears after successful `POST`/`PUT`, discard, and mode/edit key change, but not on API failure, refresh, slow network, or summary back.
    - Production smoke passed: Private -> `A'Arm Chanin` -> `แจ้งวัฒนะ` -> `จันทร์ 6 ก.ค. 69` -> `08:00-09:00` restored after refresh with recalculated price `฿900`; summary/back preserved it; `ล้างแบบร่าง` cleared it; console errors/warnings/pageerrors were 0; no React hydration error or React #418 was observed.
    - Safety preserved: no API, DB, migration, pricing, `/api/bookings` payload shape, duplicate guard, schedule template, same-day future-slot, payment/slip, lesson-wallet, reschedule, or coupon semantic changes. `ยืนยันการจอง` was not clicked, and no booking/payment/slip/coupon was created.
    - `NEED REVIEW`: kids_group multi-child browser smoke was not tested because the safe smoke session had no child records; pending edit booking smoke was not tested because no pending editable booking was visible. Next recommended task is Booking Performance Audit for real speed improvement, or branch/month reset confirmation if users still feel selections disappear during in-page changes.

- [x] 21.6.5 Coach Check-in Image Visibility
  - Production issue found 2026-06-01: Coach check-in rows can show check-in time and GPS, but the selfie image breaks because `coach-checkins` is a private Supabase Storage bucket while old rows store public object URLs.
  - Business rule: keep coach selfie evidence private; do not make `coach-checkins` public and do not change check-in, attendance, or payroll logic.
  - Fix:
    - Added a dedicated server helper that converts old public URLs or object paths into short-lived signed URLs for the private `coach-checkins` bucket.
    - Admin `/admin/coach-checkins` now resolves selfie evidence through signed URLs before passing rows to the client.
    - Coach check-in history uses the same signed URL path through the assigned schedule helper.
    - Added a readable Admin fallback if a signed evidence image still cannot load.
  - Verification passed: `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `npm run build`, `npm run prod:check`, and `git diff --check`.
  - `npm run prod:check` still reports the existing local environment warning: `SLIPOK_TEST_MODE=true`; production Vercel env must remain configured for live SlipOK.

- [x] 21.6.6 Makeup Attendance Review Data Source Fix
  - Production issue found 2026-06-01: Admin schedule could show past verified sessions as `attendance_gap_review`, but Admin Makeup/วันชดเชย showed 0 rows because the page loaded only the newest 300 `booking_sessions`; future sessions filled that limit and hid older past review rows.
  - Business rule:
    - Only verified bookings can enter attendance-gap/makeup review.
    - Past sessions with no attendance must remain visible for Admin review even when the system has many future bookings.
    - Pending/paid/unverified bookings must stay out of teaching, assignment, attendance, and makeup-credit flows.
  - Completed:
    - Admin Makeup now queries verified past source sessions and linked makeup sessions separately, using Bangkok-local today instead of one newest-row limit.
    - Attendance scope for grouped/slot sessions now excludes non-verified, rescheduled, and walleted rows before deriving review/absence status.
    - Admin schedule and Admin overview now add a direct action from `attendance_gap_review` rows to `/admin/makeup`, so staff can see where to resolve the case.
  - Verification passed: `npx tsc --noEmit`, `npm run lint`, `npm run check:mojibake`, `npm run build`, `npm run prod:check`, and `git diff --check`.
  - `npm run prod:check` still reports the existing local environment warning: `SLIPOK_TEST_MODE=true`; production Vercel env must remain configured for live SlipOK.

- [x] 21.6.7 Makeup Attendance Review Grouped Per-Student Actions
  - Admin Makeup "attendance review" must group rows by teaching round, coach, branch, course, date, and time so high-volume cases are readable.
  - "Send to coach for review" is a round-level action with one button per round.
  - Retroactive attendance, confirm absence, close case, and return entitlement remain per-student actions only.
  - Coach Attendance must show Admin-returned work in a clear "retroactive review" section.
  - Coach must still check in retroactively with selfie + GPS before recording attendance if evidence is missing.
  - Coach attendance remains per-student only; no group-level attendance button.
  - Must not affect verified booking gate, lesson wallet, makeup eligibility, payroll/teaching hours, or existing attendance rows.
  - Implemented: Admin Makeup now renders attendance-gap review rows as grouped teaching rounds with one round-level "send to coach" action and per-student resolution actions.
  - Implemented: Coach Attendance now shows Admin-returned retroactive review rounds in a dedicated section; missing check-in evidence routes the coach to retroactive selfie/GPS check-in before per-student attendance.
  - Verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `git diff --check`, `npm run build`, and `npm run prod:check`.
  - `npm run prod:check` still reports the existing local environment warning: `SLIPOK_TEST_MODE=true`; production Vercel env must remain configured for live SlipOK.

- [x] 21.6.8 Admin Coach Check-in Audit UX Scalability Pass
  - Production UX issue found 2026-06-02: Admin `/admin/coach-checkins` has correct data but becomes visually noisy with many coaches and many assigned rounds.
  - Goal:
    - Keep coach check-in, attendance, payroll, and storage evidence logic unchanged.
    - Show a compact problem-first queue grouped by teaching round so Admin can review missing check-ins, missing selfie, late check-ins, and missing GPS before browsing all rows.
    - Keep coach summary and all-record audit table available, but reduce their visual weight with tighter height and pagination.
    - Preserve detail dialog for signed selfie/GPS review.
  - Implemented: added a problem-first review queue grouped by date/time/branch/course, with per-coach issue chips and a detail action that reuses the existing selfie/GPS dialog.
  - Implemented: default all-record audit pagination is now lighter at 15 rows/page, coach summary height is reduced, and GPS evidence checks use null-safe logic.
  - Verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `git diff --check`, `npm run build`, and `npm run prod:check`.
  - `npm run prod:check` still reports the existing local environment warning: `SLIPOK_TEST_MODE=true`; production Vercel env must remain configured for live SlipOK.

- [x] 21.6.9 Attendance State Single Source of Truth + Reconciliation
  - Production consistency issue found 2026-06-02: Coach attendance can show a learner checked/present while Admin schedule or Makeup review still shows `รอตรวจเช็คชื่อ`/pending because some surfaces trust `booking_sessions.status` while others read `attendance`.
  - Business rule:
    - `attendance` is the source of truth for present, late, and absent.
    - `booking_sessions.status` is a lifecycle/cache field and must not be used alone for attendance display, makeup eligibility, payroll/audit, or Admin/User/Coach schedule status.
    - Pages may still write `booking_sessions.status` as a cache/audit status after attendance is recorded, but display logic must derive from attendance first.
  - Goals:
    - Use `src/lib/session-attendance-status.ts` as the shared helper for Admin overview, Admin schedules, Admin makeup, Coach schedule/attendance, and User schedule.
    - Keep per-student attendance decisions per student; do not collapse multiple learners in one teaching round into one status.
    - Add `npm run attendance:reconcile:dry-run` to report attendance/status mismatches without modifying production data.
    - Do not run any production reconciliation write until owner confirms the dry-run report.
  - Implemented:
    - Added shared attendance-state helpers in `src/lib/session-attendance-status.ts`, including per-session and per-session+student latest-attendance maps.
    - Admin overview, Admin schedules, Admin makeup, User schedule, Coach schedule, and coach assigned schedule now derive display status from `attendance` first.
    - Added `npm run attendance:reconcile:dry-run` for report-only production mismatch checks. The script uses smaller batches and retry logic to avoid long URL/fetch failures.
    - Added `AGENTS.md` rule: attendance is the source of truth; `booking_sessions.status` is only lifecycle/cache.
  - Dry-run result on 2026-06-02:
    - Verified teaching sessions checked: 726.
    - Attendance rows checked: 11.
    - Status mismatches found: 11 (`attendance` exists but `booking_sessions.status` is stale).
    - Booking status without attendance rows found: 8.
    - No production data was modified.
  - Verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, `git diff --check`, and `npm run build`.
  - Next safe step if owner confirms: add a separate reconciliation write script/API to update stale `booking_sessions.status` from attendance, after reviewing the dry-run list.

- [x] 21.6.10 Admin Attendance RLS Visibility Guard
  - Production issue found 2026-06-02: Coach Attendance showed learners as checked/present, but Admin overview/schedule/makeup could still show `รอตรวจเช็คชื่อ` because server-rendered Admin pages queried `attendance` through the session client and could be affected by RLS/session visibility.
  - Business rule:
    - Admin pages remain protected by `requireAdminPageAccess`/Admin layout before rendering.
    - After Admin authorization, read-only attendance/evidence queries for Admin status rendering should use the service-role client so all Admin/User/Coach surfaces see the same attendance truth.
    - Do not change Coach attendance writes, payroll, lesson wallet, makeup rule, or production data.
  - Implemented:
    - Admin overview, Admin schedules, and Admin makeup now read `attendance` rows with `getServiceRoleClient()` while continuing to derive display status through `src/lib/session-attendance-status.ts`.
    - Added `AGENTS.md` guard so future Admin attendance reads do not accidentally fall back to session/RLS-dependent status logic.
  - Verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, `git diff --check`, and `npm run build`.
  - Production data check: the 2026-06-02 rows for `เปรม`, `พรีม`, and `พรีโม่` have `attendance.status = present`; the patched Admin display rule derives them as `completed/มาเรียนแล้ว` even though `booking_sessions.status` is still stale `scheduled`.

- [x] 21.6.11 Admin Attendance Status Shared Scope Fix
  - Production consistency issue found 2026-06-02: Admin overview, Admin schedules, and Admin makeup can still disagree if each page builds attendance scope separately.
  - Goal:
    - Admin overview, Admin schedules, and Admin makeup must use one shared helper for attendance status and scope decisions.
    - The shared helper must read the same group/slot scope so one attended learner or one checked round is interpreted consistently across Admin surfaces.
    - Keep `attendance` as source of truth and keep service-role read-only attendance queries after Admin route authorization.
    - Do not modify production data, do not run reconciliation writes, and do not deploy until owner confirms.
  - Required checks: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, `git diff --check`, and `npm run build`.
  - Implemented:
    - Added `src/lib/admin-attendance-state.ts` as the shared Admin scope/status helper.
    - Admin overview, Admin schedules, and Admin makeup now use the same group/slot attendance scope and derive display state through the same helper.
    - Added an `AGENTS.md` rule so future Admin attendance views do not recalculate scope independently.
  - Verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, `git diff --check`, and `npm run build`.
  - Production data was not modified. Production was not deployed.

- [x] 21.6.12 Attendance Status Exact Student Scope + Admin Review Link Fix
  - Production consistency issue found 2026-06-02: Coach can show attendance completed per learner while Admin overview/schedules still marks the same learner as attendance-gap review, and the Admin review button can open Makeup without showing the same item.
  - Root rule:
    - `attendance` remains the source of truth for present/late/absent.
    - Attendance display must match by `booking_session_id + expected_student_id`, not by session id alone.
    - Expected student id is `booking_sessions.child_id` for child learners, otherwise `bookings.user_id` for self/adult learners.
  - Goals:
    - Admin overview, Admin schedules, and Admin makeup must use the same exact per-student helper scope as Coach/User pages.
    - Admin attendance queries must include `student_id` so display status cannot be derived from an unrelated learner in the same teaching slot.
    - Admin review links should carry enough context (`review`, `date`, `session`) so staff land on the relevant Makeup review context.
    - Add a dry-run/report path to expose mismatches without writing production data.
  - Safety:
    - Do not modify production data.
    - Do not run reconciliation writes.
    - Do not deploy production until owner confirms.
  - Required checks: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, `git diff --check`, and `npm run build`.
  - Implemented:
    - Added an exact Admin attendance helper that resolves each learner by `booking_session_id + expected_student_id`.
    - Admin overview, Admin schedules, and Admin makeup now select `attendance.student_id` and use the same exact-scope display status.
    - Admin review links now include `review`, `date`, and `session` so the Makeup page can highlight the same review context.
    - Expanded the attendance dry-run report to show exact student-scope mismatches without writing production data.
    - Added an `AGENTS.md` rule so future attendance surfaces do not fall back to broad session-only status.
  - Verification passed: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, `git diff --check`, and `npm run build`.
  - Dry-run result 2026-06-02:
    - `Student-scope attendance mismatches: 0`.
    - `Status mismatches: 21` remain because some production `booking_sessions.status` rows are stale while attendance already exists; no production data was modified.

- [x] 21.6.13 Admin Schedule Single Source Display Fix
  - Production consistency issue found 2026-06-02: Admin overview duplicated the schedule/calendar display and could continue showing confusing attendance-review states even after Makeup/Coach source-of-truth fixes.
  - Goals:
    - Remove the duplicate schedule/calendar section from Admin overview so `/admin` is KPI-only.
    - Keep `/admin/schedules` as the single Admin schedule surface for calendar/status review.
    - Make `/admin/schedules` load attendance through the exact Admin attendance helper and fail visibly if attendance cannot be loaded, instead of silently defaulting past sessions to review.
    - Query large attendance scopes in chunks so production months with many booking sessions do not lose attendance data because of one oversized `.in()` request.
  - Safety:
    - Do not modify production data.
    - Do not change Coach/User attendance writes, makeup rules, payroll, booking verified gate, or lesson wallet behavior.
    - Do not deploy production until owner confirms.
  - Required checks: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, `git diff --check`, and `npm run build`.
  - Completed 2026-06-02:
    - `/admin` now keeps only KPI cards and no longer renders a duplicate schedule/calendar surface.
    - `/admin/schedules` remains the single Admin schedule surface.
    - Admin schedule attendance loading now queries attendance rows in chunks and throws a visible server error if attendance cannot be loaded, instead of silently treating past sessions as review gaps.
    - No production data was modified.
  - Verification:
    - `npm run check:mojibake` passed.
    - `npx tsc --noEmit` passed.
    - `npm run lint` passed.
    - `npm run attendance:reconcile:dry-run` passed; report still shows production `booking_sessions.status` rows that are stale while attendance rows already exist, which is data reconciliation follow-up only.
    - `git diff --check` passed with Windows line-ending warnings only.
    - `npm run build` passed.

- [x] 21.6.14 Attendance Reconciliation Write
  - Production data consistency issue confirmed 2026-06-03: `attendance` rows were correct, but 21 `booking_sessions.status` rows were still stale as `scheduled`.
  - Business rule:
    - `attendance` remains the source of truth for present/late/absent.
    - Reconciliation writes may update only `booking_sessions.status`.
    - `present`/`late` attendance maps to `booking_sessions.status = completed`.
    - `absent` attendance maps to `booking_sessions.status = absent`.
    - Do not touch payments, bookings, lesson wallet, makeup records, coupons, coach assignments, or attendance rows.
  - Implemented:
    - Added `npm run attendance:reconcile:write` using the same report logic as `npm run attendance:reconcile:dry-run`.
    - Write mode refuses to run if exact student-scope mismatches are found.
    - Write mode updates rows by current `id + status` guard to avoid overwriting concurrent changes.
  - Production write result:
    - Dry-run before write: `Student-scope attendance mismatches: 0`, `Status mismatches: 21`.
    - Write applied: 21 `booking_sessions.status` rows updated from attendance.
    - Dry-run after write: `Student-scope attendance mismatches: 0`, `Status mismatches: 0`.
    - `Booking status without attendance: 9` remains as a separate historical-data review bucket; no action was taken on those rows.
  - Production was not deployed for this data-only reconciliation.

- [x] 21.6.15 Attendance Write-Through / DB Sync Guard
  - Production issue found 2026-06-03: Coach/Admin attendance can be correct while `booking_sessions.status` becomes stale, causing Admin/User/Coach status displays to disagree.
  - Goals:
    - Every Coach/Admin attendance write must sync the exact `booking_sessions.id` immediately.
    - `attendance` is the source of truth for present/late/absent.
    - `present`/`late` maps to `booking_sessions.status = completed`.
    - `absent` maps to `booking_sessions.status = absent`.
    - Update only the exact learner `booking_session_id`; never update another learner in the same slot/group.
    - Do not rely on daily/manual reconciliation for new attendance writes.
  - Safety:
    - Do not touch payments, bookings, lesson wallet, makeup rules, coupons, or coach assignment data.
    - If production stale data remains, report the exact rows before writing.
    - Do not deploy production until owner confirms.
  - Required checks: `npm run attendance:reconcile:dry-run`, `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `git diff --check`, and `npm run build`.
  - Implemented:
    - Added shared `syncBookingSessionStatusFromAttendance()` helper so Coach/Admin attendance writes use the same mapping.
    - Coach attendance API now writes attendance, then uses service-role write-through to update only the exact `booking_sessions.id`.
    - Admin makeup retrospective attendance API now uses the same helper for exact-session status sync.
  - Verification:
    - Dry-run before code fix: `Student-scope attendance mismatches: 0`, `Status mismatches: 2`, `Booking status without attendance: 0`.
    - `npx tsc --noEmit` passed.
    - `npm run check:mojibake` passed.
    - `npm run lint` passed.
    - `git diff --check` passed with Windows line-ending warnings only.
    - `npm run build` passed.
    - Dry-run after code fix reported existing stale production rows; owner confirmed production sync.
  - Production data sync after owner confirmation:
    - `b4f96087-8dd1-4747-beab-5519de5eedd0` | 2026-06-03 15:00-17:00 | learner `แผ่นดิน` | `scheduled` -> `completed` from `present`.
    - `b1611125-efc8-458f-85e1-2f96a9a7b69b` | 2026-06-03 15:00-17:00 | learner `มาวิน` | `scheduled` -> `absent` from `absent`.
    - `753d6ba5-f782-41a0-81f7-cb291b0a2de5` | 2026-06-03 17:00-19:00 | learner `ปริญ` | `scheduled` -> `completed` from `present`.
    - Dry-run after write: `Student-scope attendance mismatches: 0`, `Status mismatches: 0`, `Booking status without attendance: 0`.
  - Production deploy note:
    - New attendance writes will auto-sync only after this code guard is deployed to production.

- [x] 21.6.16 Retroactive Coach Evidence Request
  - Production issue found 2026-06-03: Admin can record retroactive attendance for a real taught slot, but if no `coach_checkins` evidence exists, the owner still sees "no evidence" and has no clean way to request only selfie/GPS from the responsible coach.
  - Goals:
    - Admin can keep recording retroactive attendance as before.
    - If attendance is recorded but `coach_checkins` evidence is missing or incomplete, show "attendance recorded, coach evidence missing".
    - Add an Admin action to request retroactive coach evidence.
    - Coach sees the retroactive task and must submit selfie + GPS through the coach check-in flow.
    - Admin must never create coach evidence on behalf of a coach.
  - Safety:
    - Do not touch payment, booking, lesson wallet, makeup entitlement rules, coupons, or assignment logic.
    - Evidence request should use notification/activity log only until the coach submits real selfie/GPS.
    - Do not deploy production until owner confirms.
  - Required checks: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, `git diff --check`, and `npm run build`.
  - Implemented 2026-06-03:
    - Admin makeup review now separates "attendance recorded but coach evidence missing" from real missing-attendance cases.
    - Added an Admin action to request retroactive coach evidence for a grouped slot without creating `coach_checkins` on behalf of the coach.
    - Coach retro check-in lookup now accepts the new evidence-request activity action, so the responsible coach can submit selfie + GPS through the existing coach check-in flow.
    - Scope preserved: no payment, booking, lesson wallet, makeup entitlement, coupon, or assignment logic was changed.
  - Verification:
    - `npm run check:mojibake` passed.
    - `npx tsc --noEmit` passed.
    - `npm run lint` passed.
    - `git diff --check` passed.
    - `npm run build` passed.
    - `npm run attendance:reconcile:dry-run` passed as a report-only command, but reported 1 existing production status mismatch outside this item: session `1b9d1b2b-2078-4c47-a042-46d74ae41fa6`, learner `โหย่ว`, 2026-06-03 17:00-19:00, `booking_status=scheduled`, `attendance=present`, expected `completed`. No production data was modified.

- [x] 21.6.17 Makeup Review Action Guard + Bangkok Time Fix
  - Production issue found 2026-06-03: Admin makeup review actions share one broad validation guard, so valid actions such as retroactive attendance or close review can be blocked by confirm-absent rules and show the wrong error.
  - Goals:
    - Make session-ended checks explicit to Asia/Bangkok time.
    - Split `/api/admin/makeup` validation by action instead of using one shared status guard.
    - `confirm_absent` uses only the confirm-absent rule.
    - `mark_attendance` can record retroactive attendance after the class has ended in Bangkok time.
    - `close_review` can close the case without being blocked by confirm-absent validation.
    - `return_entitlement` keeps its own entitlement return rules.
    - `request_coach_review` and `request_coach_evidence` keep their existing flow.
    - Error messages should match the action the Admin clicked.
  - Safety:
    - Do not touch payment, booking, lesson wallet, coupon, or assignment logic outside this action guard.
    - Do not deploy production until owner confirms.
  - Required checks: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, `git diff --check`, and `npm run build`.
  - Implemented 2026-06-03:
    - `/api/admin/makeup` now evaluates ended sessions using an explicit Asia/Bangkok `+07:00` timestamp.
    - Replaced the shared non-scheduled status guard with action-specific validation.
    - `confirm_absent` keeps the confirm-absent-only rule, while `mark_attendance`, `close_review`, `return_entitlement`, `request_coach_review`, and `request_coach_evidence` keep their own action flow after the class has ended.
    - Error messages now match the action that Admin clicked instead of always returning the confirm-absent message.
    - Scope preserved: no payment, booking, lesson wallet, coupon, or assignment logic was changed.
  - Verification:
    - `npm run check:mojibake` passed.
    - `npx tsc --noEmit` passed.
    - `npm run lint` passed.
    - `git diff --check` passed with Windows line-ending warnings only.
    - `npm run build` passed.
    - `npm run attendance:reconcile:dry-run` passed as report-only. It found 1 existing production status mismatch outside this item: session `1b9d1b2b-2078-4c47-a042-46d74ae41fa6`, learner `โหย่ว`, 2026-06-03 17:00-19:00, `booking_status=scheduled`, `attendance=present`, expected `completed`. No production data was modified.

- [ ] 21.6.18 Attendance Sync Root-Cause Audit + Write-Path Enforcement
  - Production blocker: `attendance` and `booking_sessions.status` must not drift again after Coach/Admin records attendance. Manual reconciliation is only a repair tool, not the normal operating model.
  - Problem evidence:
    - Dry-run after 21.6.17 still found session `1b9d1b2b-2078-4c47-a042-46d74ae41fa6`, learner `โหย่ว`, 2026-06-03 17:00-19:00, `booking_status=scheduled`, `attendance=present`, expected `completed`.
    - This means at least one write path can still create/update attendance without syncing the exact `booking_sessions.id`.
  - Goals:
    - Audit every code path that writes to `attendance`.
    - All Coach/Admin attendance writes must call one shared write-through helper immediately after attendance is created or updated.
    - The helper must update only the exact `booking_sessions.id` for that student/session.
    - `present` or `late` must sync `booking_sessions.status` to `completed`.
    - `absent` must sync `booking_sessions.status` to `absent`.
    - Admin/User/Coach display must keep reading attendance-derived status through the shared status helper instead of deciding from `booking_sessions.status` alone.
    - Add a guard/check script or test that fails/report-blocks when future attendance writes are not followed by status sync.
    - Run dry-run before and after the fix. Production stale rows must be reported before any write, and production writes require owner confirmation.
  - Safety:
    - Do not touch payment, booking purchase, lesson wallet, coupon, pricing, SlipOK, or coach assignment behavior unless directly needed to preserve exact-session status sync.
    - No blind production data update. Any stale sync write must be scoped to listed session IDs and confirmed first.
    - No deploy production until owner confirms.
  - Required checks: `npm run check:mojibake`, `npx tsc --noEmit`, `npm run lint`, `npm run attendance:reconcile:dry-run`, `git diff --check`, and `npm run build`.

## Phase 3 - Build & Deploy Readiness

- [x] Make `npm run build` pass.
- [x] Add mojibake guard: run `npm run check:mojibake` before committing Thai UI/copy changes.
- [x] Add local verification note: after `npm run build`, restart the dev server before checking localhost to avoid stale Next CSS chunks.
- [x] Reduce lint blockers: unused imports, unused variables, JSX escaping, and high-risk `any` usage.
- [x] Current local verification passes: `npm run check:mojibake`, `npm run lint`, `npm run build`, and `git diff --check`.
- [ ] Review dependency vulnerabilities and update safely.
- [ ] Prepare production environment variables.
- [ ] Deploy staging and run smoke tests.

## Phase 4 - Feature Completion

- [ ] Real-time notifications.
- [ ] Automated renewal/payment reminders.
- [ ] Advanced reports for revenue, enrollment, coach performance.
- [ ] Level recommendation system.
- [ ] Adult package usage across 10 months.
- [ ] Waitlist and class capacity enhancements.

## 2026-07-17 - Admin Schedules Unassigned Group Classification Audit/Fix

- Owner selected this as the single urgent active task and authorized only
  read-only audit, narrow Source fix, local verification, and documentation.
- Read-only Production evidence confirmed the source contract failure on the
  2026-07-16 Rama 2 Kids Group 17:00-19:00 round: exact group
  `476fb938-af93-4689-82cb-377acd108d0d` has five active learner memberships and
  `coach_id = null`; same-slot legacy coaches are not exact learner evidence.
  Production data was not changed.
- Root cause: Admin Schedules treated any group membership as Assigned and rendered
  every non-empty group green. It did not require a resolved coach profile/role.
- Scoped Source fix: `src/lib/admin-schedule-assignment-state.ts` now owns the
  exact-valid predicate and round buckets; the schedule page supplies profile id,
  name, and role; the client renders grouped-but-unassigned learners in a red
  warning group and counts them in `รอจัดโค้ช`. Wallet and valid-group behavior
  remain unchanged.
- Verification passed: deterministic checks `12/12`, disposable authenticated
  desktop/mobile Playwright `1/1` with residue `0`, TypeScript, targeted/full
  ESLint, mojibake `231`, `git diff --check`, visual screenshot inspection, and
  agent-browser dev health. Build was not required/run.
- State observed at this closeout: Source complete locally; tests passed; not
  committed, pushed, deployed, enabled, allowlisted, or Production-active; no
  migration, Production write, data repair, customer-data change, or financial
  impact. Next gate is Owner approval for commit/push/deploy and authenticated
  read-only Production UAT. Admin Schedules Performance and Homepage LV remain
  unauthorized Parking Lot items.

### Build + Commit + Push closeout (state observed 2026-07-17)

- Owner subsequently authorized re-verification, Production Build, post-build
  clean restart, a scoped Source/Test commit and push, and a separate documentation
  closeout commit and push. Deploy, Production UAT, Production data changes,
  migration, auto-assignment, Admin Schedules Performance, and Homepage LV remained
  prohibited.
- Verification passed again: deterministic assignment-state checks `12/12`;
  disposable authenticated desktop/mobile Playwright `1/1` with fixture residue
  `0`; visual artifact inspection; TypeScript; targeted and full ESLint; mojibake
  `231`; and scoped/staged `git diff --check`.
- Production Build passed with 91/91 static pages. The verified repo-local `.next`
  directory was removed, the dev server restarted cleanly on `127.0.0.1:3000`,
  root and a generated static asset returned `200`, and `/admin/schedules` returned
  the expected `307` login redirect with no server error.
- Functional commit `0226e363f6677b078430f93459c2ee2ede6484e8` contains exactly
  the seven approved Source/Test files and is pushed to
  `origin/spike/next-major-security-upgrade`. The unrelated dirty `AGENTS.md`,
  content-identical/stat-dirty `src/lib/schedule-slot-utils.ts`, and
  `docs/performance/` remained excluded.
- State observed at this closeout: Source is tested, built, committed, and pushed;
  deployment has not started; Production-active behavior and Production UAT for
  this fix are not claimed; Production data did not change; customer impact remains
  the existing misleading Admin/Head Coach classification until deployment; and
  financial impact is none. Task Done remains No. The next gate is Owner approval
  for exact-source deployment and authenticated read-only Production UAT.

### 2026-07-17 — Admin Schedules Unassigned Coach Group Production Release Closeout

State observed at this closeout on 2026-07-17:

- Root cause: Admin Schedules treated exact learner group membership alone as
  Assigned without requiring a non-null group `coach_id`, matching resolved coach
  profile, non-empty coach name, and `coach|head_coach` role. That made an
  unassigned learner group green and incorrectly counted its learners as coached.
- Owner authorized only fresh Git/Vercel preflight, exact-source Production
  deployment, convergence of the established aliases, authenticated read-only
  Production UAT, runtime monitoring, and final documentation closeout. No
  Source/Test change, migration, environment/feature-control/allowlist change,
  Production business-data write, assignment save, attendance/check-in/payroll
  write, auto-assignment, performance work, Homepage LV work, or new task was
  authorized or performed.
- Gate 0 passed on branch `spike/next-major-security-upgrade`: pre-closeout Local,
  upstream, and fetched remote HEAD were
  `487b63ee7faa0e0b14703a9603d287035fccddec`, ahead/behind `0/0`; functional
  Source `0226e363f6677b078430f93459c2ee2ede6484e8` was an ancestor and contained
  exactly the seven approved Source/Test files. Unrelated dirty `AGENTS.md`,
  `src/lib/schedule-slot-utils.ts`, and `docs/performance/` remained excluded.
- Pre-deploy Gate 1 verified Ready rollback deployment
  `dpl_6QCDg6omy3ZTFCm36W8G3AH7YqNr`, its four established aliases, healthy root/
  health/static/auth responses, and the unchanged set of eleven Production
  environment variable names. The older pre-Teaching-Programs deployment was not
  selected as the rollback target.
- Exact Source `0226e363f6677b078430f93459c2ee2ede6484e8` was deployed from a
  clean detached worktree with tree
  `d1b371bfcaef19494c4ac723b89f3e3e9e416ec0`. Vercel Production Build passed
  with 91/91 static pages. Ready deployment
  `dpl_CsuBEfun5RtPWpSgC5iQjYjbH7j8` was created and all four established aliases
  converged to it:
  - `www.newathleteschool.com`
  - `new-athlete-badminton-school.vercel.app`
  - `new-athlete-badminton-school-aachanin1s-projects.vercel.app`
  - `new-athlete-badminton-school-aachanin1-aachanin1s-projects.vercel.app`
- Post-deploy root, `/api/health`, generated static asset, and Admin auth guard
  checks passed. Production environment names remained unchanged; no feature flag,
  allowlist, migration, or local environment/link file changed. Rollback was not
  used.
- Authenticated Super Admin read-only Production UAT passed the exact reproduction:
  2026-07-16, Rama 2, Kids Group, 17:00–19:00, slot
  `b2c6ec1a-2136-48c5-b0ba-4141d5923d94`, group
  `476fb938-af93-4689-82cb-377acd108d0d`. The group with `coach_id = null` rendered
  red with `ยังไม่ได้มอบหมายโค้ช`; its five active learners counted in
  `รอจัดโค้ช`, same-slot legacy coaches did not make them assigned, and two
  walleted learners remained excluded. Exact counters were
  `7 มีโค้ช / 5 รอจัดโค้ช / 2 อยู่ในกระเป๋า`.
- Both valid exact assigned groups in that round remained emerald/green with coach
  names. Learner LV, attendance labels, and teaching-program boxes remained
  visible. Desktop and explicit 390x844 mobile UAT passed; the red warning was
  readable and stayed inside its card with no horizontal overflow. Browser
  console, hydration, and page errors were `0`.
- Monitoring for the UAT window found runtime errors/5xx `0`, PUT/PATCH/DELETE
  requests `0`, and no assignment, attendance, or check-in mutation. Shared
  Production logs contained two normal `POST /api/reschedule` requests from
  unrelated user traffic; neither was attributable to the Admin Schedules UAT.
  The UAT itself issued no business-data mutation request.
- Final state: Source complete **Yes**; tests/build **Passed**; functional Source
  committed/pushed **Yes**; deployed/Production active **Yes**; authenticated
  read-only Production UAT **Passed**; controlled-write UAT **Not required/not
  run**; data repaired **No**; Production data changed by this task **No**;
  customer impact **corrected Admin/Head Coach assignment classification**;
  financial impact **None**; Task Done **Yes**; Active Task **NONE**; blocker and
  remaining work **None**. Next action is to await Owner selection without starting
  Admin Schedules Performance, Homepage LV, or another Parking Lot task
  automatically.

## 2026-07-17 — Coach Assignment Overlap Guard and Ungrouped Semantics (Local Gate)

State observed at this local closeout on 2026-07-17:

- Initial documentation state still said Active Task `NONE`; Owner selected this
  remediation and supplied six binding decisions. Classified and corrected as
  `DOCUMENTATION DRIFT — NEW OWNER DECISIONS NOT YET RECORDED`.
- Read-only preflight reconfirmed branch
  `spike/next-major-security-upgrade`, Local/upstream/fetched remote HEAD
  `4f2aa8b2e606f9753124b5818bf8b38c246d7a4c`, ahead/behind `0/0`, Ready
  Production deployment `dpl_CsuBEfun5RtPWpSgC5iQjYjbH7j8`, and deployed Source
  `0226e363f6677b078430f93459c2ee2ede6484e8`. Unrelated dirty `AGENTS.md`,
  `src/lib/schedule-slot-utils.ts`, and `docs/performance/` were preserved.
- Production rows matched the audit: Coach Nice
  `4bad40cc-7367-49a2-aa81-42f35d840d79` owns overlapping Ratchada group
  `924d0a7c-2d0d-4f75-a2f9-03617cb9d23a` / slot
  `150b25ba-b55a-448f-9aad-19748ba36b93` / three learners and Ramintra group
  `d0b68d67-1ae3-416c-b2f2-99e9ee994449` / slot
  `98f60622-d02b-4333-9d65-8f4f7a86d8b1` / one learner, both 17:00–19:00.
  Owner selected Ramintra. Legacy rows are respectively
  `3bcafc20-f927-4814-a586-da7819445d60` and
  `b31c3bce-d319-489b-b7a2-ff5382497c0c`.
- Ratchada placeholder group `2e7d4b1f-ddf1-4edc-9667-efb07dadfcfc`, name
  `ยังไม่จัดกลุ่ม`, stores Coach Base
  `c1a5d3ca-9f90-48fb-943c-d96ac5a6afbe` and two learners. It is now treated as
  non-exact in display semantics, but Production data was not changed. A later
  repair requires an explicit choice between renaming it as a real Base-owned
  group or clearing its coach.
- Root source cause: the normal Head Coach save only rejected duplicate coach ids
  inside one submitted slot and performed non-atomic group/member/legacy writes;
  Admin Makeup paths had no shared cross-slot interval guard; the database had no
  concurrency exclusion. Separately, the ungrouped draft copied a suggested coach
  and Admin Schedules classified any valid group `coach_id` as exact regardless of
  the placeholder name.
- Local implementation added shared exact-conflict inspection and Thai conflict/
  legacy-warning formatting; applied it to the normal assignment route and all
  active Admin Makeup exact-assignment actions; changed the normal save to one
  transaction RPC; added a derived reservation table with GiST exclusion and
  group/member triggers; and added a no-write historical conflict preflight RPC.
  Existing rows are not backfilled or repaired and legacy rows never hard-block.
- Display now excludes `ยังไม่จัดกลุ่ม` from exact assignment and coach search,
  starts a new ungrouped draft with `coachId = null`, retains existing counters,
  and labels legacy coach data as not being the group owner. Exact normal groups
  continue rendering their real responsible coach.
- Verification passed: database conflict/concurrency `11/11`; deterministic
  display/authorization `15/15`; disposable Playwright `2/2`; local fixture and
  reservation residue `0`; TypeScript; full ESLint; mojibake `232`; Production
  Build 91/91; post-build clean restart root/static `200`; and diff check. Local
  migration reset/apply, last-migration rollback, re-apply, preflight `0`, and
  concurrency winner `1/2` passed.
- Production repair dry-run: keep Nice at Ramintra and keep legacy row `b31...`;
  proposed later controlled write clears Nice only from Ratchada group `924...`
  and removes only Ratchada legacy row `3bc...`, leaving three learners grouped
  and waiting for a replacement. Placeholder group `2e7...` remains a separate
  Owner decision. Historical conflicts and attendance/check-in/teaching-hours/
  payroll remain unchanged.
- Final state at this closeout: Source complete locally **Yes**; tests/build
  **Passed**; committed **No**; pushed **No**; Production migration **Not
  applied**; deployed/Production active **No**; Production UAT/write UAT **Not
  run**; data repaired **No**; Production data changed **No**; historical
  attendance/payroll changed **No**; customer impact **existing coordination risk
  remains until approved repair/deploy**; Task Done **No**. Next gate is Owner
  review and explicit approval before commit/push or any Production action.

## 2026-07-17 — Controlled Coach Nice Ratchada Production Repair

State observed after the Owner-approved exact-row repair on 2026-07-17:

- Owner policy: Coach Nice `4bad40cc-7367-49a2-aa81-42f35d840d79` must remain at
  Ramintra for the 17:00–19:00 round. Only the conflicting Ratchada exact group and
  its named matching legacy row were authorized for repair. Group membership,
  Coach Base, historical evidence, and all financial data were prohibited from
  change.
- Fresh preflight matched the approved dry-run exactly: Ratchada group
  `924d0a7c-2d0d-4f75-a2f9-03617cb9d23a` still had Nice and three learners;
  Ratchada legacy row `3bcafc20-f927-4814-a586-da7819445d60` still existed;
  Ramintra group `d0b68d67-1ae3-416c-b2f2-99e9ee994449` still had Nice and one
  learner; Ramintra legacy row `b31c3bce-d319-489b-b7a2-ff5382497c0c` still
  existed. Both slots remained dated 2026-07-17, 17:00–19:00, at their approved
  branches.
- One explicit transaction locked and reasserted the exact slots, groups,
  memberships, legacy rows, coach ids, member counts, and empty downstream
  dependencies before writing. It set only Ratchada group `924...`.`coach_id`
  from Nice to `null` and deleted only legacy row `3bc...`. Exact affected counts:
  group update `1`; legacy delete `1`.
- Independent post-write reconciliation confirmed the Ratchada group has
  `coach_id = null`, its target legacy row is absent, and all three learners remain
  scheduled in the same group: ปฐพี จินตานนท์
  (`35d68dc4-ddcb-4dd4-8b6e-52af8e27f321`), ญาณพัฒน์ คูศุภรเจริญ
  (`5477519d-9447-41f5-aea1-17e3815b3ae1`), and นภิสา จินตานนท์
  (`d64ea638-d350-4d96-9793-d75309a82139`). They are now waiting for a replacement
  coach.
- Ramintra group `d0b...` remains assigned to Nice with learner wynn udompanit
  (`8563888b-b813-4b7b-a617-772da1658178`), and legacy row `b31...` remains.
  Ratchada placeholder group `2e7d4b1f-ddf1-4edc-9667-efb07dadfcfc`, Coach Base,
  and its two learners remain unchanged. Target-slot totals remain three groups
  and six memberships.
- Attendance, coach check-in, teaching program, daily teaching hours, weekly
  teaching summary, and payout dependency queries were empty before and after.
  No historical attendance/check-in/teaching-hours/payroll or financial data was
  changed.
- Final state: Source changed in this repair round **No**; migration applied
  **No**; committed **No**; pushed **No**; deployed **No**; data repaired **Yes —
  exact Nice/Ratchada scope only**; Production data changed **Yes — one group
  update and one legacy delete**; financial impact **None**. The local overlap/
  display remediation remains uncommitted and undeployed. Operational remaining
  action: assign a replacement coach to the three Ratchada learners. No next step
  was started automatically.

## 2026-07-17 — Local Auto Group Naming and Migration Safety Gate

State observed at this local closeout on 2026-07-17:

- Owner superseded the prior replacement-coach action: the three learners in the
  Nice/Ratchada group may intentionally remain unassigned and display
  `ยังไม่ได้มอบหมายโค้ช`. Owner confirmed Coach Base is the exact responsible
  coach for the other two Ratchada learners; its coach, members, and legacy row
  must remain, while the placeholder group name requires a separately approved
  rename.
- Naming audit found the old client auto-bands (`0–10`, `11–30`, `31–50`,
  `51–70`) were obsolete and conflicted with the active Level source. The new
  local rule reads the latest `student_levels` row and active `levels.category /
  program_name`. One shared category/program yields that existing program name;
  all LV0 yields the existing `ยังไม่ประเมิน` label. Mixed categories, mixed
  assessed/unassessed members, or incomplete/inactive definitions do not invent a
  name and require a manual group name. Valid user-authored names remain intact.
- Stored auto-names no longer include `(N คน)`. Coach and Admin displays derive
  member counts from their current arrays, so adding/moving/removing members cannot
  leave a stale number embedded in the displayed name. Exact coached groups cannot
  newly save blank, `ยังไม่จัดกลุ่ม`, or count-suffixed names.
- Fresh read-only Coach Base dry-run reconfirmed group
  `2e7d4b1f-ddf1-4edc-9667-efb07dadfcfc`, Coach Base
  `c1a5d3ca-9f90-48fb-943c-d96ac5a6afbe`, slot
  `150b25ba-b55a-448f-9aad-19748ba36b93`, 2026-07-17 17:00–19:00 Ratchada,
  and exactly two members. Their latest levels are LV6 and LV3, both active
  `basic / ชุดพื้นฐาน`; deterministic proposed name: **`ชุดพื้นฐาน`**. This was
  dry-run only; no Production row changed.
- Migration review corrected three safety gaps: a standalone CTE-only read-only
  preflight can run before apply; every current/future active exact group is
  backfilled into the reservation table after a zero-blocker gate; and triggers
  resynchronize reservations for group coach/slot, member insert/move/delete,
  slot date/time, booking-session lifecycle/slot, and booking lifecycle changes.
  Historical rows are neither reserved nor repaired.
- The exact standalone Production preflight ran read-only and returned active exact
  groups `968`, current/future reservation candidates `237`, current/future
  blocking conflicts `0`, and historical report-only conflicts `8`. Production
  migration history still ends at `20260715060541`; migration
  `20260717070225_coach_assignment_conflict_guards.sql` remains local only.
- Local verification passed: assignment naming/display/authorization `24/24`;
  database conflict/backfill/concurrency/lifecycle `21/21`; disposable authenticated
  Playwright authorization plus desktop/mobile Daily Board `2/2`; TypeScript;
  full ESLint; mojibake `234`; Lesson Wallet regression `17/17`; Production
  readiness check; Production Build 91/91; post-build clean restart root and
  `_next/static` `200`; in-app browser console errors `0`; and fixture/reservation
  residue `0`. Local migration reset/apply, rollback, re-apply, and retest passed.
- Final state for this round: Source complete locally **Yes**; tests **Passed**;
  migration safety **Proven locally**; committed **No**; pushed **No**; Production
  migration **Not applied**; Production Source active **No**; deployed **No**;
  Production data changed in this round **No**; Coach Base renamed **No**;
  historical attendance/check-in/teaching-hours/payroll changed **No**; financial
  impact **None**. The earlier exact Nice/Ratchada repair remains the only
  Production data change in the overall active task.
- Next gate requires separate Owner approvals for: (1) commit/push of the tested
  local Source/Test/Migration/Documentation set; (2) the exact Coach Base name-only
  Production repair to `ชุดพื้นฐาน`; (3) Production migration apply after a fresh
  identical read-only preflight still reports zero current/future blockers; and
  (4) exact-source deploy plus authenticated Production UAT. No step starts
  automatically.

## 2026-07-17 — Coach Assignment Remediation Scoped Commit and Push

State observed at this publish closeout on 2026-07-17:

- Owner accepted the deterministic Coach Base dry-run name `ชุดพื้นฐาน` and
  authorized only two scoped commits followed by a non-force push. Production
  rename, Production migration, deploy/aliases, Production UAT/write, environment,
  feature-control, allowlist, historical cleanup, and Parking Lot work remained
  prohibited.
- Before staging, branch `spike/next-major-security-upgrade`, Local HEAD, fetched
  remote HEAD, and upstream HEAD all matched
  `4f2aa8b2e606f9753124b5818bf8b38c246d7a4c` with ahead/behind `0/0`.
  The reviewed task set contained 17 paths: 11 modified, 6 new, and 0 deleted.
  Pre-existing dirty `AGENTS.md`, `src/lib/schedule-slot-utils.ts`, and
  `docs/performance/` were preserved and excluded from both commits.
- Migration `20260717070225_coach_assignment_conflict_guards.sql` SHA-256 was
  `2124C57725AA8891BD456927C37530F180019B8C0710EE73E6E9717174926EF8` before
  staging and the staged blob matched. The standalone preflight is one read-only
  CTE statement with no mutation or DDL token. The scoped set contained no secret
  value or local environment file.
- Fresh verification passed without further Source changes: naming/display/
  authorization `24/24`; database conflict/backfill/concurrency/lifecycle `21/21`;
  fixture and reservation residue `0`; TypeScript; full ESLint; mojibake guard
  `234`; and `git diff --check`.
- Source/Test/Migration commit is
  `1b995396f432d11b133c1cf4b5604b6db875b63b` (`fix: guard coach assignments and
  group naming`). This dated closeout is the separate documentation follow-up;
  its exact SHA is the Git commit containing this record and is reported in the
  session closeout. Both commits were pushed together non-force. A post-push fetch
  confirmed Local/Remote HEAD convergence and ahead/behind `0/0`.
- Production migration remains **Not applied**; Coach Base remains named
  `ยังไม่จัดกลุ่ม` in Production; remediation Source remains **Not deployed**;
  Production UAT was **Not run**; and no Production data, financial data,
  attendance, check-in, teaching-hours, or payroll record changed in this publish
  round. The earlier controlled Nice/Ratchada repair remains unchanged.
- Task Done remains **No**. Next gate requires separate Owner approval for the
  exact Coach Base name-only repair, Production migration apply after a fresh
  read-only preflight remains clear, and exact-source deploy plus authenticated
  Production UAT. Permanent `AGENTS.md` rule work remains a separate documentation
  task and was not mixed with the pre-existing dirty file.

## 2026-07-17 — Documentation Drift Corrected: Coach Base Owns Five Learners

State observed at this corrective documentation closeout on 2026-07-17:

- Fresh read-only Production reconciliation matched the Owner-confirmed state.
  Coach Base group `2e7d4b1f-ddf1-4edc-9667-efb07dadfcfc` still has coach
  `c1a5d3ca-9f90-48fb-943c-d96ac5a6afbe`, stored name `ยังไม่จัดกลุ่ม`, and five
  raw/active members. Their latest active levels are LV 15, 6, 6, 3, and 8; every
  learner resolves to `basic / ชุดพื้นฐาน`. The deterministic proposed name
  therefore remains `ชุดพื้นฐาน`.
- Former waiting group `924d0a7c-2d0d-4f75-a2f9-03617cb9d23a` has
  `coach_id = null` and zero raw/active members. Owner confirmed that the three
  learner moves into Coach Base were intentional and the learners must not be
  moved back.
- Activity logs `1db62d59-1ae9-4ae6-8129-1da7fdb7f0c1`,
  `51bb003e-6d0c-4867-8f23-60a60b4e80fe`, and
  `727b2194-cf2d-47d9-9ee3-7a79086e13c1` record three normal Production-user
  `attendance_gap_move_learner_to_existing_group` actions at 20:14:17, 20:14:39,
  and 20:14:53 ICT. They moved booking sessions
  `3919671b-805d-4cb4-b1cd-ee7b24267e91`,
  `e1aae95f-1698-4262-99ee-c246b42211b7`, and
  `11a55e1b-b01c-404f-89b9-c790b026b5ea` from `924...` to `2e7...` for Coach
  Base. Actor `860c4d76-ca08-4252-8e18-68f9802ca60e` was a Production user, not
  Codex. Every log records attendance write `false`, booking-session status change
  `false`, and coach-evidence deletion `false`.
- Classified as `DOCUMENTATION DRIFT CORRECTED — OWNER CONFIRMED COACH BASE OWNS
  FIVE LEARNERS`. This round changed only `PROJECT_STATE.md`, `TODO-CODEX.md`, and
  `DEVELOPMENT_TODO.md`; Source/Test/Migration and Production data were not
  changed. Production migration history still ends at `20260715060541`.
- Coach Base was **not renamed**; remediation Source remains **not deployed**;
  Production migration remains **not applied**; Production UAT was **not run**;
  Task Done remains **No**. Next gate requires separate Owner approval for the
  exact Coach Base name-only repair to `ชุดพื้นฐาน`, Production migration apply,
  and exact-source deploy plus authenticated Production UAT. No Production action
  starts automatically.

## 2026-07-17 — Exact Coach Base Name-Only Production Repair

State observed at this controlled repair closeout on 2026-07-17:

- Owner approved only an exact name change for Coach Base group
  `2e7d4b1f-ddf1-4edc-9667-efb07dadfcfc`, from `ยังไม่จัดกลุ่ม` to
  `ชุดพื้นฐาน`. Moving learners, changing coach or legacy assignments, deleting
  the empty former group, applying the migration, deploying Source, and every
  attendance/check-in/teaching/payroll/financial write remained prohibited.
- Fresh read-only Production preflight matched every hard condition: target coach
  `c1a5d3ca-9f90-48fb-943c-d96ac5a6afbe`, expected old name, target slot
  `150b25ba-b55a-448f-9aad-19748ba36b93`, raw/active members `5/5`, and five valid
  active learners at LV 15, 6, 6, 3, and 8, all resolving to
  `basic / ชุดพื้นฐาน`. Former group
  `924d0a7c-2d0d-4f75-a2f9-03617cb9d23a` remained `coach_id = null` with raw/
  active members `0/0`.
- At `2026-07-17 21:23:20 ICT`, one conditional update constrained by the exact
  target group id, exact Coach Base id, expected old name, five raw/active members,
  the five valid Level resolutions, and the empty former group changed only
  `name = ชุดพื้นฐาน`. Affected rows were exactly `1`; `updated_at` became
  `2026-07-17T14:23:20.536145+00:00`.
- Independent post-write reconciliation confirmed the same five exact member rows,
  learner/session ids, Coach Base id, and target-slot legacy row
  `9943df09-2e07-4cd6-9b52-112cc0fb51a0`. Former group `924...` remained empty and
  unassigned. Ramintra group `d0b68d67-1ae3-416c-b2f2-99e9ee994449`, Coach Nice,
  and legacy row `b31c3bce-d319-489b-b7a2-ff5382497c0c` remained unchanged.
- Before/after fingerprints matched for members, legacy rows, former/Ramintra
  groups, attendance, check-in, teaching programs, teaching hours, weekly
  summaries, payouts, payments, and finance metadata. Financial impact is
  **None**; no historical operational evidence changed.
- Authenticated Super Admin read-only Admin Schedules UAT for Ratchada on
  2026-07-17 passed. The target card shows `ชุดพื้นฐาน`, Coach Base, all five
  learners, Level range 3–15, and dynamic `ผู้เรียนในกลุ่มนี้ 5 คน`.
  `ยังไม่จัดกลุ่ม` is absent for this target; console, warning, page, and hydration
  errors were `0`. No Save or application mutation action was triggered.
- Source changed **No**; Production data changed **Yes — name-only one row**; Data
  Repaired **Yes — Coach Base group name only**; Migration Applied **No**;
  Deployed **No**; Production UAT for the new remediation Source **No**. Task Done
  remains **No**. The next Gate is separate Owner approval for Production migration
  after a fresh read-only preflight; deploy/UAT requires another later approval.

## 2026-07-17 — Coach Assignment Conflict Guard Production Migration Apply

State observed at this Production migration closeout on 2026-07-17:

- Owner authorized only a fresh read-only preflight, exact apply of committed
  migration `20260717070225_coach_assignment_conflict_guards.sql`, post-migration
  reconciliation, old-Source runtime health checks, and documentation closeout.
  Source/Test/Migration edits, deploy, application write UAT, business-data repair,
  environment/feature/allowlist changes, and every other migration remained
  prohibited.
- Gate 0 matched branch `spike/next-major-security-upgrade`, local/remote HEAD
  `90be20707d3a8ef8f2f3459d0721412295742c59`, and ahead/behind `0/0`.
  Pre-existing dirty `AGENTS.md`, `src/lib/schedule-slot-utils.ts`, and
  `docs/performance/` were preserved. The committed migration SHA-256 was exactly
  `2124C57725AA8891BD456927C37530F180019B8C0710EE73E6E9717174926EF8`.
  Remote history ended at `20260715060541`, and the pending set contained only the
  approved `20260717070225` migration. The standalone preflight was confirmed
  read-only.
- Fresh Production preflight reported active exact groups `966`, current/future
  reservation candidates `235`, current/future blocking conflicts `0`, and
  historical report-only conflicts `8`. The zero-blocker hard gate therefore
  passed.
- Standard linked migration apply completed successfully and applied only
  `20260717070225`. Remote migration history contains it exactly once and now ends
  at that version; a second dry-run reports the remote database is up to date and
  the pending set is empty.
- Reservation reconciliation passed: candidates/reservations `235/235`, missing
  reservations `0`, stale/orphan reservations `0`, field mismatches `0`, and
  current/future exact conflicts `0`. The reservation table and `btree_gist`
  extension exist; the expected primary/foreign/check constraints and GiST
  exclusion constraint exist; all five synchronization triggers are enabled; all
  twelve expected functions are present with fixed `search_path = public`; and
  table/RPC grants match the committed migration. The reservation table has RLS
  enabled, no anon/auth DML grants, and service-role CRUD access.
- Supabase advisors reported the intentional RLS-with-no-policy reservation table
  as informational and the committed `btree_gist` placement in `public` as a
  warning. These did not fail the approved gate and no ad-hoc schema change was
  made.
- Exact before/after fingerprints matched for `coach_assignment_groups` `1028`,
  `coach_assignment_group_students` `2430`, legacy `coach_assignments` `1002`,
  `attendance` `1739`, `booking_sessions` `2899`, `bookings` `543`, coach check-ins
  `703`, teaching hours `0`, weekly summaries `9`, payouts `0`, teaching programs
  `379`, payments `480`, wallet credits `70`, and finance expenses `1`.
  Production business and financial data therefore remained unchanged.
- Target reconciliation also remained exact: Coach Base group `2e7...` is
  `ชุดพื้นฐาน` with the same coach and raw/active members `5/5`; former group
  `924...` remains `coach_id = null` with `0/0`; Ramintra group `d0b...`, Coach
  Nice, and the exact target legacy rows remain unchanged.
- Read-only runtime health passed on the unchanged Production deployment
  `dpl_CsuBEfun5RtPWpSgC5iQjYjbH7j8`: `/` `200`, `/api/health` `200`, a generated
  static asset `200`, and unauthenticated `/admin/schedules` `307` to login.
  Authenticated Super Admin Admin Schedules rendered Coach Base, `ชุดพื้นฐาน`, the
  five learners, and the dynamic member count with new console/warning/page/
  hydration errors `0`. No Save, application mutation, deploy, redeploy, or alias
  action occurred.
- State at this closeout: Production DB changed **Yes — schema plus 235 derived
  reservation rows**; Production business data changed **No**; Source changed
  **No**; Coach/member/legacy data changed **No**; Financial impact **None**;
  Deployed **No**; Production UAT for the new Source **No**; controlled write UAT
  **No**; Task Done **No**. Next Gate requires separate Owner approval for the exact
  Source deploy and authenticated Production UAT. No next step starts
  automatically.

## 2026-07-18 — Coach Assignment Exact-Source Production Deploy

State observed at this infrastructure-only deployment closeout on 2026-07-18:

- Owner authorized only exact-source Production deployment of functional commit
  `1b995396f432d11b133c1cf4b5604b6db875b63b`, clean detached-worktree
  provenance, Ready/four-alias verification, root/health/static infrastructure
  checks, and documentation closeout. Authenticated Production UAT was explicitly
  deferred until tomorrow. Controlled write UAT, Save/mutation requests, Source,
  database migration, business data, environment, feature-control, allowlist, and
  Parking Lot changes remained prohibited.
- Gate 0 matched branch `spike/next-major-security-upgrade`, local/remote HEAD
  `86fbdc5331011de4caee8164d769c20bba9a5ef0`, and ahead/behind `0/0`.
  Migration `20260717070225` remained applied once with derived reservations
  `235`. Previous Production deployment and exact rollback target
  `dpl_CsuBEfun5RtPWpSgC5iQjYjbH7j8` was Ready. Pre-existing dirty `AGENTS.md`,
  `src/lib/schedule-slot-utils.ts`, and `docs/performance/` were preserved.
- Deployment worktree was detached at exact commit
  `1b995396f432d11b133c1cf4b5604b6db875b63b`, tree
  `24504017e59e597fc66d8d467186249290981bb6`, with tracked status clean before
  upload. The successful Vercel remote Production build completed TypeScript and
  generated `91/91` static pages.
- New deployment `dpl_Ga9NvYaYCcNG4BzVdqeCt3pBbQ4F` reached `Ready`, target
  `production`, at URL
  `https://new-athlete-badminton-school-2xt5m1d26-aachanin1s-projects.vercel.app`.
  Initial deployment creation left the established aliases on the old artifact;
  explicit promotion of the same Ready deployment completed successfully. Final
  read-only inspection confirmed all four established Production aliases resolve
  to `dpl_Ga9NvYaYCcNG4BzVdqeCt3pBbQ4F`:
  - `https://www.newathleteschool.com`;
  - `https://new-athlete-badminton-school.vercel.app`;
  - `https://new-athlete-badminton-school-aachanin1s-projects.vercel.app`;
  - `https://new-athlete-badminton-school-aachanin1-aachanin1s-projects.vercel.app`.
- Infrastructure-only checks passed on both public aliases. `/` returned `200`
  HTML, `/api/health` returned `200` JSON with `status = ok`, and generated asset
  `/_next/static/css/4e4fe59c9141653c.css` returned `200` CSS. Final deployment
  inspection remained Ready. Rollback was not required; the database migration
  was not rolled back.
- A first `vercel pull` in the randomly named detached directory created an
  unintended empty Vercel project named
  `nasc-exact-deploy-295bc76f9193419a9565139c6b2c1cbe`. It had no deployment and
  was immediately deleted. Follow-up inspection confirms the project no longer
  exists. The worktree was then linked explicitly to existing project
  `prj_v034HOI6AjaMpBezWvuvT0W24pTp`.
- Local prebuilt build installed dependencies but failed before producing a
  deployment because Vercel CLI on Windows returned `spawn cmd.exe ENOENT`.
  Tracked `.gitignore` was restored byte-for-byte to HEAD before the successful
  remote build. No deployment resulted from the failed local attempt. The exact
  detached worktree and downloaded temporary environment files were removed after
  verification.
- Source/Test/Migration changed **No**. Production DB/business data changed
  **No** in this deployment round. Environment, feature control, and allowlist
  changed **No**. Deployed **Yes**. Production Active **Yes** for the exact Source
  and previously applied reservation protection. Authenticated Production UAT
  Passed **No — scheduled for tomorrow**. Controlled write UAT **No**. Financial
  impact **None**. Task Done **No**. Next action is to wait for the Owner's
  scheduled instruction tomorrow before authenticated read-only Production UAT;
  no next task starts automatically.

## 2026-07-18 — Emergency Production Rollback and Head Coach Incident Audit

State observed at this emergency rollback closeout on 2026-07-18:

- Real Head Coach operations confirmed that Source deployment
  `dpl_Ga9NvYaYCcNG4BzVdqeCt3pBbQ4F` blocked assignment visibility and mixed-Level
  grouping. Owner authorized only an immediate rollback of the four Production
  aliases to `dpl_CsuBEfun5RtPWpSgC5iQjYjbH7j8`, narrow read-only incident
  verification, activity-log reconciliation, and documentation closeout.
- Rollback succeeded. Target deployment is Ready and all four aliases resolve to
  it. `/`, `/api/health`, and static asset
  `/_next/static/css/4e4fe59c9141653c.css` returned `200`. Current Production
  Source is restored to `0226e363f6677b078430f93459c2ee2ede6484e8`.
- Database migration `20260717070225` remains applied exactly once. Pre/post
  rollback fingerprints are identical: groups `1026` /
  `a19dc8518421d7d04618ec377bc3aa2b`; members `2432` /
  `68e30e1fccf733555392b7a35720cf88`; legacy `1000` /
  `2f63d86390d5b47186209f293a515a5e`; reservations `234` /
  `2ffff002063db9e9ba46eb8c24402e10`. Therefore rollback changed no database or
  reservation row. The earlier `235` count is historical; normal Production
  assignment activity had already changed current reservations to `234` before
  rollback.
- Authenticated read-only Head Coach verification after rollback showed `36/39`
  assigned slots, `3` unassigned, `135` learners, and 2026-07-18 with all `4/4`
  rounds assigned. The widespread false `ยังไม่ได้มอบหมาย` state was gone. No
  Save or mutation request was issued by Codex.
- Incident window reviewed: bad deployment creation at
  `2026-07-17T17:01:38Z` through post-rollback reconciliation. There were `51`
  successful `save_coach_assignment_groups` activity rows, first at
  `2026-07-17T18:26:13.466854Z` and last at
  `2026-07-18T05:19:24.350726Z`; `47` distinct slots, six actors, six branches,
  submitted totals `62` groups / `118` learner placements, and four saves with no
  coach. Actor/branch totals: แจ้งวัฒนะ/โคัช ตี๋ `21` saves (`21` slots);
  สุวรรณภูมิ/โคัช แบม `20` (`17`); เทพารักษ์/โคัช เบล `4` (`3`);
  พระราม 2/โคัช จ้า `2` (`2`); รัชดา/โคัช เบส `2` (`2`); and
  รามอินทรา/โคัช อิค `2` (`2`).
- The committed RPC deletes and recreates exact groups/members and slot legacy
  rows before inserting submitted state; reservation triggers synchronize derived
  protection. Current surviving rows for those slots are `55` exact groups, `97`
  member rows, `50` legacy rows, and `50` reservations. Every surviving row was
  created during the incident window. Repeated saves mean deleted/replaced row IDs
  and exact pre-save values are not retained in activity-log details; no repair may
  infer them.
- Exact affected slot IDs (`47`):
  `0c42e0ae-803e-46e6-94ee-9b7e69a9debd`,
  `0dba39b3-b144-42ef-86b5-b14522ee9973`,
  `1402f9f7-ed69-49d0-be41-6a2508cf56e1`,
  `172ec432-ea04-4b8f-b051-643078d97929`,
  `1c77289d-7c81-422a-a907-8d459e171cc8`,
  `24da232d-9464-499e-bfac-a88d1da76cd3`,
  `2600c26d-66ec-4541-b138-222adc60887d`,
  `2c8a78e2-5a8d-4c65-9ea4-082fad61ddbc`,
  `2d74f803-035f-4b3e-81d2-ac1de4f453c2`,
  `30de9108-4f5d-4b7b-a973-d6034395d85b`,
  `38cb731d-4d3d-47a0-a8c7-a05e27eaf14f`,
  `3e4a9116-3b94-4d4a-8e8d-589999a109d3`,
  `41264f66-b892-499b-8184-773e966756d5`,
  `49398c94-9b06-40e0-af41-bc931b9124be`,
  `4ccef74d-2ba4-43a2-a46d-ce259464e3ba`,
  `4edff3c8-d353-4407-b3cb-e59c3f5b88ad`,
  `510bb353-deda-41af-9b43-4cdd88a031e6`,
  `5266ddfb-8491-4cd2-9214-7c226b2a9bb0`,
  `540e5de9-f7ab-4be0-89f7-6ad272685a1f`,
  `5f6a33e8-eca6-407a-9cba-e5d2a6d2a4ff`,
  `748bead5-a0d7-4d62-9e04-9b225187e05e`,
  `77fd55b4-588a-41eb-a7f3-6be621c6d4b1`,
  `8325e74f-a202-40bb-bc6f-cef6521367c3`,
  `88be346a-fc92-4b06-af48-d7277856e042`,
  `8fb032a4-5303-40bd-bbeb-091c8033050e`,
  `910c6b5e-e969-42e5-8e32-4d8b9aba59b3`,
  `91b9b803-6696-453b-8802-82f0b409ce3f`,
  `92945dc6-497e-4c18-9ef1-a5cda54115fb`,
  `94696a94-42d8-4056-9063-44fcf77db060`,
  `a356af6f-a317-4b04-97d1-d1570d0cc11d`,
  `aa05ef02-c713-44a1-bfd1-352168409346`,
  `afa91321-aa6a-453b-8163-481e4feeb1ad`,
  `afe3d174-b3da-4bb9-b9ba-4a57ceffc1f8`,
  `bc4d18d4-9050-40d6-be97-982c35744e54`,
  `c1d5849f-7eef-4162-a7cc-a2a9cac8912e`,
  `c6526b09-b8e4-462b-95b5-a5eb3a44df27`,
  `da36347f-8ff6-4eca-aae4-30282ec44f2c`,
  `dbb11f93-7225-4489-bb66-833124a53a51`,
  `e35bd1b2-309e-4fc4-b48d-37291ae7bd7a`,
  `e4a16451-fd7a-455f-8765-c4cc759c09be`,
  `eaedfc9f-a0f3-4c0a-bcf2-95e0f512074d`,
  `ede40674-b21d-4f50-9c98-0cf2f1f20347`,
  `ee62b870-ea74-4765-a5e2-a70b37538ce4`,
  `f003625e-1d0b-4a05-9987-afd2ebe421d6`,
  `f585924d-bb63-47a2-a562-1f07423a9c73`,
  `f79a05cf-d9bc-4f6e-8a9b-9b796a1a1638`,
  `fa88ea5b-9986-4117-b5a7-6cf007e8068f`.
- Exact surviving group IDs (`55`):
  `09429650-5c5d-402b-b2db-b0314cee553e`, `0ce9dab5-bb62-496f-a485-aae50cbad2a9`,
  `0e1848e0-ca02-4469-ac85-5b3c4d5d9e90`, `1075cccd-227e-4b49-a8c8-d7162f88ff3b`,
  `132a4c78-2e39-4be9-a6e1-4be4f924e948`, `1a86d15d-49ec-4a06-9a4f-e4dbd9271813`,
  `223b9479-2267-4d9d-9871-6df51a3006b6`, `25f4050f-21fc-4a46-93f9-77076d229a67`,
  `27c5dab4-4f7d-4834-b545-e6e0b63cfeaa`, `2a247c84-fe81-4c49-abbf-0c64f306f06f`,
  `322b7599-6e06-4d72-b5c8-6ad15a330932`, `327cf9df-ffc5-492b-9e39-04ffed183424`,
  `37d790de-338e-4447-bc09-f9e969a4af1e`, `4183f82a-56bc-4316-a15e-22a8a8f610ac`,
  `41eb13dd-6a73-4b38-9bd3-b93f66ceaabc`, `42b4dcea-478e-47f3-bc85-10b22b1cb0f6`,
  `454e3b97-79ac-45c2-8ed3-8f67e5d4fc5a`, `477d7c44-ac11-4963-a40f-5c603b98409c`,
  `4ca63923-5913-4be1-8986-a967a8bfb645`, `4e7e5914-befd-442d-8178-dc81caf30df7`,
  `519798a5-ace0-4203-b80b-1a27d93603fd`, `54a46a53-e115-4084-a624-727accc2e8bd`,
  `59773d52-5b90-4a74-90e4-c23d297a9226`, `620f865e-19e8-44c2-b923-ea60b2e99722`,
  `7261c16c-9c37-41d5-aa74-4580d326246b`, `76a0ec4c-244c-47dc-8e3a-25659490a75c`,
  `7838f9be-7bfe-40f3-a54b-95309e361301`, `78e56458-8e33-47f3-89b5-0a6b22b5a3b6`,
  `7e577cdc-5d67-4d26-b0f6-bfc6a788860a`, `8412ee17-e58b-45e2-b6c0-79bf1c356e5a`,
  `8cdf83df-fe79-4440-95c1-de11fa4de065`, `8f5f6f91-0ee1-4106-8e50-2a5db7ee6aaf`,
  `93ccc54d-570b-4af0-9ae3-be2a032579d9`, `94da159f-d5ff-4045-b6a6-ade565064ad4`,
  `9a87df14-bf93-4e72-8d8b-4df2c97101aa`, `9d36f878-905f-497c-87e0-d88bcfd55333`,
  `9edbe1e6-fb74-46a7-8dcb-97728ad1dcf0`, `a2ef1d33-a909-47a5-8862-0fcc4797bb23`,
  `b7989c00-8405-4eed-b03e-28958e9147c8`, `bcffe278-f755-4cc6-974e-3b97dc8435cb`,
  `bd085fd4-7558-4ed1-997d-4d9a8f82b054`, `c45f4d05-a7c9-4729-8923-8274099d376a`,
  `c4a4dd69-e931-4fb1-89fb-84864095bb21`, `c792c352-de6a-4125-b90a-5120e0642670`,
  `c980f02f-8b5f-43b7-99f3-c21bffaa0b0f`, `d582674d-de4a-4dfc-be6f-e97f943852b8`,
  `da9adf4c-4720-4a5c-8adc-28113913396b`, `de65e8fb-7a65-422d-a862-c02a35a0649f`,
  `e6f92092-295f-4c4a-a59a-5dcc1772817a`, `e743e64c-b064-4ce1-b7d9-142c9d90539a`,
  `ee880163-62ee-4c2b-9b8f-e5cd44fa36d9`, `ef7cf43e-31ef-46ab-be5e-6ac5a7b2c542`,
  `fadfe63f-f507-4785-a448-c24075c4dc22`, `fce44625-4a23-49b7-825f-a0a8320834a4`,
  `fd256a86-13d2-46a6-a604-c8337cdf9bcf`.
- Exact surviving member-row IDs (`97`):
  `01829e3b-d38e-4a1b-a55e-bc838d49158b`, `0224c72c-c195-47bd-8291-3c49a8c51cad`,
  `02a3a74e-b0bc-4bf8-a431-d99bc1a5c6a3`, `03ca8c70-fd1b-46e3-a29a-441d3a34736e`,
  `047e2242-5c60-4219-ba14-33e905afa07a`, `063872fd-22fd-4a25-b465-b1eb93e082d2`,
  `0729d836-f120-409e-aed0-432415e17954`, `0aa9c433-809a-4c57-b7d2-bcd3c75c37e9`,
  `15cc0b0a-a4c7-4bcc-b045-c877d8dcab96`, `16d41b04-4568-45de-b012-6009b88a3ef0`,
  `17462cdc-d18b-4bae-90f8-f5ce124b9ff1`, `186dcbac-2579-486a-8f41-b221ded10c8d`,
  `1a3da4a9-8376-446e-a440-76b0734983d7`, `2038838d-ca3a-483f-ae4c-27a58420c813`,
  `20613a90-8cfa-426f-a38a-b0e24a4446db`, `224c24b0-f25a-4acc-bbee-6058efa4c95b`,
  `227ec28c-57a3-4adf-8f33-04d5acc91b72`, `229707d1-3081-4ec9-901d-05bf55adc3fe`,
  `267ad715-e9b8-4824-862d-83d65910950e`, `272d0b8e-5988-4f7e-b032-51566bf52dd2`,
  `2742dbcf-84ae-4599-8aa6-a876cf457506`, `2af4490e-6b91-45b7-b0b0-2231a1b576fb`,
  `2b82673f-76b0-456c-91d3-3f68d0f15055`, `34384dc6-c649-43e2-8c81-a6436864d5b2`,
  `34fc4601-bf24-4df8-b015-06336b86a6fb`, `35d07e7a-67cd-42e3-a482-a9c1784f92f8`,
  `36b1e8d1-a320-4c20-8755-8fbba678d202`, `377d0dce-de9c-43ca-af38-0f6b9cc24ffd`,
  `37c1d214-1325-47ba-b376-14a75b3e71bd`, `3cd4f3de-7432-4855-8f69-1e78d7cb5f8b`,
  `3d50d443-e57f-458c-abd5-9e33caeced7f`, `3dbb7014-b521-49b1-9f57-e495ce5b0efe`,
  `40e26c18-cf12-41d4-ad47-754bc5316d67`, `442f6efb-4223-4880-a6a8-0397ec8686ba`,
  `46d69d0c-6b81-4e62-8c25-552615c2ef31`, `4a9d96f5-6339-4a4a-9ed3-e5fd718a0406`,
  `4b1e7dee-6e00-41d5-b5b4-32515bac9ffc`, `4eb39b54-7b14-4e18-9931-66d3b1dcb36b`,
  `4f91faf2-a1b8-4b49-bcb1-9a1e4625166b`, `558486ab-3176-4db9-813f-4ae63d558b81`,
  `59390d97-18f7-45b2-85ac-cc443f0c0927`, `5a070183-bc0a-4e88-b914-53b259ebaaa1`,
  `5a845d17-2e5f-4736-906f-9c6fecc94dbe`, `5c973e97-c2af-409e-8c9f-19cc901e3ac7`,
  `5d61aa0c-eb4d-489b-a3c0-cdb353d3deb6`, `5e49656d-7360-4463-8d52-ebf9cd3511be`,
  `5fb5ecb8-9b0a-4874-9e43-22365b289463`, `6137f87a-31f0-4dac-9d7f-6ff190b6fcac`,
  `6579f0c3-c36c-45e8-8d21-a74bcdca3e19`, `6691402d-8f08-44f4-9609-4e9e985833ac`,
  `68b7a21e-8b42-4b42-966d-e8fb40663155`, `6ac90dd6-acf0-4390-b234-37dc0348cc95`,
  `71b87ea8-0947-4768-ba51-39b3b1dd99c5`, `71ed8252-d7fc-4a08-8bc6-d7dc539a0d51`,
  `735b87a0-b7fd-4784-853c-e62b3698663e`, `776115f2-fb88-4a2d-bff2-154067fa08f6`,
  `79f84999-5c84-47b6-8da7-98da79951e7d`, `7d45050f-1e2f-4ce2-8a3a-09b4c4508583`,
  `7eabbf19-20ab-4b8c-adfd-f5dc70ab9303`, `8311fb9b-28ec-431e-a896-4093b76245c5`,
  `8615f9d8-6e87-4ea5-bd08-2d1143d838d3`, `8adb39a5-dfc8-4bf9-bb52-4d4deedde760`,
  `8ce00005-b5fa-4aec-9ab5-ffb7a3e665ad`, `91a5c3c3-f788-4bf3-ad54-1d5da1e7ad17`,
  `939dea14-1991-4795-9822-20d97ece6265`, `a733ac50-25d0-465b-aeb4-a7c8bcb95ecf`,
  `a8115ca1-eaf6-4062-883b-4ff3dab83064`, `a8fb30d0-454e-4bd4-ae60-b8eb6959f1ae`,
  `b02fd160-42d1-4227-9493-fc00298beada`, `b069a0ec-3830-451e-9469-64cca66c9a90`,
  `b2afa0c7-b7c9-427c-b686-a2d140c84348`, `c239aed7-8dab-40a9-8781-2b6672db0287`,
  `c3cb066b-fffa-4a83-adc9-46412b4062d9`, `c4f8c205-e276-4ba3-ade1-8c56cd2eca6d`,
  `c666da02-46f5-4aa2-a17d-5e8e99a6e750`, `c750f2c7-3928-4444-9f74-7e13480e4a30`,
  `c96198cc-adf9-46ce-9ebc-e46c273133bd`, `cd02fbe6-60d2-421c-b522-50ce516529ea`,
  `d36704c5-db7d-4eac-994b-36d3b8c71887`, `d47dfea9-237a-4959-9a1c-9bc1841e5df0`,
  `d506b04e-980e-407c-b99f-7b1577d5dd01`, `d5fd230e-ae00-4419-b999-36e8bb4e4011`,
  `d68b214a-0c26-4ec8-945b-3a4a348961e6`, `dc950cde-a0a0-42d3-9d41-9c15ff494e4b`,
  `ddbb665a-ffff-4a1e-bf8b-5ba602d0eb1b`, `df4d31bd-1dad-4082-b91e-530ec3710f5d`,
  `e14b51ed-e454-47d2-a946-33f5b63232eb`, `e54b0563-5e6f-4fe9-a81e-595d6375bc43`,
  `e8ae21d6-fa0a-4d4d-af6f-ac52079e2c18`, `e9705dd0-1bb3-4372-b519-93772ba04c24`,
  `e9e8d0de-c0de-4af0-978f-885b8dc58fd1`, `ec9fa697-13c0-4831-a556-9e49c1a2afa9`,
  `ef8441fb-1036-471a-bdee-8312748d06ee`, `f387db49-b775-4581-80d9-7ab79f086f85`,
  `f57002e4-763c-4da3-b831-e0d9bd524cc3`, `f5f6d149-7501-4b9d-ac2c-fadec1cfbb5c`,
  `f93ee351-d4b8-4d2c-bd29-34665aa4ff70`.
- Exact surviving legacy-row IDs (`50`):
  `04705b4f-9209-4579-aa9a-4c6e4d6680d0`, `058336da-6529-470c-a9d5-d3d53c6a6070`,
  `062e024e-38a7-46d6-b124-c552cbf52525`, `0724af16-5f34-4378-a148-a9bd28935591`,
  `0c8ad94e-a3a6-4e60-bd56-4c9a83c98b91`, `0ec52a89-dc72-428d-9c55-0595ded23d5a`,
  `1339e0bb-c828-4532-976d-80352cad9cc1`, `1546a0c3-442a-438f-b52e-6c055c235db2`,
  `18313ce5-e04d-4d9a-bb23-d31d448817cf`, `1f7c2f7c-e94c-46de-a595-5eaf51c574a6`,
  `2006899f-c661-4532-b4d8-bfe9a3acebc3`, `2334cfa8-21f0-4ecf-9e69-bf88266aba88`,
  `23bfa3d4-3643-49ec-8670-f966e13c4dfa`, `27f4d402-0947-4169-bdf7-66bec2f8d598`,
  `29b19ab4-1be6-4bb2-9f50-b8a428db8c10`, `2c2df60b-2de9-41dd-8810-c9749b498ab5`,
  `320d7d24-0d7e-4281-ab91-14334c9a457c`, `3303d05a-6c58-4dc0-8699-c7ec450639c2`,
  `3493e326-ecf9-4d8b-91ff-74a0c0db5f55`, `38d4516d-a4ae-4240-98d3-3e204fcc94a9`,
  `39398fa5-1e01-4069-946a-2f302bf8cec1`, `411d1528-9593-45db-809f-b1ae8d84e238`,
  `43315187-b1f9-49bb-9a10-8dc64caa9118`, `559634b0-2384-4450-b92f-008fdb25b95c`,
  `574cc46d-e6a8-4896-8c6e-c74b089c47dd`, `58640154-b700-490d-a2f1-5b3b515a8163`,
  `5a86f54e-25c7-4640-bebf-6719f1339b9a`, `69c1c123-af72-4740-818d-6cda79def236`,
  `72d4fbce-3dbe-401e-88e2-7889bae90bfc`, `79ad3a82-4d7c-4088-8a36-de4ce1e135c3`,
  `81410e60-ab09-447a-8e02-0599c86289d1`, `8e77edce-5b85-4688-a375-0c5ab06116fc`,
  `95e6ea56-e8ec-4cde-9c0a-0fbaf14ab2db`, `97cefe9f-a10b-4bc3-b882-a1e68fa27cac`,
  `983545a1-6b03-4380-9138-c5746d5f3498`, `98b47832-ef35-479c-82a6-aa755bc2e05f`,
  `a15df721-f2ba-4d27-a877-25bf7a02ed96`, `a2e8647a-00ae-4d50-b4a1-b55402664681`,
  `a82c5451-2c75-4b7b-8b32-46aba50e57a2`, `bcfddd28-28dd-4c8c-a7dd-d9cd174d967a`,
  `bef5f11e-f73e-46df-b411-d3f9e0711856`, `c8abbaac-86ba-4e42-982a-ec0c440ad561`,
  `cf2ce0be-35d2-4912-bd8b-7577a01668f7`, `e0be897b-680a-4aa7-9338-1242c122a23c`,
  `e5e23c71-d2c4-4ec9-a62b-bee9fde1f6ea`, `e67d9b68-bd89-4831-bd84-7d28ec897a8a`,
  `ef521638-0acf-4fba-a95c-279895e5f708`, `f0c154e8-8900-48f2-9dab-dd6591132661`,
  `f2f19497-ac61-49e3-9edb-2f0908a52811`, `f32afb67-dbc3-410a-9690-7bf6f17fd7a3`.
- Exact reservation row key is `group_id`; there are `50`, equal to the coach-
  bearing subset of the exact `55` group IDs above. The five unreserved groups are
  `0ce9dab5-bb62-496f-a485-aae50cbad2a9`,
  `1075cccd-227e-4b49-a8c8-d7162f88ff3b`,
  `42b4dcea-478e-47f3-bc85-10b22b1cb0f6`,
  `54a46a53-e115-4084-a624-727accc2e8bd`, and
  `9edbe1e6-fb74-46a7-8dcb-97728ad1dcf0` because their current exact group has no
  coach.
- No Source, migration, environment, feature flag, allowlist, attendance,
  check-in, teaching-hours, payroll, payment, wallet, or finance write occurred in
  the rollback round. Financial impact is **None**. The incident assignment rows
  remain untouched pending Owner review. New Source Production UAT is **Failed
  from real operations evidence**; Task Done is **No**. Next Gate requires
  separate approval for read-only Source diagnosis, followed by separate decisions
  for any forward fix or exact-row data repair.

## 2026-07-18 — Emergency Coach Assignment Write Containment

State observed at this containment closeout on 2026-07-18:

- Owner authorized only a minimal emergency write lock based on restored
  Production Source `0226e363f6677b078430f93459c2ee2ede6484e8`. Migration
  `20260717070225`, business data, attendance/check-in, teaching hours/payroll,
  payment/wallet/finance, environment, feature flags, allowlists, and the 3
  confirmed damaged slots were not changed or repaired.
- Scoped containment Source commit
  `3ad8a52dbda95b645608bce2f05917824e9763a6` was created and pushed non-force on
  `codex/emergency-coach-assignment-containment-20260718`. It changes only:
  `src/app/api/coach/assignment-groups/route.ts`,
  `src/app/api/admin/makeup/route.ts`,
  `src/lib/coach-assignment-write-containment.ts`, and
  `scripts/check-coach-assignment-write-containment.mjs`. Pre-existing dirty
  `AGENTS.md`, `src/lib/schedule-slot-utils.ts`, and `docs/performance/` were not
  staged, overwritten, or included.
- `POST /api/coach/assignment-groups` preserves authentication, Head Coach role,
  branch authorization, slot/branch validation, and the existing past-round lock,
  then returns `503` with code
  `COACH_ASSIGNMENT_SAVE_TEMPORARILY_DISABLED` before any group/member/legacy
  mutation. Admin Makeup preserves `requireAdminMenuAccess('makeup')` and returns
  the same `503` before the four approved exact-assignment actions. Generic
  `mark_attendance` is blocked only when no exact coach exists and the action would
  create a retrospective exact group; unrelated Makeup actions remain available.
- Local verification passed: containment checks `7/7`, existing Admin Schedules
  assignment checks `12/12`, TypeScript, full ESLint with zero warnings, mojibake
  `231`, `git diff --check`, Production Build `91/91`, and post-build clean restart.
  Local `/`, `/api/health`, and `/_next/static/css/app/layout.css` returned `200`;
  anonymous Head Coach POST and Admin Makeup PATCH remained `401`. Read-only route
  Source was not changed.
- Production deployment `dpl_HTeRJnDLS5Z5ayEPGUvT2E4RGxti` reached Ready and was
  promoted. All four established aliases point to its deployment URL
  `new-athlete-badminton-school-cuqr5a2km-aachanin1s-projects.vercel.app`. `/`,
  `/api/health`, and generated static asset
  `/_next/static/css/866485655583332e.css` returned `200`.
- Authenticated Head Coach page rendering remained available with `36/39` assigned,
  `3` unassigned, and `135` learners. One Owner-authorized no-write containment
  check returned `503`; Vercel request log
  `jl2h8-1784356901567-cd2150f1cfc2` records the exact Production POST at
  `2026-07-18T06:41:41.567Z`. The Thai temporary-lock message was visible and the
  browser console had no warning/error. No Save was expected or allowed to succeed.
- Fresh protected Production totals and MD5 fingerprints matched before and after
  the containment check: groups `1022` /
  `36ff11873681dd9b550d8bfe61b078d9`; members `2426` /
  `ad6abedcd22ded678b45a42695cb03f8`; legacy assignments `996` /
  `649a57dd7cc12a2928e053243bb647e3`; reservations `230` /
  `182ea9769ece1c3deca0b4624351da41`. Successful
  `save_coach_assignment_groups` activity rows after containment activation were
  `0`.
- Migration history still contains `20260717070225` exactly once. The latest
  `coach_assignment_exact_group_name_check` database error in the inspected log
  occurred at `2026-07-18T06:24:04.104Z`, before containment activation; no new
  occurrence appeared after activation. The database migration was not rolled back.
- The prior `51` successful incident-window Saves across `47` slots remain broader
  investigation evidence; they do not prove all 47 slots are damaged. Confirmed
  damaged slots are `3`. Data Repaired is **No** for this containment round. Exact
  evidence and separate Owner approval are required before any repair.
- Production UAT for regression Source `1b995396...` remains **Failed**. Production
  Write Containment is **Active**. Production business data changed **No** in this
  round. Financial impact is **None**. Customer impact is that read-only assignment
  pages remain available, while Head Coach/Admin Makeup exact-assignment writes are
  intentionally blocked to prevent further loss. Task Done is **No**.
- Next action: correct the forward Source fix locally, then request exact evidence
  and separate Owner approval for each of the 3 damaged-slot repairs. Do not repair
  Production data, re-enable writes, roll back the migration, or start a Parking
  Lot task automatically.

## 2026-07-18 — Coach Assignment Forward Source Fix Local/Publish Gate

State observed at this local/publish closeout on 2026-07-18:

- Owner authorized a correct forward Source from exact parent
  `1b995396f432d11b133c1cf4b5604b6db875b63b`, Local verification, and scoped
  commit/push only. Deploy, Production containment removal, Production write/UAT,
  migration change, and repair of the 3 confirmed damaged slots were prohibited.
- Two release interactions caused the incident. Regression Source `1b995396...`
  classified some persisted exact-coach groups through placeholder/name-derived
  draft state and auto-split/blocked mixed or wide Level groups, causing real Head
  Coach assignment visibility and grouping failures. After rollback, restored old
  Source `0226e363...` still used separate group/member/legacy DML and could submit
  a stored `(N คน)` name against the already-active new check constraint; a later
  insert failure could therefore follow earlier committed deletion. The forward
  fix combines the applied atomic RPC contract with corrected classification and
  naming semantics.
- Forward Source/Test commit
  `c70f5a4ab92e8c3d33beb036e494d85e6e9bc0f9`, tree
  `0fecabd92e2f2c65b7bd59227b8d6b743e6bd820`, was created directly on parent
  `1b995396f432d11b133c1cf4b5604b6db875b63b` and pushed non-force to
  `codex/coach-assignment-forward-fix-20260718`; local/remote ahead/behind is
  `0/0`.
- Changed Source/Test files were:
  `src/lib/admin-schedule-assignment-state.ts`,
  `src/lib/coach-assignment-group-naming.ts`,
  `src/lib/coach-assignment-atomic-save.ts`,
  `src/components/coach/assign-groups-client.tsx`,
  `src/app/api/admin/makeup/route.ts`,
  `scripts/check-admin-schedule-assignment-state.mjs`,
  `scripts/check-coach-assignment-conflicts.mjs`,
  `tests/admin-schedule-assignment/admin-schedule-assignment.spec.ts`, and
  `tests/booking-regression/local-supabase.ts`. No migration file changed.
- Existing valid exact `coach_id` is now authoritative even when the persisted name
  is blank, `ยังไม่จัดกลุ่ม`, or has a legacy member-count suffix. No exact coach
  means unassigned; suggested coach remains non-exact. Mixed/wide Level is warning-
  only. Blank/placeholder auto-names use the active Level program for one shared
  category, `กลุ่มผสม` for mixed/incomplete combinations, and `ยังไม่ประเมิน` when
  all members are unassessed. Valid manual names are preserved, and `(N คน)` is
  removed from stored names while UI count remains membership-derived.
- Normal Head Coach Save already uses `save_coach_assignment_groups_v1`. All five
  Production-active Admin Makeup exact-assignment paths now load the current slot
  snapshot and invoke that same RPC exactly once for group/member/legacy/
  reservation all-or-nothing behavior. Constraint and invalid-member simulations
  proved byte-for-byte-equivalent logical fingerprints across all four protected
  sets before/after failure; concurrent conflict allowed one winner only and left
  fixture residue `0`.
- Local verification passed: assignment/naming/authorization checks `30/30`;
  database conflict/backfill/concurrency/lifecycle checks `22/22` with residue `0`;
  authenticated Playwright desktop/mobile `3/3` with fixture residue `0` and no
  console/page/hydration error; Lesson Wallet regression `17/17`; TypeScript;
  ESLint with zero warnings; mojibake `234`; `git diff --check`; Production Build
  `91/91`; and post-build clean restart with `/`, `/api/health`, and generated
  static asset all `200`.
- Local migration verification reset/applied through `20260717070225`, rolled back
  only the last migration to `20260715060541`, and re-applied only
  `20260717070225`; final local conflict suite remained `22/22`. The committed
  migration blob checksum remains
  `2124C57725AA8891BD456927C37530F180019B8C0710EE73E6E9717174926EF8`.
- Fresh read-only Production verification found containment deployment
  `dpl_HTeRJnDLS5Z5ayEPGUvT2E4RGxti` Ready on all four established aliases; `/`,
  `/api/health`, and static asset returned `200`. Migration `20260717070225`
  remains applied exactly once. Protected counts remain groups `1022`, members
  `2426`, legacy assignments `996`, reservations `230`; successful assignment
  Save activity after containment activation remains `0`.
- Production Write Containment is **Active**. Forward Source Deployed is **No**.
  Production UAT for the forward Source is **No**; the earlier regression Source
  UAT remains **Failed**. Production business data changed **No** in this round.
  Data Repaired is **No**; confirmed damaged slots remain `3`. Financial impact is
  **None**. Task Done is **No**.
- Direct deployment of exact commit `c70f5a4...` inherently removes the temporary
  `503` containment because the commit is based on `1b995396...` and intentionally
  contains the forward behavior rather than the containment patch. Therefore the
  next gate must explicitly approve direct deploy plus write re-enable and bounded
  Production UAT together. If Owner instead requires the `503` lock to remain
  during deployment, a separate containment-on-forward integration Source change
  must be authorized and tested first. In either plan, current containment
  deployment `dpl_HTeRJnDLS5Z5ayEPGUvT2E4RGxti` is the proposed Source rollback
  target and database migration `20260717070225` must remain applied. Damaged-slot
  repair remains a separate evidence/approval gate.

## 2026-07-18 — Coach Assignment Dark Canary Read-Only Gate

State observed at this unpromoted Canary checkpoint on 2026-07-18:

- Owner confirmed the Head Coach operations freeze and authorized preflight,
  Production-target dark deployment without alias promotion, and authenticated
  read-only Canary UAT only. Controlled Write, alias promotion, containment
  removal, damaged-slot repair, Source change, and migration change remained
  prohibited.
- Fresh preflight confirmed exact forward commit
  `c70f5a4ab92e8c3d33beb036e494d85e6e9bc0f9`, tree
  `0fecabd92e2f2c65b7bd59227b8d6b743e6bd820`; migration
  `20260717070225` applied exactly once; current/future blocking conflicts `0`;
  successful assignment Save activity after containment `0`; and protected totals
  groups `1022`, members `2426`, legacy `996`, reservations `230`.
- A clean detached worktree produced Ready Production-target deployment
  `dpl_CeoUkkLs2pSvcuLBzzdVNXn3dygD` using the verified Vercel
  `--prod --skip-domain` flow. Its unique URL returned `200` for `/`,
  `/api/health`, and generated static CSS. No alias was promoted: all four
  Production aliases remain Ready on containment deployment
  `dpl_HTeRJnDLS5Z5ayEPGUvT2E4RGxti`.
- Authenticated Head Coach read-only checks confirmed persisted exact coaches
  remain selected; old `(N คน)` suffixes are removed from displayed group names;
  member counts are membership-derived; no-coach groups remain unassigned;
  suggested coaches remain non-exact; mixed/wide Level remains warning-only;
  manual names remain intact; and the blank mixed draft preview is `กลุ่มผสม`.
  Desktop and 390x844 mobile layout were usable without the Level warning covering
  controls. Coach Attendance, Teaching Programs, Lesson Wallet, and Head Coach
  role guarding rendered their expected data/authorization behavior.
- The first Head Coach navigation to `/admin/schedules` redirected correctly to
  `/coach` but produced one client React hydration error `#418`. A fresh Canary
  reproduction of the same guard and a containment Production baseline were clean.
  Canary runtime log queries returned no error/fatal/5xx. Because the approved gate
  explicitly requires zero console/page/hydration errors, read-only Canary UAT is
  **Not passed** and the Controlled Write/promotion gate was not opened.
- Pre/post read-only fingerprints were identical: groups
  `36ff11873681dd9b550d8bfe61b078d9`, members
  `ad6abedcd22ded678b45a42695cb03f8`, legacy
  `649a57dd7cc12a2928e053243bb647e3`, and reservation semantic fingerprint
  `3969e246d4ace794ca6562727fa8e80e`. No assignment activity row was created;
  Production business data and financial data changed **No/No**.
- Production Write Containment remains **Active**; forward Source Production-active
  is **No**; Controlled Write UAT is **Not run**; alias promotion is **No**; Data
  Repaired is **No**; confirmed damaged slots remain `3`; Task Done is **No**.
  Next Gate is Owner review and separate authorization for read-only
  diagnosis/retest of the single non-reproducible hydration signal. Exact payload
  collection, write UAT, promotion, containment removal, and repairs remain closed.

### Hydration `#418` bounded read-only diagnosis and deterministic retest

State observed at this bounded retest closeout on 2026-07-18:

- The original observation remains preserved: at
  `2026-07-18T09:25:12.810Z`, the first Head Coach navigation to Canary
  `/admin/schedules` redirected correctly to `/coach` and produced one minified
  React hydration `#418`. Its stack was confined to the shared React runtime chunk
  `/_next/static/chunks/4bd1b696-e356ca5ba0218e27.js`; no stack frame attributed
  the signal to a file changed between `1b995396...` and `c70f5a4...`.
- Owner authorized read-only diagnosis/retest only. Production aliases stayed
  `4/4` on Ready containment `dpl_HTeRJnDLS5Z5ayEPGUvT2E4RGxti`; Ready Canary
  `dpl_CeoUkkLs2pSvcuLBzzdVNXn3dygD` remained unpromoted. No Save, mutation,
  Controlled Write, Source change, containment removal, repair, or promotion was
  performed.
- Deterministic client results were clean on both environments: direct `/coach`
  `5/5`, hard reload `/coach` `5/5`, `/admin/schedules` guard redirect `10/10`,
  mobile 390x844 guard redirect `5/5`, and fresh login to `/coach` `3/3` per
  environment. Across `56/56` cycles, React `#418`, hydration, console
  warning/error, page error, and redirect loop counts were `0`.
- Canary assignment read-only regression checks also passed: persisted exact
  coach assignments remained assigned; no-coach groups remained unassigned;
  suggested coaches remained non-exact; blank mixed draft naming rendered
  `กลุ่มผสม`; wide/mixed Level remained warning-only; valid manual names remained;
  legacy `(N คน)` suffixes were removed from display; live member counts were used;
  and desktop/mobile rendering had no page/console/hydration error. Save was not
  clicked.
- The original `#418` is classified **Unknown / Non-reproducible**. The required
  clean label `NON-REPRODUCIBLE TRANSIENT OBSERVATION — BOUNDED RETEST CLEAN` was
  not used because a distinct containment runtime error occurred during the
  authorized fresh-login cycles.
- At `2026-07-18T10:06:40.831Z` (`17:06:40` Bangkok), containment middleware logged
  one `AuthApiError: Invalid Refresh Token: Refresh Token Not Found` for `GET /`;
  the HTTP response was `200`. Canary runtime error/fatal/5xx was `0/0/0`;
  containment fatal/5xx was `0/0`, but error was `1`. This signal occurred on the
  containment deployment only and is not attribution to the forward assignment
  diff, but the explicit runtime-error `0` pass condition means the overall gate
  remains **Not passed**.
- Post-checks found groups `1022` /
  `36ff11873681dd9b550d8bfe61b078d9`, members `2426` /
  `ad6abedcd22ded678b45a42695cb03f8`, legacy `996` /
  `649a57dd7cc12a2928e053243bb647e3`, reservations `230`, migration
  `20260717070225` exactly once, and successful assignment Saves after containment
  `0`. All `230/230` reservation business rows matched exact group/coach/slot/date/
  time source fields with mismatch `0`. One reservation `updated_at` changed after
  normal real-world coach check-in and three attendance writes for slot
  `ab042e90-d93c-46c5-9e2b-74e129abaf5e`; the reservation business fields did not
  change and the retest did not perform those operations.
- Current result: Containment Active **Yes**; alias promotion **No**; Controlled
  Write UAT **Not run**; Production business data changed by this retest **No**;
  damaged slots `3`; Task Done **No**. Next Gate is Owner review of the distinct
  containment auth-session error. Controlled Write payload collection, promotion,
  containment removal, Source change, and data repair remain closed.

### Owner decision — accept Containment auth baseline and reopen Canary gate

State confirmed by Owner after reviewing the bounded retest evidence on
2026-07-18:

- The single Containment-only
  `AuthApiError: Invalid Refresh Token: Refresh Token Not Found` is classified
  **ACCEPTED NON-BLOCKING CONTAINMENT AUTH-SESSION BASELINE**. The evidence remains
  preserved; it must not be rewritten as though it never occurred. It did not
  occur on Forward Canary, did not fail login or the HTTP request, and is unrelated
  to the Coach Assignment files in `c70f5a4...`.
- Owner confirms this baseline is not a blocker for the Coach Assignment release.
  Any auth-session investigation is a separate follow-up and is not authorized to
  start automatically.
- Forward Canary read-only UAT is **Passed** based on `56/56` clean client cycles,
  hydration/React `#418`/console/page/redirect errors `0`, Canary runtime
  error/fatal/5xx `0/0/0`, read-only assignment semantics passing, and protected
  business fingerprints unchanged. Original React `#418` remains **Unknown /
  Non-reproducible after clean bounded retest**.
- Production aliases remain `4/4` on containment
  `dpl_HTeRJnDLS5Z5ayEPGUvT2E4RGxti`; dark Canary
  `dpl_CeoUkkLs2pSvcuLBzzdVNXn3dygD` remains Ready and unpromoted. Controlled Write
  UAT is **Not run**; Production business data changed by this decision **No**;
  damaged slots remain `3`; Task Done is **No**.
- Next Gate is exact Owner/Head Coach confirmation of one damaged-slot payload:
  slot ID, date/time/branch, every learner in the round, each learner's group,
  group names, exact coach per group, and learners who must remain unassigned.
  Codex must not infer this payload from activity logs or incomplete screenshots.
  No Production write, alias promotion, containment removal, damaged-slot repair,
  Source change, auth follow-up, or Parking Lot task is authorized by this decision.

### Controlled Write UAT — atomic save succeeded, manual-name preservation failed

State observed at this controlled dark-Canary checkpoint on 2026-07-18:

- Owner/Head Coach confirmed slot `53c3556a-6067-4ad1-813c-ca8410d17994`,
  2026-07-21 17:00-19:00 Chaeng Watthana, with two exact groups and five active
  learners. Confirmed manual names were `ระดับสูง` for Coach
  `20b2f808-e6a5-4e9f-ae95-3cc6561e0fde` with three learners and `กลาง-สูง` for
  Coach `95bf2081-e9f9-4aa1-883c-7294d2b8ce33` with two learners; no learner was
  to remain unassigned.
- Fresh pre-write state was target groups/members/legacy/reservations `0/0/0/0`;
  global totals `1022/2426/996/230`; both coaches had exact conflicts `0` and
  legacy warnings `0`; successful assignment Saves after containment were `0`.
  The Owner/Head Coach clicked Save exactly once through dark Canary
  `dpl_CeoUkkLs2pSvcuLBzzdVNXn3dygD`.
- The atomic write completed at `2026-07-18T10:46:16.416897Z`. It created exact
  groups `c56af2cf-d9da-464b-a1c6-602709eab7c1` and
  `ec77cf98-8768-4181-865d-ccad7befabc8`; five exact member rows; legacy rows
  `fc730760-e1f8-49c1-a832-9d3c424bdfa1` and
  `19b19c1a-b299-494c-b813-e8c881947a70`; and two matching reservations. Global
  totals became `1024/2431/998/232`. Activity log
  `7eaa3080-adc6-416a-ad8d-1b9e3e657980` records one Save by Head Coach
  `95bf2081-e9f9-4aa1-883c-7294d2b8ce33` with group/student counts `2/5`.
- Atomic safety passed: group/member/legacy/reservation rows are complete; target
  orphan and reservation mismatch counts are `0`; both coaches have no exact
  conflict or legacy warning after self-exclusion; no other assignment row was
  created/updated in the controlled window. Target attendance, check-in, teaching
  program, payment, and wallet fingerprints remained unchanged. Console
  warning/error count was `0`. Financial impact is **None**.
- Manual-name preservation failed. The server stored group `c56af2cf...` as
  `กลุ่มผสม` instead of submitted `ระดับสูง`, and group `ec77cf98...` as
  `ชุดพื้นฐาน` instead of submitted `กลาง-สูง`. The Canary client retained the
  submitted draft after refetch and showed `มีการแก้ไขยังไม่บันทึก`; the apparent
  contradiction is a client draft versus persisted server-name mismatch, not a
  partial database write.
- Read-only Source inspection attributes the failure to
  `src/lib/coach-assignment-group-naming.ts`: `LEGACY_AUTO_GROUP_NAMES` includes
  both `ระดับสูง` and `กลาง-สูง`, so `resolveAssignmentGroupName()` treats the
  submitted labels as auto-generated and derives `กลุ่มผสม` / `ชุดพื้นฐาน`
  before `save_coach_assignment_groups_v1`. No Source change was authorized or
  made in this checkpoint.
- Controlled Write UAT is **Failed**; aliases promoted **No**; containment remains
  active on `dpl_HTeRJnDLS5Z5ayEPGUvT2E4RGxti`; the forward artifact remains dark
  and unpromoted. Production data changed **Yes** by the one Owner/Head
  Coach-controlled Save. Data Repaired remains **No** because persisted names do
  not match the exact approved payload; confirmed damaged slots remain `3`; Task
  Done is **No**.
- Next Gate is Owner review. Separate approval is required for a scoped Local
  Source/Test correction, a new dark artifact/repeat UAT plan, and any exact
  name-only repair of the two groups. Do not retry Save, promote aliases, remove
  containment, repair Production data, or start another task automatically.

## 2026-07-18 — Manual Name Preservation Corrective Canary, Controlled Save, and Promotion

State observed at this corrective release closeout on 2026-07-18:

- Owner authorized a scoped correction from forward parent
  `c70f5a4ab92e8c3d33beb036e494d85e6e9bc0f9`, full Local verification,
  non-force Source/Test publish, an unpromoted Production-target Canary, one
  repeat controlled Save for slot `53c3556a-6067-4ad1-813c-ca8410d17994`, and
  conditional promotion of the exact same artifact. Direct SQL repair, migration
  change, additional Production Saves, and repair of other slots remained out of
  scope.
- Root cause was `LEGACY_AUTO_GROUP_NAMES` in
  `src/lib/coach-assignment-group-naming.ts`: it classified legitimate submitted
  labels `ระดับสูง` and `กลาง-สูง` as generated names, so the server replaced
  them before the atomic RPC. Corrective contract now treats every trimmed,
  non-placeholder name as manual after removing a trailing `(N คน)` suffix.
  Auto-name runs only for blank, exact `ยังไม่จัดกลุ่ม`, or generic `กลุ่ม N`.
- Corrective Source/Test commit
  `9ef1ee30035a083426743aed3e326ad9676d65c4`, tree
  `94fe2410f0361acf639c47a4be7245c01128f21d`, parent
  `c70f5a4ab92e8c3d33beb036e494d85e6e9bc0f9`, was pushed non-force on branch
  `codex/coach-assignment-manual-name-fix-20260718`; ahead/behind was `0/0`.
  Changed files were `src/lib/coach-assignment-group-naming.ts`,
  `scripts/check-admin-schedule-assignment-state.mjs`, and
  `tests/admin-schedule-assignment/admin-schedule-assignment.spec.ts`. Migration,
  API authorization, and client TSX files did not change.
- Local gates passed: assignment/naming/authorization `33/33`; database conflict,
  concurrency, lifecycle, and residue `22/22` / `0`; authenticated Playwright
  desktop/mobile `3/3` with residue `0`; Lesson Wallet regression `17/17`;
  TypeScript; ESLint; mojibake `234`; `git diff --check`; Production Build; and
  post-build clean restart with `/`, `/api/health`, and generated static asset
  `200`. The first clean-restart attempt lacked the ignored local environment in
  the detached worktree; after copying the ignored local env without committing
  it, the same exact Source passed. No secret or environment file entered Git.
- A clean detached worktree created Production-target, unpromoted Canary
  `dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX` with `--prod --skip-domain`. Its unique URL,
  `/api/health`, and generated CSS returned `200`; deployment was Ready. Before
  Controlled Write, all four aliases still pointed to containment
  `dpl_HTeRJnDLS5Z5ayEPGUvT2E4RGxti`.
- Fresh pre-write reconciliation confirmed the target remained exact
  groups/members/legacy/reservations `2/5/2/2`; coaches and learner mapping matched
  the Owner payload; persisted names were still `กลุ่มผสม` and `ชุดพื้นฐาน`; and
  no later assignment mutation had occurred. The Owner/Head Coach changed only
  the two names and clicked Save exactly once through the corrective Canary.
- Activity log `82086719-9171-4170-8f57-7dbc5ca2ba6e` records that single Save by
  Head Coach `95bf2081-e9f9-4aa1-883c-7294d2b8ce33` at
  `2026-07-18T14:48:21.129295Z`. Persisted result:
  - group `66a59351-19f4-41fd-b5f3-1e989b931237`, name `ระดับสูง`, Coach
    `20b2f808-e6a5-4e9f-ae95-3cc6561e0fde`, exact original three learners;
  - group `9757d065-2553-48b0-a4ba-81ceb4b50d2b`, name `กลาง-สูง`, Coach
    `95bf2081-e9f9-4aa1-883c-7294d2b8ce33`, exact original two learners;
  - legacy rows `db2baac1-a2b7-4f56-a4ef-38834e4559e8` and
    `8457aa44-cb0e-426b-9ca1-9e848e58b85e`;
  - two reservations linked to the new exact groups.
- Post-save target counts remained `2/5/2/2`. Exact coach/member mapping was
  unchanged; no partial deletion, orphan, reservation mismatch, conflict,
  unsaved-draft indicator, console error, runtime/500/name-constraint error, or
  change to attendance, check-in, teaching program, teaching hours, payroll,
  payment, wallet, or finance fingerprints was found. Financial impact is
  **None**. Controlled Write UAT is **Passed** and the 2026-07-21 17:00–19:00
  Chaeng Watthana damaged slot is repaired.
- The exact corrective Canary artifact was promoted without rebuild. Deployment
  `dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX` is Ready; all four established Production
  aliases point to it. Public `/`, `/api/health`, and static assets return `200`.
  Authenticated Head Coach read-only rendering shows `ระดับสูง` / `กลาง-สูง`,
  dynamic `3 + 2` counts, assigned state, and no unsaved indicator or console
  error. Post-promotion error/fatal/500/name-constraint log queries returned zero.
  Temporary `503` containment is inactive and normal authorized atomic assignment
  writes are enabled. Rollback was not required; containment
  `dpl_HTeRJnDLS5Z5ayEPGUvT2E4RGxti` remains the rollback target.
- Migration `20260717070225` remains applied exactly once. Immediately after the
  controlled Save, current/future reservation candidates/rows reconciled
  `219/219`; after later live Saves they reconcile `221/221`. Missing, physical
  orphan, and field mismatch are `0/0/0`. Thirteen historical reservations are dated 2026-07-17 and
  were created before the repeat Save; they are not release-created stale rows.
  Before later live Saves, totals were groups `1024`, members `2429`, legacy `998`,
  reservations `232`; early member-count movement outside the target slot was
  traced to ordinary reschedule lifecycle activity.
- Three real Head Coach Saves occurred after promotion and before documentation
  closeout, all by user `5393eb51-46b1-4e15-890f-4dd139fdb78f`:
  - activity `396a890d-94dd-46ad-861c-0bf0f69e4f50`, slot
    `83adbc97-f7f0-4552-8e16-2215097e9eb7`, 2026-07-19 16:00–18:00
    Suvarnabhumi, two groups / nine learners;
  - activity `f243c7f2-8210-4ad7-ad41-02a265b69217`, slot
    `316c9e10-e05f-48f0-973e-04ea429a65dc`, 2026-07-22 15:00–17:00
    Suvarnabhumi, group `bf8284a1-352b-4bf6-8e78-817ba91f88ff` named `กลุ่มผสม`,
    Coach `61b94e69-b1d9-4342-91e8-e40b3015ea36`, three learners;
  - activity `11e5d7f4-3b2c-4be9-a6ee-8888d3be1d0f`, slot
    `d62b0bba-c9b9-4e0a-a6c1-d54ce7c73887`, 2026-07-29 15:00–17:00
    Suvarnabhumi, group `bc89970f-2b8b-4d82-b53f-bc0eccc94411` named `กลุ่มผสม`,
    Coach `61b94e69-b1d9-4342-91e8-e40b3015ea36`, three learners.
  Each affected slot has group/member/legacy/reservation completeness, and no
  post-promotion runtime/500/name-constraint error was found. Fresh totals became
  `1026/2436/1000/234`. The two previously damaged slots have technically complete
  data, but because their exact intended payloads were not supplied to Codex before
  the live Saves, repair correctness is **Unknown / Need Owner confirmation**.
- Current status: Source Complete **Yes**; Tests Passed **Yes**; Committed/Pushed
  **Yes**; Deployed/Production Active **Yes**; Forward Production UAT and
  Controlled Write UAT **Passed**; Data Repaired **Yes for the 21 July slot**;
  Production Data Changed **Yes by Owner/Head Coach controlled Saves only**;
  Financial Impact **None**; Task Done **No**. The 2026-07-22 and 2026-07-29
  Suvarnabhumi payloads remain pending Owner confirmation.
- Next Gate: Owner/Head Coach must confirm whether the two actual post-promotion
  payloads are intended. If confirmed, close them after read-only reconciliation;
  otherwise request separate exact corrective approval. Do not infer payloads,
  send another Save, use direct SQL,
  start the separate auth-session follow-up, or start another task automatically.

## 2026-07-18 — Owner Confirmation and Final Damaged-Slot Closeout

State observed at this final read-only closeout on 2026-07-18:

- Owner confirmed that the actual post-promotion payloads saved by Head Coach for
  2026-07-22 and 2026-07-29 Suvarnabhumi are correct. This confirmation changes
  status only; Codex sent no Save or mutation and changed no Production data.
- Fresh read-only reconciliation remained exact:
  - 2026-07-22 slot `316c9e10-e05f-48f0-973e-04ea429a65dc`, 15:00–17:00,
    group `bf8284a1-352b-4bf6-8e78-817ba91f88ff`, name `กลุ่มผสม`, Coach
    `61b94e69-b1d9-4342-91e8-e40b3015ea36`, booking-session members
    `686f6563-a655-45d3-899d-dbdee6f9b287`,
    `7de8af7f-a114-49e7-89b3-a0b3ae1315be`, and
    `89adc1f4-57dc-43f1-b5a2-329cc1638b8d`; counts `1/3/1/1`.
  - 2026-07-29 slot `d62b0bba-c9b9-4e0a-a6c1-d54ce7c73887`, 15:00–17:00,
    group `bc89970f-2b8b-4d82-b53f-bc0eccc94411`, name `กลุ่มผสม`, Coach
    `61b94e69-b1d9-4342-91e8-e40b3015ea36`, booking-session members
    `413c5fe2-4a64-48ca-a8f7-8a500a82a0ba`,
    `e4c67b10-5883-4b0b-86bb-e424f7aed6e5`, and
    `ef5210a7-156f-421f-9794-022af773fe53`; counts `1/3/1/1`.
- Matching successful activity rows remain
  `f243c7f2-8210-4ad7-ad41-02a265b69217` and
  `11e5d7f4-3b2c-4be9-a6ee-8888d3be1d0f`, both by Head Coach
  `5393eb51-46b1-4e15-890f-4dd139fdb78f`. Global protected totals remain groups
  `1026`, members `2436`, legacy `1000`, reservations `234`.
- Production deployment `dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX` remains Ready on all
  four established aliases. Corrective Source, atomic RPC, and reservation
  protection remain Production-active; migration `20260717070225` remains applied
  once. No rollback, Source, migration, environment, feature, allowlist, attendance,
  check-in, teaching-hours, payroll, payment, wallet, or financial change occurred
  in this confirmation round.
- Final result for the confirmed scope: all three damaged slots are repaired and
  Owner-confirmed; Source Complete **Yes**; Tests Passed **Yes**;
  Committed/Pushed/Deployed/Production Active **Yes**; Production UAT and
  Controlled Write UAT **Passed**; Data Repaired **Yes**; Financial Impact
  **None**; Customer Impact **Resolved**; Task Done **Yes**.
- Active Task is **NONE**. Next Action is to await Owner selection. The separate
  containment auth-session baseline, broader historical incident population,
  permanent dirty `AGENTS.md` work, and Parking Lot tasks remain unauthorized and
  must not start automatically.

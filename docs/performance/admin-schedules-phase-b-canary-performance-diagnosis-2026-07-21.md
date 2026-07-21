# Admin Schedules Performance Phase B — Canary Performance Diagnosis

Date: 2026-07-21
Authorization: Owner-approved read-only Canary diagnosis and documentation only

## Executive result

The Phase B Canary is functionally correct but did not pass the performance gate.
It remains unpromoted.

- Canary deployment: `dpl_5x2vzwUxAmxNaT8HZGJeBQ32JVr4`
- Exact Canary commit: `b0bada3d076302d24ebe3b594c03b22bf0997869`
- Functional Source commit: `3d32401b13873592d5462e6776b0e847335d2d43`
- Branch: `spike/next-major-security-upgrade`
- Canary status during this audit: `READY`, Production target, no Production/custom
  alias rows assigned; Vercel automatic deployment aliases do not represent promotion
- Existing Production deployment: `dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX`
- Production aliases: all four remained on the existing Production deployment
- Functional Super Admin Canary UAT: passed
- Performance gate: failed
- Promotion, new deploy, rollback, migration, config change, and Production write: none

The dominant proven pattern is multiple dependent Supabase Data API round trips,
including two session pages and five assignment-group chunks for July 2026. The
Vercel functions execute in `iad1`, while the Supabase project is in
`ap-northeast-2`. Bounded query plans complete in milliseconds and use cached
buffers; no single bounded core SQL plan explains the observed multi-second route
latency. Cross-region round-trip cost is therefore a credible amplifier, but its
exact per-call RTT was not directly available in the retained telemetry.

## Method and safety

The audit started from existing telemetry before creating traffic. It used Vercel
deployment/project metadata, a bounded 100-entry Canary runtime-log snapshot,
Supabase API/Postgres log snapshots, aggregate SQL `SELECT`, index/statistics
metadata, three non-executing `EXPLAIN` plans, and six bounded `EXPLAIN ANALYZE`
plans. Every analyzed query ran with the equivalent safety envelope:

```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) <bounded SELECT>;
ROLLBACK;
```

The SQL audit made 12 metadata/aggregate `SELECT` attempts: 11 succeeded and one
read-only schema lookup failed before the already-installed extension schema was
located. It made three estimated plans and six analyzed plans. No statement timed
out. No extension was enabled and no statistics were reset.

No new authenticated browser sample was added during this diagnosis because the
existing Chrome session could not be attached through the browser-control channel
after one retry, although Chrome, the extension, and native-host checks were all
healthy. The audit therefore reused the exact Canary functional/performance sample
already recorded by the Owner and correlated it with retained logs and current
read-only database evidence. No alternative browser automation or session/cookie
inspection was used.

## Vercel and Supabase evidence

| Evidence | Result |
| --- | --- |
| Vercel build region | `sfo1` |
| Admin Schedule function region | `iad1` |
| Supabase project/database region | `ap-northeast-2` |
| Runtime | Node.js 24.x; 2,048 MB; 300-second platform limit |
| Speed Insights | Enabled but project metadata reported `hasData=false` |
| Web Analytics | Configured; no route-level timing export was available in this gate |
| Log Drains | None configured |
| Fluid Compute | Unknown / Need verification; project API did not return an explicit value |
| Supabase status/version | `ACTIVE_HEALTHY`; Postgres 17.6 |
| Connections | 25 observed of 60 maximum; 14 idle `ClientRead`; 1 active; 0 idle in transaction |
| Connection pressure | No connection-limit, deadlock, or statement-timeout evidence in the bounded log snapshot |
| `pg_stat_statements` | Available in schema `extensions`, version 1.11; read only, not reset |

The 100-entry Canary Vercel runtime-log snapshot contained only `GET`: 90 responses
were `200`, eight were `304`, two were `400`, and none were 5xx/fatal. Relevant
route counts were 10 monthly-summary page requests, eight selected-day requests,
and 14 Search requests. The exported entries did not expose invocation duration,
request region, cold-start markers, or `Server-Timing`, so those fields remain
unavailable rather than inferred.

The latest 100 Supabase API entries were a project-wide snapshot, not a
Canary-attributable slice. They contained no 4xx/5xx, but included ordinary
Production traffic methods and therefore cannot be used as Canary no-write proof.
Canary no-write proof comes from the deployment-scoped Vercel logs, which contained
only GET. The 100-entry Postgres log snapshot contained 98 `LOG` and two `ERROR`
entries: one was the audit's failed read-only `pg_stat_statements` schema lookup;
the other predated the Canary and was not correlated to it. Neither was a timeout,
deadlock, or connection-limit event.

## Timing breakdown

| Route / action | Browser-observed total | Server/database evidence | Interpretation |
| --- | ---: | --- | --- |
| Cold monthly navigation | 2.427 s | Exact cold inner split unavailable | One sample only; not P95 evidence |
| Warm monthly navigation | 4.058–5.344 s; P95 5.344 s | July summary 2.766–3.447 s | Failed 5-second P95 budget |
| Adjacent month change | 1.924–2.455 s | Summary 0.459–0.496 s; 2 calls | Lower-volume month is materially faster |
| July month change | 4.377–4.447 s | Summary 2.766–2.887 s; 8 calls | Paired residual was 1.560–1.611 s |
| Selected day | 2.857–3.758 s | 3 of 5 samples exceeded 3 s | Failed the 2–3 second target on most samples |
| Search | 4.654–5.937 s | Full detailed month read on every query | Slowest bounded read path |

The paired month-change residual combines DNS/connect/TLS, response download,
RSC navigation, auth/layout work, client render, and hydration. The retained
browser/Vercel telemetry cannot split those components safely, so their individual
durations are `Unknown / Need verification`. The summary's inner metric measures
Next.js data-loading/model execution. Direct bounded database plans measure core
Postgres execution only and do not include Vercel-to-Supabase HTTP RTT, PostgREST
request processing, response transfer, or browser rendering.

## Actual July 2026 volume and call accounting

Production read-only counts observed during this diagnosis:

| Item | Actual count | Source chunk/page size | Calls/chunks |
| --- | ---: | ---: | ---: |
| Verified, non-rescheduled monthly sessions | 1,437 | 1,000 | 2 pages |
| Walleted session IDs | 54 | 100 | 1 chunk |
| Matching wallet-credit rows | 54 | — | returned by the 1 wallet call |
| Unique `schedule_slot_id` | 439 | 100 | 5 chunks |
| Assignment-group rows | 576 | — | returned by the 5 group calls |
| Assignment-member rows | 1,363 | embedded | returned with groups |
| Teaching-program rows in monthly slot scope | 211 | 100 | selected-day only, not summary |
| Unique learners | 265 | 100 | selected-day only |
| Student-level rows in monthly learner scope | 410 | 100 | selected-day only |
| Direct monthly attendance rows | 821 | 100 | selected-day only |
| Active branches | 10 | cached 10 minutes | 0 on a warm cache hit; 1 on a miss |
| Active Level definitions | 70 | cached 10 minutes | selected-day only |

The observed warm July summary metric of eight external calls is exactly:

```text
2 booking_sessions pages
+ 1 wallet chunk
+ 5 assignment-group chunks
+ 0 active-branch calls because the 10-minute cache hit
= 8 external calls
```

A branch-cache miss would make the same current month nine calls. The assignment
chunks run with concurrency four, so five chunks still require two waves. Session
pagination is serial because the second page is discovered after the first page.

Selected-day volume examples were chosen deterministically from current July data:

| Volume | Date | Sessions / visible | Slots | Wallet chunks | Groups / members | Programs | Students / level chunks | Attendance scope / chunks |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Low | 2026-07-01 | 15 / 15 | 7 | 0 | 8 / 15 | 6 | 14 / 1 | 15 / 1 |
| Medium | 2026-07-13 | 35 / 33 | 11 | 1 | 13 / 31 | 9 | 31 / 1 | 33 / 1 |
| High | 2026-07-18 | 102 / 99 | 25 | 1 | 36 / 97 | 20 | 96 / 1 | 99 / 1 |

For these days, the selected-day boundary performs six to eight external calls,
depending on whether wallet and active-Level cache calls are needed. It has two
dependent phases: sessions first; wallet/groups/slot sessions/programs/Levels
next; student Levels and Attendance only after their scope IDs are known.

Search performs the same two detailed session pages, one wallet chunk, and five
assignment-group chunks for the whole month: eight data calls before in-process
matching and bounding to at most 200 round keys. It does not use the branch cache.

## Query-plan and index evidence

| Bounded plan | Key access path | Execution | Buffers / sort |
| --- | --- | ---: | --- |
| Summary sessions page 1 | `idx_booking_sessions_date`; small hash/seq joins | 5.181 ms | 792 shared hits, 0 reads; 419 kB in-memory quicksort |
| Summary sessions page 2 (`OFFSET 1000`) | Same date index; still sorts all 1,437 rows | 3.981 ms | 792 shared hits, 0 reads; no spill |
| Detailed monthly session page | Date index plus small hash joins to learner/parent references | 17.842 ms | 809 shared hits, 0 reads; 728 kB in-memory quicksort |
| One 100-slot assignment chunk | Group table seq scan; member `group_id` index; profile PK | 8.931 ms | 1,273 shared hits, 0 reads; no spill |
| High-day Teaching Programs | Seq scan of 422 program rows | 27.898 ms | 91 shared hits, 0 reads; no spill |
| Standard Admin permission lookup | unique `system_settings.key` index | 0.066 ms | 2 shared hits, 0 reads |

Existing useful coverage includes `booking_sessions(date)`,
`booking_sessions(booking_id)`, assignment groups by `(schedule_slot_id,
sort_order)`, group members by `group_id` and unique `booking_session_id`, wallet
credits by unique `original_session_id`, Attendance by `booking_session_id`,
student Levels by `student_id`, and unique `system_settings.key`.

Teaching Programs have no `schedule_slot_id` index, and the bounded plan used a
Seq Scan. However, it scanned only 422 rows and completed in 27.898 ms. The group
plan also chose a Seq Scan of 1,061 group rows despite an existing slot index and
completed in 8.931 ms. These are proven plan facts but not evidence that an index
would close a multi-second route gap.

Current aggregate `pg_stat_statements` evidence across all normalized relevant
SELECT fingerprints, not just this Canary route, showed weighted means of 78.19 ms
for `booking_sessions`, 16.52 ms for assignment groups/members, 8.18 ms for
Teaching Programs, 4.91 ms for Attendance, 2.65 ms for student Levels, 1.27 ms for
wallet credits, and 0.26 ms for `system_settings`. The largest relevant observed
fingerprint maximum was 1,892.79 ms. These historical aggregates demonstrate
occasional database variance but do not identify one route-specific multi-second
SQL statement.

## Ranked root causes

### Proven

1. **High impact — multi-call Data API fan-out and dependent phases.** The warm
   July summary needs exactly eight calls and two phases; selected day needs six to
   eight calls and two phases. Core plans are milliseconds, while the Next.js
   summary boundary is 2.766–3.447 seconds.
2. **High impact — Search still performs a full detailed month read on demand.**
   It avoids initial-page overfetch but each Search reads 1,437 detailed sessions
   in two pages plus wallet and five group chunks before filtering. The observed
   Search latency is 4.654–5.937 seconds.
3. **Medium impact — selected-day fixed multi-phase reads.** Even a low-volume day
   has six or seven data calls; medium/high days commonly have seven or eight.
   Three of five observed samples exceeded the target.
4. **Low current impact, growth risk — OFFSET pagination.** Page 2 scans/sorts the
   full 1,437-row qualifying set again. Its current core plan is only 3.981 ms, so
   it is not the present multi-second root cause.
5. **Low current impact — bounded Seq Scans.** Teaching Programs and assignment
   groups use Seq Scans in the tested shapes, but both tables are small and the
   bounded plans are tens of milliseconds or less.

### Inferred / not yet proven

1. **Cross-region RTT is a likely amplifier.** `iad1` functions call a Seoul
   (`ap-northeast-2`) Supabase project repeatedly. Exact RTT and connection reuse
   were not present in the retained telemetry, so the per-call contribution is
   unknown.
2. **PostgREST/RLS/JSON materialization is likely part of the server residual.**
   Direct SQL plans are much faster than endpoint server duration, but this audit
   did not capture route-specific PostgREST traces.
3. **Cold start is not proven.** Warm requests also missed budget and the Vercel
   log export did not include cold-start markers or invocation duration.
4. **Standard Admin permission work adds one read.** Source and the 0.066 ms plan
   prove the lookup exists and is indexed; its cross-region request cost was not
   separately measured. Super Admin bypasses it.
5. **Connection/pooler behavior is not proven as a bottleneck.** The database had
   capacity and no connection-exhaustion evidence. Supabase Data API pooler details
   were not exposed in this gate.

## Remediation options — not implemented

### A. Source-only options

- Increase or adapt the assignment-group chunk size after verifying Data API URL
  and response limits; the current 439 slot IDs create five calls and two
  concurrency waves.
- Reduce summary selections/embedded relationships to the minimum assignment
  validity fields and avoid repeated transformations that do not affect totals.
- Redesign Search into bounded server-side candidate lookups by learner, parent,
  Coach, branch, course, and status, then fetch only matching month rows. Preserve
  Thai one-character behavior and the 200-round bound with deterministic tests.
- Reduce selected-day dependency depth where inputs permit and avoid duplicate
  reference reads. Keep Attendance, Wallet, assignments, and auth context uncached;
  retain cache only for approved non-PII reference data.
- Treat client cancellation as UI stale-response protection, not proof that
  already-started server/database work was cancelled.

These require a separate Owner-approved Source Fix Gate.

### B. Database-change options

- Replace multiple Data API reads with a bounded server-side monthly aggregate,
  selected-day read, and/or Search RPC that preserves the exact Attendance,
  learner, Wallet, and coach-assignment rules.
- Evaluate composite/covering indexes against the exact PostgREST/RPC plans, such
  as date/status/order coverage for sessions and slot/update coverage for Teaching
  Programs. Current evidence does not justify declaring an index the primary fix.
- If Search moves into SQL, evaluate a Thai-compatible search/index design that
  explicitly preserves one-character queries; do not assume trigram indexing alone
  satisfies that contract.

Every option in this group **Requires separate Owner-approved Migration/Database
Gate**.

### C. Infrastructure options

- Evaluate function/database region alignment and remeasure the same bounded
  routes before considering promotion.
- Verify Fluid Compute and connection reuse/pooler behavior using infrastructure
  telemetry that exposes invocation and outbound spans.
- Consider runtime/connection configuration only after comparing it with the
  Source-only reduction in call waves.

Every option in this group **Requires separate Owner-approved Infrastructure
Gate**.

## Closeout state

- Source Complete: **Yes — Phase B**
- Local Tests: **Passed**
- Committed/Pushed: **Yes**
- Deployed: **Canary only**
- Production Active: **No**
- Production UAT Passed: **No**
- Performance Gate: **Failed**
- Production P95: **Unknown / Need verification and not passed; Canary P95 failed,
  but Production aliases were not tested with Phase B**
- Production Data Changed: **No**
- Customer Impact: **No direct Production change**
- Financial Impact: **No**
- Task Done: **No**
- Documentation Drift: **Resolved by the documentation commit containing this report**
- Next Owner decision: choose a separate Source Fix, Database, Infrastructure, or
  explicit performance-exception gate. Canary promotion remains prohibited.

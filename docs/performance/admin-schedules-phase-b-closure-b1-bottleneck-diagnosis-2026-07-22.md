# Admin Schedules Phase B Closure Gate B1 — Bottleneck Diagnosis

Date: 2026-07-22
Authorization: Owner-approved final read-only bottleneck diagnosis using the
existing unpromoted remediation Canary
Result: **PASS — PHASE B CLOSURE BOTTLENECK DIAGNOSED; NO CHANGES MADE**

## Scope and safety

- Scope was limited to `/admin/schedules`, its selected-day and Search GET routes,
  existing authenticated read-only Super Admin access, bounded Vercel
  observability, and bounded Supabase/Postgres read-only evidence.
- Application diagnosis traffic stayed bounded. No business
  `POST`/`PUT`/`PATCH`/`DELETE`, browser write action, SQL write, DDL, DML,
  statistics reset, source/configuration change, deploy, promotion, alias move,
  rollback, or Production data repair occurred.
- Search terms used for the seven functional categories are represented only as
  `Q1`–`Q7`. No raw term, email, phone, credential, token, JWT, or person-level
  detail is recorded here.
- Browser residual means `browser total - server duration`. It also includes
  transport, RSC download/processing, and client work; it must not be interpreted
  as render time alone.

## Deployment and repository identity

| Field | Evidence |
| --- | --- |
| Branch / B1 starting HEAD | `spike/next-major-security-upgrade` / `07a8bdf3368ed1b37c316a218c1e7321c93cde89` |
| Functional remediation Source | `62ac775d81aa8a702cbab744fdfb2a7ab15791b7` |
| Canary deployment | `dpl_FGxnuXQ4nQ77MBgw7uBWtg64JhFF` |
| Unique URL | `https://new-athlete-badminton-school-hm0ntpqx2-aachanin1s-projects.vercel.app` |
| Canary state | `production` target / `READY`; existing artifact; unpromoted |
| Canary custom/Production aliases | `0` |
| Production deployment | `dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX`; unchanged before/after B1 |
| Build / function / deployment metadata region | `cle1` / `iad1` / `sfo1` |
| Supabase state / region | `ACTIVE_HEALTHY` / `ap-northeast-2` |

The four established Production aliases remained on the existing Production
deployment before and after B1. The Canary dashboard identity was `READY` and its
authenticated Admin route was available through the existing Chrome session.
Fresh unauthenticated shell requests to the protected unique URL received the
Vercel Deployment Protection redirect, so B1 does not claim an independent fresh
anonymous `200` for `/`, `/api/health`, or a static asset. No 5xx was observed.

## Measurement method

- Month scope: July 2026 throughout, with adjacent June/August navigation.
- Monthly: one excluded warm-up, then 20 reload/navigation samples using the same
  completion marker and no cache-busting query.
- Selected day: deterministic low/medium/high dates with five visible-complete
  samples each, plus one rapid day-change check.
- Search: `Q1` learner, `Q2` parent, `Q3` Coach, `Q4` branch, `Q5` course,
  `Q6` verified status, and `Q7` Thai one-character; three samples each. Client
  totals include the fixed 300 ms debounce.
- P95 is nearest rank: `ceil(0.95 * N)`. P50 is the median and P90 uses nearest
  rank. Durations below are seconds unless a table says milliseconds.
- Monthly Server duration/call/row metrics came from the existing page payload.
  Per-sample selected-day/Search Server-Timing, `phasesMs`, call/row detail, and
  response size were not exposed through the available browser control path and
  remain unavailable rather than inferred.

## Monthly warm results — 20 samples

July four-call samples returned sessions `1,439`, assignment groups `586`, and
wallet rows `54`. Eighteen of twenty samples used the intended four-call path; two
included one branch-reference cache miss and used five calls.

| # | Browser | Server | Residual | Calls | Branch cache |
| ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 4.375 | 2.6910 | 1.6840 | 5 | miss |
| 2 | 4.407 | 2.6800 | 1.7270 | 4 | hit |
| 3 | 4.814 | 2.6275 | 2.1865 | 4 | hit |
| 4 | 3.926 | 2.1813 | 1.7447 | 4 | hit |
| 5 | 4.726 | 2.1547 | 2.5713 | 4 | hit |
| 6 | 6.574 | 2.7534 | 3.8206 | 4 | hit |
| 7 | 4.369 | 2.5605 | 1.8085 | 4 | hit |
| 8 | 4.058 | 2.1826 | 1.8754 | 4 | hit |
| 9 | 4.133 | 2.1903 | 1.9427 | 4 | hit |
| 10 | 4.947 | 2.8478 | 2.0992 | 4 | hit |
| 11 | 5.080 | 2.9228 | 2.1572 | 4 | hit |
| 12 | 4.863 | 2.7547 | 2.1083 | 5 | miss |
| 13 | 5.383 | 3.0514 | 2.3316 | 4 | hit |
| 14 | 7.577 | 4.1712 | 3.4058 | 4 | hit |
| 15 | 6.329 | 4.4646 | 1.8644 | 4 | hit |
| 16 | 4.510 | 2.5113 | 1.9987 | 4 | hit |
| 17 | 5.383 | 3.1930 | 2.1900 | 4 | hit |
| 18 | 5.575 | 2.7835 | 2.7915 | 4 | hit |
| 19 | 5.960 | 3.7544 | 2.2056 | 4 | hit |
| 20 | 5.417 | 2.9662 | 2.4508 | 4 | hit |

| Metric | Minimum | P50 | P90 | P95 | Maximum |
| --- | ---: | ---: | ---: | ---: | ---: |
| Browser total | 3.926 | 4.905 | 6.329 | 6.574 | 7.577 |
| Server duration | 2.155 | 2.754 | 3.754 | 4.171 | 4.465 |
| Browser residual | 1.684 | 2.133 | 2.792 | 3.406 | 3.821 |

The four-call-only browser P95 was `7.577 s`. Query-shape remediation therefore
worked, but the normal `<=3 s` and P95 `<=5 s` budgets both failed.

## Month navigation — three complete cycles

| Cycle / transition | Browser | Server | Residual | Calls | Sessions / groups |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 July → June | 7.367 | 2.496 | 4.871 | 4 | 1,171 / 475 |
| 1 June → July | 5.515 | 3.129 | 2.387 | 4 | 1,439 / 586 |
| 1 July → August | 4.934 | 0.359 | 4.575 | 2 | 7 / 0 |
| 1 August → July | 6.591 | 2.936 | 3.655 | 4 | 1,439 / 586 |
| 2 July → June | 6.885 | 2.673 | 4.212 | 4 | 1,171 / 475 |
| 2 June → July | 6.395 | 2.311 | 4.084 | 4 | 1,439 / 586 |
| 2 July → August | 5.029 | 0.752 | 4.277 | 2 | 7 / 0 |
| 2 August → July | 6.241 | 1.854 | 4.387 | 4 | 1,439 / 586 |
| 3 July → June | 6.265 | 2.523 | 3.743 | 4 | 1,171 / 475 |
| 3 June → July | 6.807 | 2.321 | 4.486 | 4 | 1,439 / 586 |
| 3 July → August | 4.600 | 0.374 | 4.226 | 2 | 7 / 0 |
| 3 August → July | 3.733 | 2.146 | 1.587 | 4 | 1,439 / 586 |

The low-volume August path reduced Server duration to `0.359–0.752 s`, but
Browser total remained `4.600–5.029 s`. This is direct evidence that Server
improvement alone may still leave the overall browser budget failing.

## Selected-day results

Visible-complete browser samples:

| Volume / date | Raw samples | P50 | P95 / max | Functional result |
| --- | --- | ---: | ---: | --- |
| Low / 2026-07-01 | 3.055 / 2.857 / 2.154 / 2.246 / 1.934 | 2.246 | 3.055 | 5/5 ready |
| Medium / 2026-07-13 | 3.753 / 2.705 / 2.208 / 2.520 / 2.399 | 2.520 | 3.753 | 5/5 ready |
| High / 2026-07-18 | 3.874 / 2.827 / 3.242 / 3.420 / 3.245 | 3.245 | 3.874 | 5/5 ready |
| Combined | 15 samples | 2.827 | 3.874 | errors 0 |

The combined P95/max was `3.874 s`, above the `<=3 s` target. A rapid
low → medium → high change ended on the correct high-day state; no stale response
overwrote it. Vercel recorded 20 selected-day GETs in the bounded window. The
available UI path did not expose per-sample API duration, Server-Timing,
`performance.durationMs`, calls, rows, `phasesMs`, cache state, or response size,
so duplicate-read/call-count confirmation remains based on prior Source/local
evidence rather than a new B1 per-sample payload claim.

## Search results

| Flow | Raw client totals | P50 | P95 / max | Result items | Truncated |
| --- | --- | ---: | ---: | ---: | --- |
| Q1 learner | 2.780 / 2.956 / 3.013 | 2.956 | 3.013 | 7 | No |
| Q2 parent | 3.523 / 3.492 / 3.436 | 3.492 | 3.523 | 7 | No |
| Q3 Coach | 5.835 / 5.970 / 5.868 | 5.868 | 5.970 | 85 | No |
| Q4 branch | 5.795 / 5.661 / 5.542 | 5.661 | 5.795 | 137 | No |
| Q5 course | 6.955 / 7.930 / 7.127 | 7.127 | 7.930 | 495 | Yes |
| Q6 verified status | 5.442 / 5.431 / 5.887 | 5.442 | 5.887 | 497 | Yes |
| Q7 Thai one-character | 6.083 / 7.868 / 5.888 | 6.083 | 7.868 | 497 | Yes |

- Combined client total: P50 `5.795 s`, P95 `7.868 s`, max `7.930 s`.
- Fixed debounce: `0.300 s` per sample.
- Combined post-debounce total: P50 `5.495 s`, P95 `7.568 s`, max `7.630 s`.
- Per-sample Server duration and browser residual: unavailable from the browser
  payload, so they are not inferred.
- Branch/course filters remained selected, and a rapid Search flow displayed the
  latest query. The displayed result-item count is not the endpoint round-key
  count; Source review separately verifies that returned round keys are bounded to
  `<=200`.
- The response contract contains round keys, dates, counts, limit, and truncation
  state only. It does not contain learner/parent/Coach names or contact details,
  and the candidate-first Source path does not call the old detailed full-month
  loader.

## Standard Admin and mobile

- Standard Admin: **Unknown / Need verification**. No existing authenticated
  Standard Admin session was available; no account, credential, permission, or
  session was created or changed.
- Mobile `390x844`: **Unknown / Need verification**. The browser-control viewport
  override did not change the document width in the existing/fresh controlled
  tabs, so no mobile-layout claim is made. Desktop horizontal overflow was absent.
- Console warning/error, hydration, and runtime page-error counts in the exercised
  desktop flows were `0`.

## Vercel evidence

The bounded deployment-scoped 30-minute window contained 899 requests, all GET:

| Evidence | Count / value |
| --- | ---: |
| GET | 899 |
| POST / PUT / PATCH / DELETE | `0 / 0 / 0 / 0` |
| HTTP 200 / 304 | `841 / 58` |
| 4xx / 5xx | `0 / 0` |
| warning / error / fatal | `0 / 0 / 0` |
| `/admin/schedules` page/RSC/prefetch GETs | 81 |
| Selected-day GETs | 20 |
| Search GETs | 23 |

All schedule functions were Node.js 24.x in `iad1`. A route-level 12-hour
observability view covering all environments/deployments, not Canary-only, showed
282 invocations, errors/timeouts `0/0`, compute average `5 s`, duration P75/P95
`8/10 s`, Active CPU P75 `210 ms`, TTFB P75 `436 ms`, cold starts `0.7%`, and
2.7K external Supabase calls with average external latency `620 ms` and error
rate `0%`. Because this panel is aggregate, it supports the wait-dominated pattern
but is not treated as a Canary-only percentile.

No PII marker was visible in the bounded deployment logs, and Source does not log
Search terms. The dashboard export did not expose raw query strings, so a complete
query-string scan is unavailable and is not claimed.

## Supabase/Postgres evidence

- Project/database state was `ACTIVE_HEALTHY`, region `ap-northeast-2`, Postgres
  17.6.1.
- Connection snapshot: maximum 60; 24 observed, active 0, idle 16, idle in
  transaction 0. Later wait evidence was ordinary client/background waiting, not
  lock pressure.
- The bounded 100-entry Postgres log snapshot contained only `LOG`; timeout,
  deadlock, connection exhaustion, and relevant fatal/error counts were 0.
- Supabase Data API log retrieval failed with a platform backend error. Retries
  were bounded and stopped; route-specific PostgREST timing therefore remains
  unavailable.
- `pg_stat_statements` was read without reset. Relevant weighted mean / observed
  max durations in milliseconds were: monthly sessions `79.75 / 1,892.79`,
  assignment `17.59 / 620.25`, course types `9.70 / 488.07`, Teaching Programs
  `8.07 / 106.77`, Attendance `4.87 / 244.77`, Levels `2.60 / 143.35`, branches
  `2.51 / 256.35`, wallet `1.11 / 94.80`, and settings `0.25 / 41.66`.

Every B1 analyzed plan ran as a bounded SELECT inside a read-only transaction with
`statement_timeout <= 5 s` and `ROLLBACK`:

| Bounded plan | Execution | Rows | Buffer evidence |
| --- | ---: | ---: | --- |
| July sessions page | 5.605 ms | 1,000 | 786 shared hits; no reads/spill |
| Monthly assignment groups | 1.290 ms | 586 | 270 shared hits; no spill |
| High selected-day sessions | 0.817 ms | 102 | 60 shared hits |
| High selected-day Teaching Programs | 31.341 ms | 20 | 52 shared hits; no spill |
| Thai one-character candidate | 6.488 ms | 501 | 795 shared hits; bounded sentinel |
| Verified-status candidate | 1.851 ms | 501 | 950 shared hits; bounded sentinel |

These plans prove that bounded core SQL execution and disk/temp work do not explain
the multi-second route durations. Local-to-Supabase RTT was not used as evidence
for Vercel-to-Supabase latency.

## Root-cause classification and ranking

### Proven

1. Query-shape remediation works: the normal warm monthly path used four calls in
   `18/20` B1 samples; the two five-call samples were branch-cache misses.
2. Bounded core SQL executes in milliseconds with no disk/temp spill in the tested
   plans, and Vercel Active CPU is small relative to total duration.
3. Both Server duration and Browser residual materially contribute to the failed
   monthly browser P95.
4. Low-volume August has a sub-second Server duration while Browser total remains
   around 4.6–5.0 seconds.
5. Canary remained unpromoted and no Production alias/data changed.

### Strongly Supported

1. **Primary Server contribution — Vercel-to-Supabase Data API/network wait.** The
   function runs in `iad1`, Supabase is in Seoul, SQL is milliseconds, Active CPU
   is low, and aggregate Vercel outbound Supabase latency is `620 ms`. Remaining
   pagination/dependency waves multiply this wait. The Vercel panel is partly
   aggregate rather than Canary-only, so the exact regional contribution is not
   yet proven.
2. **Separate major contribution — Browser/RSC residual.** Monthly residual P95 is
   `3.406 s`, and the low-volume August pairs show high residual despite fast
   Server completion.

### Inferred

- Cross-region distance on `iad1 → ap-northeast-2` is the leading explanation for
  much of the outbound wait, together with PostgREST/RLS/JSON materialization and
  remaining sequential pagination/dependent waves.
- The browser residual likely includes response/RSC download, RSC parsing/commit,
  client rendering, prefetch competition, and ordinary transport setup, but the
  current instrumentation cannot rank those components.

### Unknown / Need verification

- The latency change caused by region alignment; no controlled same-artifact A/B
  region experiment has run.
- Canary-only outbound-span distribution, per-call connection reuse, PostgREST
  phase timing, and per-sample selected-day/Search server phases.
- Standard Admin permission overhead and authenticated mobile behavior.
- The detailed composition of Browser/RSC residual and whether it alone would keep
  P95 above budget after a Server improvement.

## Recommendation and next gate

The single recommended next technical path is a separately Owner-approved
**Infrastructure Region Experiment Gate**: use the exact same business Source on
an unpromoted Canary, change only the Vercel Function region to an eligible region
aligned more closely with Supabase `ap-northeast-2`, retain a rollback plan, and
repeat the same bounded monthly/day/Search measurements. Do not promote during the
experiment.

This recommendation is an experiment, not a proven fix. Region alignment may
reduce Server wait, but the measured Browser/RSC residual can still keep the
overall budget failing.

Fallback if the controlled region experiment brings Server P95 into budget but
browser P95 still fails: authorize a scoped Source/RSC Observability + Performance
Gate that exposes response-arrival-to-RSC-commit-to-visible timing and then reduces
the proven client residual. A Database RPC/aggregate should be considered only if
the same-region experiment still shows Data API/materialization waves as the
dominant Server bottleneck. An index is not recommended from the current plans.

## Closeout matrix

| Field | Result |
| --- | --- |
| B1 Diagnosis | Complete |
| Source Complete | Yes — prior remediation only |
| Tests Passed | Yes — prior local evidence only; no tests rerun in B1 |
| B1 diagnosis Source/Test/config/migration changes | No |
| This closeout documentation change | Yes — four approved documentation files only |
| Committed / Pushed | Yes — documentation-only closeout containing this report |
| New deployment / promotion / alias move | No / No / No |
| Existing Canary | `READY`, unpromoted |
| Performance Gate | Failed |
| Feature Enabled / Allowlisted | No change / No change |
| Production Active | No |
| Production UAT Passed | No |
| Controlled Write UAT | No / not applicable |
| Data Repaired | No |
| Production Data Changed | No |
| Customer Impact | No direct Production change |
| Financial Impact | None |
| Documentation Drift | No after the successful B1 documentation-only commit and push |
| Task Done | No |
| Active Task | Admin Schedules Performance |
| Exact Next Owner Gate | Owner approval required for Infrastructure Region Experiment Gate |

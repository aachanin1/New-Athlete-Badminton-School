# Admin Schedules Phase B — Region Experiment and Permanent `icn1` Configuration

Date: 2026-07-22
Classification: **PASS — REGION EXPERIMENT PERFORMANCE GATE; PERMANENT `icn1`
CONFIGURATION COMMITTED AND PUSHED; NO PROMOTION**

## Authorization and safety

- Owner approved a deployment-only Function-region experiment followed by
  authenticated read-only measurement. Owner later approved the permanent
  repository configuration, Local validation, and the two scoped non-force
  publishes recorded here.
- Authentication was the only POST exception. The Owner entered the existing
  Super Admin credentials and MFA directly. No credential, token, session value,
  raw Search term, or PII is recorded.
- Measurement used GET/read-only Admin Schedules flows. Business-data mutation,
  Production data change, deployment promotion, alias movement, Vercel Project
  Settings change, Supabase change, migration, and Production UAT were not
  performed.

## Deployment and Source identity

| Environment | Deployment | Function region | State |
| --- | --- | --- | --- |
| Control | `dpl_FGxnuXQ4nQ77MBgw7uBWtg64JhFF` | `iad1` | `READY`, Production-target, unpromoted, zero custom/Production aliases |
| Treatment | `dpl_DvJ2gVNSqmqUCcdgcoiPTwJVSYh2` | `icn1` | `READY`, Production-target, unpromoted, zero custom/Production aliases |
| Production aliases | `dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX` | `iad1` | Unchanged before and after the experiment |

- Control and Treatment contained the same Admin Schedules business Source. The
  functional remediation identity was
  `62ac775d81aa8a702cbab744fdfb2a7ab15791b7`; the Treatment deployment input was
  pre-configuration branch HEAD
  `8e3a247497ec96742e8ff1ca6a8a8605b81d862f`.
- Vercel inspection confirmed the Control functions in `iad1` and Treatment
  functions in `icn1`. The four established Production aliases remained on the
  pre-gate Production deployment throughout.

## Paired monthly A/B

Method: two excluded warm-ups per deployment, then 20 valid July 2026 reload
samples per environment, alternating Control/Treatment order by pair. Browser
visible-complete, Server duration, and Browser residual were measured with the same
account, filters, month, viewport, and completion logic. Browser residual remains a
composite of transport, RSC/download, and client work; it is not treated as render
time alone. Nearest-rank P95 was used.

| Metric | Control `iad1` min/P50/P90/P95/max (s) | Treatment `icn1` min/P50/P90/P95/max (s) | P50 improvement | P95 improvement |
| --- | --- | --- | ---: | ---: |
| Browser | `4.027/5.1165/5.725/6.570/14.363` | `1.806/2.2025/2.625/2.640/2.735` | `56.95%` | `59.82%` |
| Server | `2.2408/3.12355/3.7117/3.7189/8.1592` | `0.8484/1.21865/1.5673/1.5824/1.5824` | `60.99%` | approximately `57.46%` |
| Browser residual | `1.5431/2.1542/2.3711/2.8511/6.2038` | `0.6503/1.0346/1.2064/1.5243/1.5922` | `51.97%` | approximately `46.55%` |

- Paired Browser difference P50/P95 was `2.928/3.930 s` in favor of Treatment.
- Control cache hit/miss was `19/1`; Treatment was `10/10`, so the Treatment result
  did not depend on a more favorable cache-hit distribution.
- Both environments returned the same observed row counts: sessions `1,440`,
  groups `586`, wallet rows `54`.
- Treatment passed the normal Browser P50 target (`2.203 s <= 3.000 s`) and Browser
  P95 target (`2.640 s <= 5.000 s`) across all 20 valid samples.

## Treatment extended read-only verification

### Month navigation

- Three complete July-to-June/July-to-August cycles completed with functional state
  intact. Low-volume August Browser/Server/residual ranges were
  `0.735–0.802/0.133–0.147/0.602–0.655 s`, with two external calls.

### Selected day

| Volume | Raw Browser samples (s) | P50 (s) | P95/max (s) | Samples over 3 s |
| --- | --- | ---: | ---: | ---: |
| Low | `1.052, 0.927, 0.929, 1.058, 0.918` | `0.929` | `1.058` | 0 |
| Medium | `1.068, 1.041, 1.043, 1.027, 1.294` | `1.043` | `1.294` | 0 |
| High | `1.349, 1.177, 1.436, 1.341, 1.176` | `1.341` | `1.436` | 0 |

Combined selected-day P50/P95/max was `1.058/1.436/1.436 s`. Rapid day change
finished on the latest requested high-volume date without stale content.

### Search

The seven required Search categories are recorded only as Q1–Q7. Three samples per
category produced `21/21` GET `200` responses. All response round-key counts were
bounded at `<=200`; branch/course filters persisted, rapid Search finished with the
latest query, and no raw term or PII was recorded.

| Flow | Client samples including 300 ms debounce (s) | P50 (s) | P95/max (s) | Result/round count | Truncated |
| --- | --- | ---: | ---: | --- | --- |
| Q1 learner | `2.165, 1.914, 1.749` | `1.914` | `2.165` | `3/3` | No |
| Q2 parent | `1.807, 1.742, 1.762` | `1.762` | `1.807` | `4/4` | No |
| Q3 Coach | `3.150, 2.071, 2.141` | `2.141` | `3.150` | `118/36` | No |
| Q4 branch | `1.801, 1.726, 1.890` | `1.801` | `1.890` | `429/90` | No |
| Q5 course | `2.125, 1.979, 2.073` | `2.073` | `2.125` | `495/138` | Yes |
| Q6 verified status | `1.900, 2.190, 2.411` | `2.190` | `2.411` | `497/152` | Yes |
| Q7 Thai one-character | `1.994, 1.912, 2.614` | `1.994` | `2.614` | `494/196` | Yes |

Combined client min/P50/P95/max was `1.726/1.979/2.614/3.150 s` including
debounce. Post-debounce P50/P95/max was `1.679/2.314/2.850 s`.

### Functional and mobile smoke

- Monthly-summary-first, no day detail before selection, selected-day detail,
  Search, filter persistence, rapid latest-response protection, truncation warning,
  and desktop no-horizontal-overflow checks passed. Console/hydration/runtime error
  count was `0`.
- A verified `390x844` viewport passed monthly no-overflow, selected-day (`2.508 s`),
  and Search (`1.824 s`) smoke with console errors `0`.
- Standard Admin: **Not run — outside the measurement-continuation authorization**.

## Logs and no-write evidence

- The corrected Search measurement window contained exactly 21 Search-path events,
  all GET `200`; business POST/PUT/PATCH/DELETE, 4xx, 5xx, warning, error, and fatal
  counts were all `0`.
- Search-term/PII marker findings in the available telemetry were `0`. The complete
  experiment produced no business-data mutation or Production data change.
- Authentication requests were isolated from the performance window and treated as
  the explicitly authorized auth-only exception.

## Interpretation and limitations

- **Proven:** the deployment-only `icn1` treatment materially improved both Server
  and Browser distributions and passed the 20/20 monthly Browser gate while keeping
  functional read-only behavior intact.
- **Strongly supported:** regional alignment removed a major part of the previously
  observed Vercel-to-Supabase Data API/network wait. This is consistent with the B1
  diagnosis; it does not prove every residual component or promise identical future
  Production behavior.
- **Still material:** Browser/RSC residual remained non-zero. A future deployment
  must be measured again; the regional result does not eliminate Browser-side risk.
- **Unknown / Need verification:** Standard Admin overhead and Production-alias UAT.
  The experiment was Canary-only and must not be described as Production UAT.

## Permanent configuration and Local verification

- `vercel.json` now contains exactly `"regions": ["icn1"]`; no other property was
  changed. Configuration commit
  `77db099607dd7ee8dfe265929a6720818e2015d1` was pushed non-force to
  `origin/spike/next-major-security-upgrade`.
- The exact configuration worktree passed JSON parse and region assertion, Admin
  Schedules performance `24/24`, assignment `24/24`, Lesson Wallet `17/17`,
  TypeScript, ESLint with zero warnings, mojibake (`245` files), Production build
  (`91/91` pages), and diff check.
- Local validation proves configuration syntax and build compatibility only. The
  committed permanent configuration has not been deployed and is not
  Production-active.

## Closeout matrix

| Field | Result |
| --- | --- |
| Active Task | Admin Schedules Performance |
| Source Complete | Yes — permanent `icn1` configuration |
| Tests Passed | Yes — Local evidence on the exact configuration diff |
| Committed/Pushed | Yes — configuration commit plus the documentation commit containing this report, both non-force |
| Deployed | No new deployment in the configuration/closeout gates; existing experiment Canary only |
| Existing Region Canary | `READY`, unpromoted |
| Performance Gate | Passed on the Treatment Canary; not yet verified from the committed permanent configuration |
| Permanent `icn1` Production Active | No |
| Production UAT Passed | No |
| Controlled Write UAT | No / not applicable |
| Data Repaired | No |
| Production Data Changed | No |
| Customer Impact | No direct Production change |
| Financial Impact | None |
| Documentation Drift | No after the documentation commit containing this report is pushed and remote-verified |
| Task Done | No |
| Exact Next Owner Gate | Permanent `icn1` Config Canary Deploy + Full Read-only UAT Gate; no Promotion |

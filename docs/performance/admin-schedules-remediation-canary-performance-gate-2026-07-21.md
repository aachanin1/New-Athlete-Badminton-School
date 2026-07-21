# Admin Schedules Remediation — Canary Performance Gate

Date: 2026-07-21
Authorization: Owner-approved Production-target unpromoted Canary deploy and
authenticated read-only performance UAT; this report is recorded under a later
documentation-only closeout gate

## Executive result

**STOP — CANARY PERFORMANCE GATE FAILED; NOT PROMOTED.**

The Source remediation produced the intended four-call warm monthly-summary path
in nine of ten samples. Warm browser navigation nevertheless had nearest-rank P95
`7.907 s`, above the mandatory `5.000 s` budget. The safety gate therefore stopped
the remaining UAT. The Canary stayed unpromoted, Production aliases did not move,
and no business data was written.

## Deployment identity and exactness

| Field | Evidence |
| --- | --- |
| Branch | `spike/next-major-security-upgrade` |
| Exact deployment input commit | `67a08fa5a11ee714d8ec23be3fb125732e255b54` |
| Functional Source commit | `62ac775d81aa8a702cbab744fdfb2a7ab15791b7` |
| Exact deployment tree | `ad1a35b38d19bd1b203bb8d644946ea73db3c466` |
| Deployment | `dpl_FGxnuXQ4nQ77MBgw7uBWtg64JhFF` |
| Unique URL | `https://new-athlete-badminton-school-hm0ntpqx2-aachanin1s-projects.vercel.app` |
| Target / status | `production` / `READY` |
| Build duration | `81.021 s` |
| Build / function / deployment metadata region | `cle1` / `iad1` / `sfo1` |
| Runtime / framework | Node.js `24.x` / Next.js `16.2.6` |
| Custom/Production aliases | `0` |
| Promotion | No |

Vercel deployment metadata returned `gitCommitSha=null`. Exactness is therefore
proven by the clean detached worktree, requested commit, and matching input tree;
it is not attributed to Vercel Git metadata.

## Production alias safety

The four established Production/custom aliases remained on
`dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX` before and after deploy/UAT:

- `www.newathleteschool.com`
- `new-athlete-badminton-school.vercel.app`
- `new-athlete-badminton-school-aachanin1s-projects.vercel.app`
- `new-athlete-badminton-school-aachanin1-aachanin1s-projects.vercel.app`

Vercel automatic deployment aliases are not promotion. The Canary had zero
custom/Production aliases. Rollback was not required and was not performed.

## Infrastructure smoke

| Check | Result |
| --- | --- |
| `/` | `200`; `80,237` bytes; `0.235 s` |
| `/api/health` | `200`; status `ok`; `1,782` bytes |
| Health reference counts | branches `10`; course types `3`; Levels `70`; pricing tiers `11`; anonymous auth |
| Generated `_next/static/*` asset | `200`; `529` bytes; `0.138 s` |
| Anonymous `/admin/schedules` | expected `307` auth redirect |
| Build/runtime 5xx | `0` |

## Super Admin partial functional UAT

An existing authorized Super Admin session was used. Before the performance stop,
the following passed:

- true monthly-summary-first rendering;
- no selected-day detail before date selection;
- desktop layout without horizontal overflow;
- console warning/error count `0`;
- July summary returned sessions `1,439`, assignment groups `586`, and wallet rows
  `54`.

Month-change, selected-day, Search, mobile `390x844`, and Standard Admin UAT were
**not run**. The mandatory warm P95 failure required the gate to stop immediately.
No inference is made about those untested flows on this Canary.

## Cold and warm performance evidence

The initial untimed navigation reported summary server duration `3.3282 s` and
five external calls.

The one bounded cold/reference-cache-miss sample was:

- browser total: `5.889 s`;
- summary server: `3.0914 s`;
- calls: `5` = two session pages + one date-scoped assignment-group page + one
  wallet call + one branch-reference cache miss.

One cold sample is not treated as P95 evidence.

### Raw warm samples

| Sample | Browser total | Summary server | External calls | Branch cache |
| ---: | ---: | ---: | ---: | --- |
| 1 | `4.365 s` | `2.5529 s` | 4 | hit |
| 2 | `4.145 s` | `2.5762 s` | 4 | hit |
| 3 | `3.989 s` | `2.2107 s` | 4 | hit |
| 4 | `3.910 s` | `2.1769 s` | 4 | hit |
| 5 | `7.907 s` | `4.3137 s` | 4 | hit |
| 6 | `4.125 s` | `2.6932 s` | 4 | hit |
| 7 | `5.664 s` | `3.1271 s` | 5 | miss |
| 8 | `5.228 s` | `2.9898 s` | 4 | hit |
| 9 | `3.969 s` | `2.1832 s` | 4 | hit |
| 10 | `5.130 s` | `2.5651 s` | 4 | hit |

Nearest-rank P95 uses rank `ceil(0.95 * 10) = 10` after sorting the ten browser
samples. The resulting P95 is `7.907 s`, which fails the mandatory `≤5.000 s`
budget.

## Call-accounting evidence

Nine of ten warm samples used the intended remediation formula:

```text
2 booking_sessions pages
+ 1 date-scoped assignment-group page
+ 1 wallet call
+ 0 branch calls on a reference-cache hit
= 4 external calls
```

The only five-call warm sample added one branch-reference cache miss. The worst
sample was a four-call cache-hit path, so the branch miss does not explain the worst
latency. The query-shape remediation is working, but call-count reduction alone did
not close the measured browser/server budget.

## GET-only and no-write evidence

The bounded deployment-scoped Vercel window contained `500` events:

| Evidence | Count |
| --- | ---: |
| All requests using GET | 500 |
| Schedule GET requests | 30 |
| Schedule/business POST | 0 |
| Schedule/business PUT | 0 |
| Schedule/business PATCH | 0 |
| Schedule/business DELETE | 0 |
| 5xx / fatal / error / warning | `0 / 0 / 0 / 0` |
| Email / phone / JWT / search-term marker matches | `0 / 0 / 0 / 0` |

The UAT issued no business mutation request. Production business data, financial
data, environment, feature controls, allowlists, migrations, indexes, RPCs, and
aliases were unchanged.

## Git and worktree safety

- Main repository HEAD/upstream remained
  `67a08fa5a11ee714d8ec23be3fb125732e255b54`, ahead/behind `0/0`.
- Main staged state remained empty during the Canary gate.
- The detached deployment worktree remained clean.
- Pre-existing dirty `AGENTS.md` SHA-256 remained
  `9A8B1F8C6CB9358B0D5DE948CAA1CB26B85E5FFA838048A6011568FD6CF7ED2E`.
- Pre-existing dirty `src/lib/schedule-slot-utils.ts` SHA-256 remained
  `A934C28DD7EED94CF7E98A6959D3E74FC3A3FE348A74DC06C205EACC38CDD181`.
- Source, Test, configuration, migration, and Git history changed by the Canary
  gate: No. This later closeout changes only the four approved documentation files.

## Proven findings

1. The remediation reduced the normal warm summary to four external calls in
   `9/10` samples.
2. The Canary still failed its Performance Gate: warm navigation P95 was
   `7.907 s`.
3. The worst browser/server sample occurred on the normal four-call path.
4. A branch-reference cache miss was not the cause of the worst sample.
5. The Canary was not promoted; Production aliases and business data did not
   change.

## Unknown / Need verification

- Function region `iad1` and the previously verified Supabase region
  `ap-northeast-2` are observed facts. Cross-region network/runtime residual may be
  relevant, but this gate did not capture direct RTT or a controlled regional
  comparison. Region mismatch is **not** recorded as a proven root cause.
- Month-change, selected-day, Search, mobile, and Standard Admin behavior/performance
  on this remediation Canary remain unverified because the mandatory stop occurred
  first.
- Production-alias UAT with the remediation did not occur. Production UAT is not
  passed and the remediation is not Production-active.

## Status matrix

| Field | Result |
| --- | --- |
| Source Complete | Yes — remediation |
| Local Tests | Passed — prior evidence |
| Committed/Pushed | Yes — remediation Source and prior documentation |
| New Canary | `READY`, Production-target, unpromoted |
| Canary Performance Gate | Failed |
| Production Active | No |
| Production UAT Passed | No |
| Production P95 | Failed for this Canary; Production aliases were not tested with the remediation |
| Migration / index / RPC | No |
| Feature / allowlist / environment change | No |
| Controlled Write UAT | No |
| Data Repaired | No |
| Production Data Changed | No |
| Customer Impact | No direct Production change |
| Financial Impact | None |
| Documentation Drift | No after the documentation closeout commit |
| Task Done | No |
| Active Task | Admin Schedules Performance |

## Owner decision options — not authorized automatically

The next action requires an explicit Owner/PM choice of one of these new gates:

1. Source Fix;
2. Database;
3. Infrastructure;
4. explicit performance exception.

A read-only Infrastructure Diagnosis is a possible recommendation only:
**OWNER APPROVAL REQUIRED — NOT AUTHORIZED TO START**. This closeout does not
authorize technical remediation, redeploy, promotion, Production UAT, migration,
database/configuration change, or Production write.

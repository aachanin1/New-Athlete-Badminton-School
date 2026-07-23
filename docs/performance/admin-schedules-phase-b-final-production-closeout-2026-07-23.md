# Admin Schedules Phase B — Final Production Closeout

Date: 2026-07-23
Classification: **PASS — EXACT `icn1` ARTIFACT PRODUCTION-ACTIVE; PRODUCTION
READ-ONLY UAT PASSED WITH OWNER-ACCEPTED LIMITATIONS; PHASE B DONE**

## Authorization and scope

- Owner authorized exact-artifact promotion, corrected deployment-protection-aware
  re-promotion, read-only Production UAT, the Performance Evidence Exception, and
  this final documentation-only closeout.
- This closeout changed documentation only. It did not edit Source, Test,
  configuration, scripts, packages, migrations, or database objects; it did not
  deploy, promote, roll back, move aliases, repeat UAT, or access/write Production
  business data.
- No credential, token, JWT, cookie/session value, raw Search term, contact detail,
  or other PII is recorded.

## Production identity

| Field | Final state |
| --- | --- |
| Deployment | `dpl_h51j7Kk6E5FJ1ox3bVLRAL61gv4H` |
| Deployment status | `READY` |
| Function region | `icn1` |
| Deployment input | HEAD `a39424bdbd0f78dee10d367800b833d8d3544d5d`, tree `a2a391a36b28e250dece4317e050ba52cb89f42e` |
| Permanent configuration | `vercel.json` contains exactly `regions: ["icn1"]` |
| Configuration commit | `77db099607dd7ee8dfe265929a6720818e2015d1` |
| Production aliases | `4/4` map to the exact deployment |
| Rollback | Not required after corrected re-promotion |

Fresh read-only closeout inspection reconfirmed the deployment as `READY`, the
configured Functions in `icn1`, all four established aliases mapped to the exact
deployment, and public health `200` with `icn1` routing evidence.

## Promotion and rollback history

1. The exact permanent-config artifact was promoted without rebuilding it.
2. Initial smoke automation treated expected Vercel Deployment Protection `302`
   responses on the two protected project aliases as failures and conservatively
   rolled back.
3. Evidence reconciliation found public health `200`, application 5xx `0`, runtime
   errors `0`, and UAT business writes `0`. The protected `302` was infrastructure
   behavior, not a Source, Region, or application failure.
4. Owner authorized corrected deployment-protection-aware re-promotion.
5. The same artifact was re-promoted without a rebuild or configuration change.
6. Corrected smoke and Production read-only UAT passed.
7. Current state: the exact artifact remains Production-active and rollback is not
   required.

The historical rollback is retained as a real event; it is not rewritten as if it
never occurred.

## Deployment-protection-aware smoke

| Check | Result |
| --- | --- |
| Public `/api/health` aliases | `200`, healthy, `icn1` |
| Protected project aliases | Expected Vercel Deployment Protection `302` |
| Public landing/auth/static | Passed |
| Anonymous `/admin/schedules` | Expected application redirect to Login |
| Anonymous day/Search APIs | Expected `401` |
| Relevant application 5xx | `0` |
| Relevant runtime/console/hydration errors | `0` |

## Read-only Production UAT

- **Super Admin:** passed monthly-summary-first, no detail before selection,
  previous/next month, selected-day loading/detail/empty state, Search Q1–Q7,
  bounded/truncated state, rapid latest-response behavior, filter persistence,
  desktop/mobile layout, and console/runtime checks.
- **Standard Admin:** passed authorized schedules access, monthly summary,
  selected-day and Search flows, permission/filter behavior, absence of unexpected
  Super Admin-only controls, rapid latest-response behavior, desktop/mobile layout,
  and console/runtime checks.
- **Mobile:** verified at actual `390x844`; monthly/day/Search smoke passed with no
  horizontal overflow.
- **Broader portal coverage:** public landing, Auth/Login, Admin shell, and health
  passed. User/Coach authenticated shells were not run because no existing sessions
  were available; no account was created.
- UAT initiated no business mutation. Production data changed by UAT: **No**.

## Bounded Production performance observations

Two warm-ups per role were excluded. Five monthly observations per role used the
same outer visible-complete methodology. These values are bounded outer
observations and are not combined with earlier page-internal or Canary datasets.

| Role | Outer P95 | Server P95 | Outer >5 s | Server >3 s |
| --- | ---: | ---: | ---: | ---: |
| Super Admin | `1.540 s` | `0.860 s` | `0/5` | `0/5` |
| Standard Admin | `2.450 s` | `1.523 s` | `0/5` | `0/5` |

No reproducible performance rollback signal was observed.

## Owner-accepted evidence limitations

- Page-internal timing: **Unavailable — Owner accepted**.
- Live forced error/retry: **Not run — Owner accepted**.
- Local error/loading/empty/stale evidence: **Passed previously on the same
  business Source**.
- Retry handler: **Present in Source**.
- Live retry interaction: **Unknown / not explicitly proven**.

These limitations remain explicit. The outer Production observations do not prove
page-internal timing, and no live retry result is claimed.

## Logs and no-write evidence

- Targeted Admin Schedules UAT events were GET/read-only; UAT business
  POST/PUT/PATCH/DELETE count was `0`.
- Relevant application 5xx, warning/error/fatal, timeout, runtime, console, and
  hydration findings were `0` in the inspected windows.
- A bounded post-UAT observation remained free of correlated application errors.
  Ambient real-customer traffic was distinguished from UAT actions and is not
  labeled as a UAT write.
- Credential, secret/token, JWT/Bearer, contact detail, raw Search-term, and other
  unnecessary PII marker findings in the recorded evidence were `0`.

## Final status matrix

| Field | Result |
| --- | --- |
| Source Complete | Yes — Phase B |
| Tests Passed | Yes — prior Local evidence |
| Committed/Pushed | Yes |
| Deployed | Yes — exact permanent-config artifact |
| Feature Enabled | Not applicable; no feature control changed |
| Allowlisted | Not applicable; no allowlist changed |
| Permanent `icn1` Production Active | Yes |
| Production UAT Passed | Yes — with Owner-accepted limitations |
| Controlled Write UAT | No / not applicable |
| Data Repaired | No / not applicable |
| Production Data Changed by UAT/this gate | No |
| Customer Impact | `icn1` performance remediation active |
| Financial Impact | None |
| Rollback | Not required |
| Documentation Drift | No after this closeout commit is pushed and remote-verified |
| Task Done | Yes — Phase B |
| Active Task | NONE |
| Next Action | Await Owner selection; do not start another task automatically |

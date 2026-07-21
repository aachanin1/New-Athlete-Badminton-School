# Admin Schedules Performance Phase B — Source + Local Test

Date: 2026-07-20; publish/Canary closeout updated 2026-07-21
Authorization: Owner-approved Source Fix + Local Test, Commit + Push, subsequent
Production-target Canary, and read-only performance diagnosis

## Confirmed root cause

The previous `/admin/schedules` Server Component loaded a full month of learner and
parent records, wallet state, coach assignment groups and members, slot sessions,
Levels, Teaching Programs, and Attendance before the first render. Chunk loops ran
serially and later reads depended on earlier results. The same month-wide
`booking_sessions` scope was also read more than once. The Client initially hid the
detail, but the Server still serialized it into the browser payload. There was no
authenticated read boundary for a selected day or on-demand month-wide Search.

## Phase B source result

- Initial navigation now uses a bounded monthly summary model. It returns calendar
  round aggregates and the existing branch/course/session/learner/waiting-Coach/
  wallet totals without learner, parent, Coach-name, Level, Program, or Attendance
  detail in the browser payload.
- Selected-day detail is loaded only after an Admin chooses a date. The authenticated
  route returns that day's learner, parent, exact assignment group, Level, Teaching
  Program, wallet, and attendance-derived state. Exact attendance identity remains
  `booking_session_id + student_id`, using `child_id` for children and
  `bookings.user_id` for self/adult learners.
- Month-wide Search is an authenticated on-demand route. It preserves learner,
  parent, Coach, branch, course, and booking-status matching, accepts one-character
  Thai queries, remains within the selected month, applies existing branch/course
  filters, and returns at most 200 round keys rather than PII.
- Day and Search requests use cancellation plus generation checks so an older
  response cannot replace a newer selection/query. Search is debounced by 300 ms.
- Auth/Profile lookup is request-memoized. Shared caching is limited to active
  branches and active Level definitions for 10 minutes. Attendance, wallet,
  assignments, schedule detail, Search results, and authenticated user context are
  not placed in shared long-lived cache.
- Local-only instrumentation logs operation name, duration, external data-call
  count, and row counts. It does not log search terms or PII.

## Local verification

All measurements below use a disposable local Supabase fixture and Next.js local
dev server. They are not Production P95 evidence.

| Measurement | Local result | Budget / interpretation |
| --- | ---: | --- |
| Cold monthly navigation | 2,512.8 ms | Within normal 3 s target on the local fixture |
| Warm monthly navigation samples | 1,170.6 / 1,151.8 / 1,087.9 / 1,160.0 / 1,187.8 ms | Local sample P95 1,187.8 ms, within 5 s |
| Month change | 220.8 ms | Local browser navigation |
| Selected-day load | 187.3 ms | Within the 2–3 s local target |
| Search latency | 473.7 ms | Includes 300 ms debounce |
| Summary Server duration | 132.6 ms | Boundary instrumentation |
| Selected-day Server duration | 26.3 ms | Boundary instrumentation |
| Search Server duration | 28.8 ms | Boundary instrumentation |
| Summary external data calls | 4 | About 6 including request-memoized Auth/Profile |
| Selected-day external data calls | 8 | About 10 including Auth/Profile |
| Search external data calls | 3 | About 5 including Auth/Profile |
| Initial RSC/document response body | 91,029 bytes | Local dev response |
| Initial transferred bytes | 3,248,399 bytes | Includes unoptimized local dev assets |

Verification results:

- Phase B deterministic checks: 17/17 passed.
- Existing Admin Schedule assignment-state checks: 24/24 passed.
- Lesson Wallet regression checks: 17/17 passed.
- Disposable local browser E2E: 5/5 passed; fixture residue 0.
- TypeScript, full ESLint, mojibake guard (241 files), local Production build,
  post-build clean `.next` restart, page/static-asset smoke, and `git diff --check`
  passed.
- Browser coverage included initial summary without detail preload, previous/next
  month, select/change day, loading/empty/error/stale response, all six Search
  categories, Super Admin and standard Admin access, anonymous denial, desktop and
  mobile rendering, and runtime/console/hydration checks.
- The 2026-07-21 resumed E2E used Docker and repo-local Supabase exclusively on
  `127.0.0.1` and passed `5/5` with residue `0`. Owner explicitly waived repeat
  `.next` cleanup/clean-restart for the publish gate. The exact Phase B worktree
  had already passed clean restart and page/static smoke on 2026-07-20; this report
  does not claim that the waived step was repeated on 2026-07-21.

## Subsequent Canary result — 2026-07-21

Owner later authorized a Production-target, unpromoted Canary and a separate
read-only performance diagnosis. Canary
`dpl_5x2vzwUxAmxNaT8HZGJeBQ32JVr4` is `READY` on exact commit
`b0bada3d076302d24ebe3b594c03b22bf0997869`. Super Admin functional UAT
passed, but the performance gate failed: warm navigation P95 was `5.344 s`, July
summary Server duration was `2.766–3.447 s`, selected-day exceeded `3 s` in
`3/5` samples, and Search was `4.654–5.937 s`.

The Canary was not promoted. All four Production aliases remained on
`dpl_GSYEioBLHodQWLu2CRmbBQeWnhXX`. The read-only diagnosis found 1,437
qualifying July sessions, 54 walleted session IDs, and 439 unique slot IDs. Warm
summary call accounting is exactly two session pages + one wallet chunk + five
group chunks + a branch-cache hit = eight calls. Bounded direct SQL plans were
milliseconds; the primary proven pattern is Data API fan-out and dependent phases,
while the `iad1` Vercel to `ap-northeast-2` Supabase region difference is a likely
but not directly timed amplifier.

Detailed evidence:
`docs/performance/admin-schedules-phase-b-canary-performance-diagnosis-2026-07-21.md`.

## Limits and next gate

- Canary performance gate: **Failed**. Production aliases were not changed, so
  Phase B Production UAT remains **No** and Production P95 is **not passed**.
- Coach portal and User portal impact were not measured or changed in Phase B.
- The local fixture is intentionally small; Production row shape and network
  distance can change absolute latency.
- No migration, RPC, index, dependency, environment, feature flag, allowlist,
  Production read/write, business-data change, or financial-data change occurred.
- Source/Test commit `3d32401b13873592d5462e6776b0e847335d2d43` and the
  publish documentation closeout are pushed non-force. Phase B is deployed only
  to the unpromoted Canary. The next gate requires an explicit Owner choice of
  Source Fix, Database, Infrastructure, or performance exception; promotion and
  Production UAT remain prohibited.

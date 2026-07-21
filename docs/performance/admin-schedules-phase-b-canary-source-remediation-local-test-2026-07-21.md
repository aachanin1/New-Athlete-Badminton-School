# Admin Schedules Phase B — Canary Source Remediation + Local Test

Date: 2026-07-21
Authorization: Owner-approved Source Fix + Local Test, followed by a separately
approved scoped Commit + Push gate
Result: **PASS — SOURCE ONLY; PASS — LOCAL TEST ONLY; PASS — COMMITTED AND
PUSHED**

## Scope and safety

- Repository branch: `spike/next-major-security-upgrade`
- Source-remediation starting/final pre-publish HEAD:
  `358040d25c37398811f05611b53fc6a5f4ec099c`
- Source/Test commit: `62ac775d81aa8a702cbab744fdfb2a7ab15791b7`
- Ahead/behind at Gate 0: `0/0`; staged state was empty
- Production-target Canary from the last verified evidence:
  `dpl_5x2vzwUxAmxNaT8HZGJeBQ32JVr4`, exact commit
  `b0bada3d076302d24ebe3b594c03b22bf0997869`, unpromoted
- Existing Production aliases and Production state were not accessed or changed in
  this gate
- Migration, index, RPC, View, Function, Trigger, Extension, dependency,
  Infrastructure, environment, feature flag, allowlist, Production query/write,
  deploy, promotion, and rollback: **No**. The later approved Source/Test and
  documentation commits were pushed non-force to the existing branch.
- `AGENTS.md` and `src/lib/schedule-slot-utils.ts` remained pre-existing dirty
  files and were not edited or staged for this work

## Confirmed root causes addressed

The prior read-only diagnosis established that July summary made eight external
calls: two session pages, one wallet chunk, and five assignment-group chunks for
439 unique slot IDs. Selected-day repeated a `booking_sessions` read after loading
the same verified day scope. Search loaded two detailed month pages plus Wallet and
all assignment groups before applying every search term.

This Source-only gate addressed those three query-shape causes. It did not attempt
an index or Infrastructure workaround because bounded SQL plans were already
`3.981–27.898 ms`, and no database or region change was authorized.

## Source changes

### Monthly summary

Assignment groups are now read through `schedule_slots!inner(date)` with selected
month bounds, deterministic top-level ordering, explicit 1,000-row pagination, and
only the coach role/ID plus exact member session IDs needed by the summary. The
initial RSC still contains summary data only and does not serialize coach/person
names.

| July-equivalent component | Before | After |
| --- | ---: | ---: |
| 1,437 session rows | 2 pages | 2 pages |
| 54 wallet IDs | 1 chunk | 1 chunk |
| 439 unique slots / 576 groups | 5 slot-ID chunks | 1 date-scoped group page |
| Warm total | 8 calls | 4 calls |
| Cold branch-reference miss | 9 calls | 5 calls |

Groups outside the visible session set cannot affect totals because exact members
are matched back to visible `booking_session_id` values. Sessions without
`schedule_slot_id` retain their fallback round key. Waiting-Coach, wallet, branch,
course, round, and learner totals retain the existing model semantics.

### Selected-day detail

The second `booking_sessions` query was removed. Slot attendance scope is derived
from the exact day rows already constrained to verified bookings and non-rescheduled
sessions, retaining only rows with a real `schedule_slot_id` and excluding
`walleted`/`rescheduled` rows exactly as the removed query did.

Wallet, date-scoped assignment groups, Teaching Programs, and cached active Levels
start in the first independent related-data wave. Student Levels and Attendance
remain in the dependent learner-state wave after exact group/member scope is known.
The warm path is 5 calls without a wallet chunk and 6 with one; the cold
Level-reference path is one call higher.

### Candidate-first Search

Search no longer calls the full detailed-month loader. It now:

1. normalizes the term to NFC;
2. executes independent, month-bounded fixed-column candidates for learner name,
   nickname, parent/self profile, branch, and exact assigned Coach;
3. resolves the small non-PII course reference set and queries matching course IDs;
4. queries the verified booking-status candidate only when the normalized status
   contains the term;
5. loads minimal detail only for bounded Coach member session IDs;
6. deduplicates and sorts by `date + start_time + id`, applies Wallet visibility,
   and returns at most 200 round keys.

Direct `.ilike()` modifiers are used instead of raw PostgREST `.or()` grammar.
Literal backslash, `%`, and `_` are escaped before pattern matching; commas and
parentheses remain ordinary encoded value characters. Course names use a reference
lookup plus course IDs because local proof showed that direct `ILIKE` on the
`course_type_name` enum fails with PostgreSQL error `42883`. No cast, RPC, or schema
change was introduced.

The internal candidate cap is 500 plus a one-row truncation sentinel per source.
If any source or the merged candidate set reaches its cap, `truncated` remains true.
The response contains round keys, dates, counts, the limit, and the truncation flag;
it does not contain learner, parent, or Coach names. Metrics use fixed counters such
as `sessionPages`, `groupPages`, `candidateCalls`, and `detailCalls`; they contain no
term, name, contact detail, cookie, token, or person identifier.

## Data API proof

The implementation follows current Supabase/PostgREST behavior:

- referenced-table filters use `!inner` when parent rows must be excluded;
- `.range()` is 0-based and inclusive, with explicit deterministic ordering;
- top-level reads are explicitly paginated because Data API projects commonly cap
  a response at 1,000 rows;
- literal pattern wildcards are escaped before `ilike`.

References inspected:

- [Supabase joins and nesting](https://supabase.com/docs/guides/database/joins-and-nesting)
- [Supabase range modifier](https://supabase.com/docs/reference/javascript/range)
- [Supabase filters](https://supabase.com/docs/reference/javascript/using-filters)
- [PostgREST resource embedding](https://docs.postgrest.org/en/v14/references/api/resource_embedding.html)
- [PostgREST tables, views, and pattern matching](https://docs.postgrest.org/en/v14/references/api/tables_views.html)

The relational/date filters, enum behavior, Thai/NFC terms, literal filter-control
characters, branch/course filters, and month isolation were all executed against
the disposable Supabase stack on `127.0.0.1`; Production was not used for syntax
experimentation.

## Verification results

| Check | Result |
| --- | --- |
| Admin Schedules deterministic | `24/24` passed |
| Assignment-state regression | `24/24` passed |
| Lesson Wallet regression | `17/17` passed |
| Disposable local Supabase/browser E2E | `5/5` passed |
| Fixture cleanup | residue `0` |
| Admin + Super Admin | passed |
| Anonymous day/Search rejection | passed |
| Thai one-character + NFC | passed |
| Literal `%`, `_`, backslash, comma, parentheses | passed |
| Branch/course filters + selected-month isolation | passed |
| 200-round bound/truncation | passed |
| Desktop + mobile `390×844` | passed |
| Loading/error/empty/stale response | passed |
| Console/hydration/runtime errors | `0` in asserted browser flow |
| TypeScript | passed |
| Full ESLint | passed |
| Mojibake | passed, `243` files |
| Local Production build | passed |
| `git diff --check` | passed |

The high-cardinality integration fixture added 205 dated slots, sessions, and
groups. Together with the disposable base seed, July contained 250 session rows
and 207 groups. Summary still made one `groupPages` call and four total calls, so
group reads did not revert to 100-slot chunks. Search tests covered learner,
parent, Coach, branch, course, status, filters, month isolation, Thai one-character,
NFC, literal control characters, bounded warning, and PII-free output.

## Local performance evidence

Baseline was recorded before edits on the original smaller disposable fixture.
Final measurements use the deliberately larger 205-slot/group fixture, so browser
bytes and Search latency are not strict same-data comparisons.

| Measurement | Pre-edit baseline | Final worktree |
| --- | ---: | ---: |
| Cold navigation | `4635.3 ms` | `2359.8 ms` |
| Five warm samples | `2717.8/2434.9/2393.1/2931.8/2451.2 ms` | `2178.1/2311.7/2470.2/2745.9/2273.6 ms` |
| Warm P95 | `2931.8 ms` | `2745.9 ms` |
| Month change | `442.5 ms` | `433.4 ms` |
| Selected-day UI | `413.6 ms` | `588.9 ms` |
| Summary server / calls | `318.0 ms / 4` | `139.2 ms / 4` |
| Selected-day cold server / calls | `41.6 ms / 8` | `38.0 ms / 7` |
| Learner Search client/server/calls | `571.0/28.8 ms / 3` | `614.3/80.2 ms / 6` |
| Document body | `91,085 bytes` | `222,466 bytes` |
| Transferred bytes | `3,248,399 bytes` | `3,252,965 bytes` |

Final warm selected-day API profiles were:

| Profile | Rows | Client | Server | Calls |
| --- | ---: | ---: | ---: | ---: |
| Low | 2 | `153.5 ms` | `29.0 ms` | 5 |
| Medium | 4 | `100.6 ms` | `24.8 ms` | 6 |
| High | 8 | `121.6 ms` | `24.0 ms` | 5 |

Representative Search profiles were:

| Category | Candidate rows | Client | Server | Calls |
| --- | ---: | ---: | ---: | ---: |
| Learner | 1 | `614.3 ms` | `80.2 ms` | 6 |
| Coach | 0 direct + bounded exact detail | `204.8 ms` | `84.6 ms` | 7 |
| Status | 250 | `198.1 ms` | `85.6 ms` | 8 |

The sparse learner Search has three more fixed parallel candidate calls than the
small-fixture Phase B baseline and was `43.3 ms` slower at the server. This is the
intentional cost of preserving all dimensions without raw filter grammar. Unlike
Phase B, the read is bounded and does not scale to 1,437 detailed person/group rows
plus five slot chunks for every term. Production improvement remains Unknown / Need
verification until a separately approved Canary/deploy gate.

## Post-build limitation

The Production build passed. In the Source/local gate, the resolved cleanup target
was verified as the exact repo-local `.next` directory and no process was listening
on port 3000, but execution policy rejected the cleanup command before execution.
No alternate deletion method was attempted. For the later publish gate, Owner
explicitly accepted skipping repeat `.next` cleanup/clean-restart for this exact
worktree. `.next` was not deleted or touched, and repeat clean restart plus
`_next/static/*` smoke are **not rerun/not claimed**. Normal browser E2E passed
`5/5` with residue `0` in both the final Source/local run and the publish-gate run.

## Commit + Push gate verification

- Fresh Gate 0: branch `spike/next-major-security-upgrade`; local/upstream/actual
  remote `358040d25c37398811f05611b53fc6a5f4ec099c`; ahead/behind `0/0`;
  staged empty; migration diff empty.
- Source/Test commit: `62ac775d81aa8a702cbab744fdfb2a7ab15791b7`, message
  `perf(admin-schedules): reduce canary read fan-out`.
- Documentation closeout: separate commit containing the current status matrix,
  message `docs: record admin schedules remediation publish`.
- Verification rerun: remediation `24/24`; assignment `24/24`; Lesson Wallet
  `17/17`; TypeScript, ESLint, mojibake `243`, diff check, local Production build,
  and disposable browser E2E `5/5` with residue `0`.
- E2E safety: Docker Engine available; Supabase API, DB, GraphQL, mail, MCP, REST,
  storage, and Studio endpoints all resolved to `127.0.0.1`.
- Publish-gate local measurements: cold `1985.5 ms`; five warm samples
  `1074.4/1060.8/1226.0/1170.4/1117.0 ms`, P95 `1226.0 ms`; month change
  `273.5 ms`; summary server `136.5 ms` / four calls; selected-day server
  `40.4 ms` / seven cold calls; learner/Coach/status Search server
  `105.9/124.3/152.0 ms` / `6/7/8` calls.
- No secret, credential, token, password, service-role key, real email/PII, or raw
  authenticated Search term was added to the staged documentation.

## Closeout matrix

| Field | Result |
| --- | --- |
| Source Complete | Yes — committed/pushed Source-only remediation |
| Tests Passed | Yes; repeat clean restart was Owner-waived and is not claimed as rerun |
| Committed | Yes — Source/Test `62ac775d81aa8a702cbab744fdfb2a7ab15791b7` plus separate documentation closeout |
| Pushed | Yes — non-force to `origin/spike/next-major-security-upgrade` |
| Deployed | No in this gate; prior Canary only remains last verified evidence |
| Feature Enabled | No change |
| Allowlisted | No change |
| Production Active | No |
| Production UAT Passed | Unknown / Need verification — not performed for this remediation |
| Production P95 | Unknown / Need verification |
| Controlled Write UAT | No / not applicable |
| Data Repaired | No |
| Production Data Changed | No |
| Customer Impact | No direct Production change |
| Financial Impact | None |
| Documentation Drift | No after the publish closeout |
| Task Done | No |
| Active Task | Admin Schedules Performance |
| Next Action | Owner/PM reviews publish result and decides whether to authorize a separate Canary Deploy + Performance UAT gate |

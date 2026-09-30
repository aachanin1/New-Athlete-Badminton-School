# Finance read failure — scope and evidence (2026-09-30)

## Scope Contract

Actor: Super Admin opening `/admin/finance`; existing Admin permissions remain.
Current behavior: RSC throws `progressive booking read failed: Bad Request`.
Intended behavior: hydrate the same selected Progressive ledger's booking details
through bounded requests, without losing or duplicating a ledger allocation.
Completion: reproduce the old failure, verify bounded reads and unchanged Finance
outputs, tsc/lint/build, isolated authenticated UI and role checks, preserved work,
scoped committed/pushed source and a persistent isolated production-mode artifact.

Functional allowlist (2): `src/app/(admin)/admin/finance/page.tsx`,
`src/lib/admin-finance-read.ts`. Tests (2):
`scripts/check-admin-finance-read.mjs`, `scripts/check-admin-finance-isolated.cjs`.
Docs (4): this report, `PROJECT_STATE.md`, `TODO-CODEX.md`, `DEVELOPMENT_TODO.md`.
Blast radius: Progressive booking-detail SELECTs used by Finance only. No Finance
client formulas, Legacy selection, summaries, expenses, date filtering, existing
source limits, role guards or mutations changed.

Protected: pricing (including Adult), old bills, financial totals/formulas,
payments/coupons/Wallet/entitlement/attendance/payroll/permissions, source admission
work and all dirty files. No dependency/config/schema change or adjacent fix.
Authorized: isolated worktree, focused implementation/testing, scoped commit/push,
local production-mode build connected only to a new physically verified disposable
database. Real-database investigation is SELECT-only. No real-database test writes,
Production deployment/promotion/activation, environment/control/cron changes,
migration or data repair. Owner communicates directly with Developer/technical
adviser. No PM relay or delegated agent.

Owner UAT (isolated Super Admin):
1. Open Finance and reload: page renders without the error boundary.
2. Select September 2026: compare displayed totals to the fixture reconciliation.
3. Select annual view: revenue/expenses/net and branch/course breakdown agree.
4. Switch to October and back: no missing/double-counted rows or stale totals.
5. View at mobile width: controls/cards remain usable. Do not save/delete expenses.

## Independently verified root cause

Vercel grouped errors, queried 2026-09-30: 15 occurrences / 4 users, route
`/admin/finance`, first 2026-09-27T07:23:49Z, last 2026-09-30T06:33:39Z;
`[admin/finance] progressive booking read failed: Bad Request`,
digest `2443997597`, deployment `dpl_6jEceTi2iJ2UEgfpndeJ9zqnHJYV`.
Individual runtime-log queries timed out; grouped evidence was available.

Fresh SELECT-only reproduction at 2026-09-30T09:06:12.521Z: 690 approved
Progressive allocations and 690 unique booking IDs. Original unbounded ID query
URL ~25.7 KB: HTTP400, no rows, `Bad Request`. Same columns and IDs divided into
100-ID requests: seven HTTP200 results, 690 booking rows, missing IDs0,
allocated amount1,615,206. This confirms the oversized single-request failure;
the exact rejecting infrastructure component/threshold remains unknown.
The screenshot's former685 count is historical, not current dataset size.

Private raw evidence (contains customer data; excluded from Git):
`C:/Users/aacha/AppData/Local/Temp/finance-read-fix-20260930`.
The client, monetary conversions and grouping logic stay byte-identical.
Existing source-read limits remain unchanged; this task does not certify
unlimited historical Finance coverage beyond those pre-existing limits.

## Verification and handoff

17 deterministic tests passed, including0/1/99/100/101/400/401/685/690/1000/2000
IDs, duplicate booking membership, later-batch error, missing/duplicate/wrong row
and network rejection. Requests have at most100 IDs and at most4 in flight.
Failures reject the complete read; they never manufacture partial Finance totals.

Dedicated physical target `FinanceRead20260930`, API54121/DB54122, labels/workdir/
ports checked before fixtures. All committed migrations applied only in the new
empty target; no schema/source migration added. Synthetic690 Progressive
allocations plus approved/pending/rejected Legacy payments,2branches,3courses,
manual expenses and closed teaching summaries. These are read fixtures, not proof
of booking/payment creation or pricing policy execution.

Five isolated actual-data assertions passed: exact690-ID hydration; independent
SQL monthly totals; complete serialized FinanceClient props equal the original
page with only its oversized transport substituted; allocation/status/amount
cardinality preserved; original financial client source byte-identical.
The old actual local request returned414 `URI too long`; corrected reads passed.

Ten production-build browser assertions passed: anonymous protection, Super Admin
monthly totals, annual totals, October switching, return/reload, mobile cards,
Admin permission denial, User denial, no page errors/business writes, and unchanged
selected Finance source fingerprints. Desktop1440px/mobile390px screenshots are
retained privately. Financial fingerprint before/after:
`9170ac7ea3aa260fead296d5cfc48b2b`.

| Synthetic period | Revenue | Closed coach pay | Manual expense | Net |
| --- | ---: | ---: | ---: | ---: |
| September2026 | 301,600 | 3,000 | 1,000 | 297,600 |
| October2026 | 46,200 | 4,000 | 2,000 | 40,200 |
| Year2026 | 347,800 | 7,000 | 3,000 | 337,800 |

TypeScript, zero-warning lint, mojibake281 and Next production build95/95 passed.
Source/client/auth and protected mutations outside the2functional-file allowlist
are untouched. Fixture initialization initially referenced a nonexistent column;
that transaction rolled back, the fixture was corrected without resetting data,
and verification passed. First UI assertion selected introductory text rather
than the cost card; its selector was corrected and all10checks passed. Original
failure logs remain available and are not represented as passing runs.

Owner URL: http://finance.localhost:3130/admin/finance (this computer only).
Role: isolated Super Admin, email `finance-super_admin@example.test`, password
`Finance-Only-UAT-2026!`. These credentials belong only to the disposable target.
Dedicated hostname separates its cookies from existing localhost UAT sessions.
Follow the5steps in the Scope Contract; expected totals are above. Owner manual
UAT is pending. No Production UAT, data repair, activation or release is claimed.

Application/build identity and current Git/publication status are authoritative
in this worktree's PROJECT_STATE.md. Detailed private JSON/logs/screenshots:
`C:/Users/aacha/AppData/Local/Temp/finance-read-fix-20260930`.
Existing2,000 source limits/API caps and annual summary/expense date scope remain
unchanged. Broader history completeness, write flows and other portals are outside
this fix. Production still requires a separately authorized release.

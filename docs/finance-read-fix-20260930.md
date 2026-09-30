# Finance read failure — scope and evidence (2026-09-30)

Current handoff: exact staged artifact READY FOR OWNER UAT; see the final dated
section below. Customer Production remains unchanged; Promotion awaits Owner acceptance.

## Original isolated Scope Contract

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

## Original isolated verification and handoff

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
Owner reported testing complete on2026-09-30 and explicitly confirmed September
revenue301600/net297600. This is accepted isolated UAT for
finance-local-yBZxPOUAhg7MyPnUVHSyw/application5a81d66624253717aa5c10f55217088e85acddfd.
The Owner reply did not individually describe annual/reload/mobile checks; their
automated evidence remains separate. Source/config/build unchanged after acceptance.
No Production UAT, data repair, activation or release is claimed.

Recommended next scope: verify current Production source and the Finance-only
diff/rollback candidate; create an exact staged Production artifact without
customer aliases; verify its Finance amounts/counts against independent real-DB
SELECTs and existing role guards. Real-data figures differ from these fixtures.
After Owner accepts that exact artifact and authorizes release, Promote it without
rebuild and check health/errors. The local Windows/disposable acceptance cannot
certify that new Vercel artifact. This plan authorizes no release action by itself;
no migration, data repair, pricing change or environment/control change is proposed.

Application/build identity and current Git/publication status are authoritative
in this worktree's PROJECT_STATE.md. Detailed private JSON/logs/screenshots:
`C:/Users/aacha/AppData/Local/Temp/finance-read-fix-20260930`.
Existing2,000 source limits/API caps and annual summary/expense date scope remain
unchanged. Broader history completeness, write flows and other portals are outside
this fix. Production still requires a separately authorized release.

## Exact staged artifact and Owner handoff — 2026-09-30

Owner approved the three-step Finance-only release-preparation plan and explicitly
reserved Promotion until their acceptance. Actor Super Admin; customer error and
intended financial behavior unchanged. Completion this round is an exact READY
staged artifact with real-read/SQL/UI evidence and Owner handoff, not customer activation.

Functional allowlist remains exactly2paths: Finance page and admin-finance-read.ts.
Test allowlist remains the2Finance scripts. This round changed0source/test/config
files and only4documentation paths: this report, PROJECT_STATE.md, TODO-CODEX.md,
DEVELOPMENT_TODO.md. Runtime diff against actual live bb5bf128 is only those2Finance
paths; public/assets/schema/dependencies/auth/pricing/all other flows are byte-identical.
Git commit/push and one exact staged Production deployment were authorized. No
Production business-data writes, fixtures, migrations, env/secrets/controls/cron/
allowlists/permission edits, customer-domain assignment, Promotion or rollback were executed.

Staged ID: **dpl_7XeXzXzHq8DYQewxSWqnv5oqfkiu**.
Exact committed/pushed Source: **d4aff85b5cdff468a101464106b5b323c97a26c6**.
Application change: **5a81d66624253717aa5c10f55217088e85acddfd**.
URL: https://new-athlete-badminton-school-i53mdksec-aachanin1s-projects.vercel.app/admin/finance
Created using --prod --skip-domain; READY, Production target, customer aliases[].
This containing documentation-only successor is not a new application build.

368uploaded files have SHA1 matching exact committed bytes.368build-input hashes
match committed bytes except the platform's build-time vercel.json representation:
its uploaded bytes match Git exactly and its build hash matches current Production
exactly (c4eeb259133149574084b73f3e55090551c166208ffba1cd7089457495c7e58f).
The initial raw-byte assertion was therefore too strict; both upload identity and
same-platform Production equality were verified before passing. Platform omits
two .gitignore files; no code omitted or new code added. No local .env/credentials
uploaded. Windows tar Unicode filename export failed before deployment; final
export reads exact Git blobs directly. Failed export evidence was retained.

Vercel production build passed; deterministic17rerun passed. Prior tsc/lint/
mojibake281/local build95/95 and isolated5+10tests remain valid because application
Source/config unchanged. Staged /api/health200/ok and anonymous Finance307to school
login passed. Owner signed in their existing Super Admin account, then Developer
checked actual staged September/annual/October/reload successfully; browser error/
warning entries0 and staged deployment-scoped error/fatal counts empty at12:56UTC.
Owner login permission is not Owner artifact acceptance. No create/delete expense
or other business mutation was exercised.

Actual697Progressive allocations hydrated697exact bookings, plus633Legacy rows.
Full Finance props equal current live baseline with transport-only substitution.
All12monthly amount/count outputs matched independent BEGIN TRANSACTION READ ONLY
SQL, without auth impersonation or business writes. Authenticated staged UI then
matched September, annual and October independently. Existing source caps remain;
all current source counts are below API caps.

| Real-data snapshot, year2569 | Revenue | Closed coach pay | Manual expenses | Net | Approved transactions |
| --- | ---: | ---: | ---: | ---: | ---: |
| September |743,235|0|0|743,235|318|
| October |234,698|0|0|234,698|69|
| Annual |3,152,284|25,500|4,200|3,122,584|1,312|

SQL snapshot2026-09-30T12:45:47Z; actual Source read12:47:44Z. Customer activity
continues, so later changes require reconciliation rather than assuming regression.
These figures differ from the disposable dataset Owner accepted earlier.

All4customer aliases and project Production target remained dpl_6jEceTi2iJ2UEgfpndeJ9zqnHJYV
before/after/final checks. Existing live Source bb5bf128 and health200/READY make it
the confirmed rollback candidate; rollback would also restore its known Finance
failure. Environment metadata unchanged. Main/other worktree8document hashes
unchanged. No broader business regression certification is claimed.

Owner UAT, existing **Super Admin** role, exact staged URL above:

1. Open /admin/finance; it must render the financial cards without page-load error.
2. Select ก.ย.2569; expected snapshot revenue/net743235, approved318, costs0.
3. Select รายปี2569; expected revenue3152284, coach25500, expenses4200, net3122584.
4. Switch ต.ค. then return ก.ย. and reload; expected October234698/net234698 and
   September cards still load. Review on phone if that is your normal usage.
5. Report PASS/FAIL for exact dpl_7XeXzXzHq8DYQewxSWqnv5oqfkiu/Source d4aff85.
   This UAT is read-only; do not add/delete expenses or write Production data.

After Owner acceptance, the reserved release step is exact Promotion of this
Production artifact without rebuild, preceded by fresh alias/live-source/rollback
checks and followed by health/error checks. No Promotion was performed this round.
Any functional/config change requires a new artifact and focused Owner retest.

Detailed private evidence directory:
C:/Users/aacha/AppData/Local/Temp/finance-read-fix-20260930/stage-20260930T1230Z
Files: scope.md, source-binding.json, uploaded-source-proof.json, build-attestation.json,
deployment.log, sql-evidence.json, real-reconciliation.json, stage-final.json,
staged-september.png/staged-annual.png and UI snapshots. Private environment and
temporary-access material remain excluded from Git.

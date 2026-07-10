const fs = require('fs')
const path = require('path')
const ts = require('typescript')
const Module = require('module')
const { createClient } = require('@supabase/supabase-js')

const DEFAULT_YEAR = 2026
const DEFAULT_MONTH = 7
const PAGE_SIZE = 1000
const IN_CHUNK_SIZE = 100
const ACTIVE_SESSION_STATUSES = new Set(['scheduled', 'completed', 'absent'])
const ACTIVE_BOOKING_STATUSES = ['pending_payment', 'paid', 'verified']

function loadProgressiveHelper() {
  const helperPath = path.join(__dirname, '..', 'src', 'lib', 'progressive-booking-pricing.ts')
  const source = fs.readFileSync(helperPath, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      strict: true,
    },
    fileName: helperPath,
  })
  const helperModule = new Module(helperPath, module)
  helperModule.filename = helperPath
  helperModule.paths = Module._nodeModulePaths(path.dirname(helperPath))
  helperModule._compile(outputText, helperPath)
  return helperModule.exports
}

const {
  buildProgressivePricingSequence,
  deriveSingleLessonPeriod,
  resolveCanonicalEntitlementSessions,
} = loadProgressiveHelper()

function parseArgs(argv) {
  const options = {
    year: DEFAULT_YEAR,
    month: DEFAULT_MONTH,
    userId: null,
    courseTypeId: null,
    json: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    const [key, inlineValue] = argument.split('=', 2)
    const nextValue = inlineValue === undefined ? argv[index + 1] : inlineValue
    if (key === '--year') {
      options.year = Number(nextValue)
      if (inlineValue === undefined) index += 1
    } else if (key === '--month') {
      options.month = Number(nextValue)
      if (inlineValue === undefined) index += 1
    } else if (key === '--user-id') {
      options.userId = nextValue
      if (inlineValue === undefined) index += 1
    } else if (key === '--course-type-id') {
      options.courseTypeId = nextValue
      if (inlineValue === undefined) index += 1
    } else if (key === '--json') {
      options.json = true
    } else if (key === '--help') {
      console.log('Usage: node scripts/check-progressive-pricing-shadow.js [--year 2026] [--month 7] [--user-id UUID] [--course-type-id UUID] [--json]')
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${argument}`)
    }
  }
  if (!Number.isInteger(options.year) || options.year < 2024) throw new Error('--year must be an integer >= 2024')
  if (!Number.isInteger(options.month) || options.month < 1 || options.month > 12) throw new Error('--month must be an integer from 1 to 12')
  return options
}

function loadLocalEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (!match) continue
    const key = match[1].trim()
    let value = match[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

function chunks(values, size = IN_CHUNK_SIZE) {
  const result = []
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size))
  return result
}

async function readAll(label, buildQuery) {
  const rows = []
  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await buildQuery(start, start + PAGE_SIZE - 1)
    if (error) {
      const wrapped = new Error(`${label}: ${error.message}`)
      wrapped.code = error.code
      wrapped.details = error.details
      throw wrapped
    }
    const page = data || []
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }
  return rows
}

async function readByIds(client, table, select, column, ids) {
  const rows = []
  for (const chunk of chunks(Array.from(new Set(ids.filter(Boolean))))) {
    rows.push(...await readAll(`${table} by ids`, (start, end) => client
      .from(table)
      .select(select)
      .in(column, chunk)
      .range(start, end)))
  }
  return rows
}

async function readOptionalByIds(client, table, select, column, ids) {
  try {
    return { rows: await readByIds(client, table, select, column, ids), available: true }
  } catch (error) {
    const message = String(error?.message || '')
    if (error?.code !== '42P01' && error?.code !== 'PGRST205' && !message.includes(table)) throw error
    return { rows: [], available: false }
  }
}

function mask(value) {
  if (!value) return 'unknown'
  const characters = Array.from(String(value))
  if (characters.length <= 2) return '*'.repeat(characters.length)
  return `${characters[0]}${'*'.repeat(Math.min(6, characters.length - 2))}${characters[characters.length - 1]}`
}

function shortId(value) {
  return value ? `${value.slice(0, 8)}...` : '-'
}

function roundCurrency(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

function getPurchasedLessonRows(sessionRows) {
  const roots = sessionRows.filter((session) => !session.is_makeup && !session.rescheduled_from_id)
  if (roots.length > 0) return roots
  const nonMakeup = sessionRows.filter((session) => !session.is_makeup)
  return nonMakeup.length > 0 ? nonMakeup : sessionRows
}

async function loadBookings(client, courseTypeId, userId) {
  const baseColumns = 'id,user_id,course_type_id,month,year,total_sessions,total_price,status,created_at,branch_id,child_id'
  const build = (columns) => readAll('active kids_group bookings', (start, end) => {
    let query = client
      .from('bookings')
      .select(columns)
      .eq('course_type_id', courseTypeId)
      .in('status', ACTIVE_BOOKING_STATUSES)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(start, end)
    if (userId) query = query.eq('user_id', userId)
    return query
  })

  try {
    return {
      rows: await build(`${baseColumns},entitlement_sessions`),
      entitlementColumnAvailable: true,
    }
  } catch (error) {
    if (error.code !== '42703' && !String(error.message).includes('entitlement_sessions')) throw error
    return {
      rows: await build(baseColumns),
      entitlementColumnAvailable: false,
    }
  }
}

function printHumanReport(report) {
  console.log('Kids Group Progressive Pricing Shadow Audit')
  console.log(`Period: ${report.period} (derived from purchased lesson dates)`)
  console.log(`Schema mode: ${report.entitlementSource}`)
  console.log(`Coupon mode: ${report.couponSource}`)
  console.log(`Filters: user=${report.filters.userId ? mask(report.filters.userId) : 'all'}, course_type=${shortId(report.filters.courseTypeId)}`)
  console.log('Mode: READ-ONLY SELECT queries; no insert/update/delete/RPC calls')
  console.log('')
  console.log('Summary')
  for (const [label, value] of Object.entries(report.summary)) console.log(`- ${label}: ${value}`)

  console.log('')
  console.log('Pending scope details')
  for (const scope of report.scopes.filter((item) => item.pendingBookings > 0)) {
    console.log(`- ${scope.maskedParent} | ${shortId(scope.maskedUserId)} | ${scope.period} | pending ${scope.pendingBookings}`)
    for (const booking of scope.bookings) {
      const flags = booking.flags.length > 0 ? ` [${booking.flags.join(', ')}]` : ''
      console.log(`  ${booking.sequence}. ${shortId(booking.bookingId)} ${booking.status} entitlement=${booking.entitlementSessions} cumulative=${booking.cumulativeSessionsAfter} gross=${booking.expectedGross} coupon=${booking.couponDiscount} final=${booking.expectedFinal} stored=${booking.storedPrice} diff=${booking.difference}${flags}`)
    }
  }

  if (report.anomalies.length > 0) {
    console.log('')
    console.log('Integration anomalies')
    for (const anomaly of report.anomalies) {
      console.log(`- ${shortId(anomaly.bookingId)} ${anomaly.code}: ${anomaly.message}`)
    }
  }

  if (report.entitlementDriftFindings.length > 0) {
    console.log('')
    console.log('Entitlement drift details')
    for (const finding of report.entitlementDriftFindings) {
      console.log(`- ${shortId(finding.bookingId)} ${finding.status}: canonical=${finding.canonicalEntitlementSessions}, raw_active=${finding.rawActiveSessionRows}, raw_all=${finding.rawAllSessionRows}`)
    }
  }

}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  loadLocalEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')

  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: kidsCourse, error: courseError } = await client
    .from('course_types')
    .select('id,name')
    .eq('name', 'kids_group')
    .single()
  if (courseError || !kidsCourse) throw new Error(`kids_group course lookup failed: ${courseError?.message || 'not found'}`)
  if (options.courseTypeId && options.courseTypeId !== kidsCourse.id) {
    throw new Error('--course-type-id must identify the kids_group course for this audit')
  }

  const bookingLoad = await loadBookings(client, kidsCourse.id, options.userId)
  const bookingIds = bookingLoad.rows.map((booking) => booking.id)
  const sessionRows = await readByIds(
    client,
    'booking_sessions',
    'id,booking_id,date,status,rescheduled_from_id,is_makeup',
    'booking_id',
    bookingIds,
  )
  const couponRows = await readByIds(
    client,
    'coupon_usages',
    'id,booking_id,discount_amount',
    'booking_id',
    bookingIds,
  )
  const progressiveCouponLoad = await readOptionalByIds(
    client,
    'progressive_coupon_reservations',
    'id,booking_id,status,discount_amount_snapshot',
    'booking_id',
    bookingIds,
  )

  const tiers = await readAll('kids_group pricing tiers', (start, end) => client
    .from('pricing_tiers')
    .select('id,min_sessions,max_sessions,price_per_session,valid_from,valid_to')
    .eq('course_type_id', kidsCourse.id)
    .order('min_sessions', { ascending: true })
    .range(start, end))
  const today = new Date().toISOString().slice(0, 10)
  const activeTiers = tiers
    .filter((tier) => (!tier.valid_from || tier.valid_from <= today) && (!tier.valid_to || tier.valid_to >= today))
    .map((tier) => ({
      id: tier.id,
      minSessions: Number(tier.min_sessions),
      maxSessions: tier.max_sessions === null ? null : Number(tier.max_sessions),
      ratePerSession: Number(tier.price_per_session),
    }))

  const sessionsByBooking = new Map()
  for (const session of sessionRows) {
    const rows = sessionsByBooking.get(session.booking_id) || []
    rows.push(session)
    sessionsByBooking.set(session.booking_id, rows)
  }
  const couponByBooking = new Map()
  for (const coupon of couponRows) {
    couponByBooking.set(
      coupon.booking_id,
      roundCurrency((couponByBooking.get(coupon.booking_id) || 0) + Number(coupon.discount_amount || 0)),
    )
  }
  for (const reservation of progressiveCouponLoad.rows) {
    if (!['reserved', 'consumed'].includes(reservation.status)) continue
    couponByBooking.set(
      reservation.booking_id,
      roundCurrency(Number(reservation.discount_amount_snapshot || 0)),
    )
  }

  const periodKey = `${options.year}-${String(options.month).padStart(2, '0')}`
  const integrations = []
  const anomalies = []
  for (const booking of bookingLoad.rows) {
    const sessions = sessionsByBooking.get(booking.id) || []
    const purchasedRows = getPurchasedLessonRows(sessions)
    const lessonPeriod = deriveSingleLessonPeriod(purchasedRows.map((session) => session.date))
    if (!lessonPeriod.ok) {
      const candidatePeriods = new Set(purchasedRows.map((session) => String(session.date).slice(0, 7)))
      if (candidatePeriods.has(periodKey) || (booking.year === options.year && booking.month === options.month)) {
        anomalies.push({ bookingId: booking.id, ...lessonPeriod.error })
      }
      continue
    }
    if (lessonPeriod.value.key !== periodKey) continue

    const canonical = resolveCanonicalEntitlementSessions(
      bookingLoad.entitlementColumnAvailable ? booking.entitlement_sessions : null,
      Number(booking.total_sessions),
    )
    if (!canonical.ok) {
      anomalies.push({ bookingId: booking.id, ...canonical.error })
      continue
    }

    const rawActiveSessionRows = sessions.filter((session) => ACTIVE_SESSION_STATUSES.has(session.status)).length
    integrations.push({
      booking,
      canonicalEntitlementSessions: canonical.value,
      rawActiveSessionRows,
      rawAllSessionRows: sessions.length,
      couponDiscount: couponByBooking.get(booking.id) || 0,
      period: lessonPeriod.value,
    })
  }

  const profileRows = await readByIds(
    client,
    'profiles',
    'id,full_name,email',
    'id',
    integrations.map((item) => item.booking.user_id),
  )
  const profilesById = new Map(profileRows.map((profile) => [profile.id, profile]))

  const scopeMap = new Map()
  for (const integration of integrations) {
    const scopeKey = `${integration.booking.user_id}|${kidsCourse.id}|${periodKey}|THB`
    const rows = scopeMap.get(scopeKey) || []
    rows.push(integration)
    scopeMap.set(scopeKey, rows)
  }

  const scopeResults = []
  for (const [scopeKey, scopeRows] of scopeMap) {
    const sequence = buildProgressivePricingSequence({
      bookings: scopeRows.map((row) => ({
        id: row.booking.id,
        createdAt: row.booking.created_at,
        status: row.booking.status,
        entitlementSessions: row.canonicalEntitlementSessions,
        storedPrice: Number(row.booking.total_price),
        couponDiscount: row.couponDiscount,
      })),
      pricingTiers: activeTiers,
    })
    const userId = scopeRows[0].booking.user_id
    const profile = profilesById.get(userId)
    scopeResults.push({ scopeKey, userId, profile, scopeRows, sequence })
  }

  let matchCount = 0
  let overpricedCount = 0
  let overpricedAmount = 0
  let underpricedCount = 0
  let underpricedAmount = 0
  let pendingBookings = 0
  let entitlementDriftCount = 0
  let rawLineageExpansionCount = 0
  let dependencyChainCount = 0
  let missingTierCount = 0
  const entitlementDriftFindings = []
  const scopes = []

  for (const scope of scopeResults) {
    const integrationByBooking = new Map(scope.scopeRows.map((row) => [row.booking.id, row]))
    if (!scope.sequence.ok) {
      if (scope.sequence.error.code === 'MISSING_TIER') missingTierCount += 1
      anomalies.push({ bookingId: scope.sequence.error.bookingId || null, ...scope.sequence.error })
      continue
    }

    const pendingItems = scope.sequence.value.items.filter((item) => item.status === 'pending_payment')
    if (pendingItems.some((item) => item.pendingDependencyBookingIds.length > 0)) dependencyChainCount += 1
    const bookingResults = scope.sequence.value.items.map((item) => {
      const integration = integrationByBooking.get(item.bookingId)
      const flags = []
      if (integration.canonicalEntitlementSessions !== integration.rawActiveSessionRows) {
        flags.push('ENTITLEMENT_DRIFT')
        entitlementDriftCount += 1
        entitlementDriftFindings.push({
          bookingId: item.bookingId,
          status: item.status,
          canonicalEntitlementSessions: integration.canonicalEntitlementSessions,
          rawActiveSessionRows: integration.rawActiveSessionRows,
          rawAllSessionRows: integration.rawAllSessionRows,
        })
      }
      if (integration.rawAllSessionRows !== integration.canonicalEntitlementSessions) {
        flags.push('RAW_LINEAGE_EXPANSION')
        rawLineageExpansionCount += 1
      }
      if (item.pendingDependencyBookingIds.length > 0) flags.push('PAYMENT_DEPENDENCY')

      if (item.status === 'pending_payment') {
        pendingBookings += 1
        if (item.priceClassification === 'MATCH') matchCount += 1
        if (item.priceClassification === 'OVERPRICED') {
          overpricedCount += 1
          overpricedAmount += item.storedPriceDifference
        }
        if (item.priceClassification === 'UNDERPRICED') {
          underpricedCount += 1
          underpricedAmount += Math.abs(item.storedPriceDifference)
        }
        flags.unshift(item.priceClassification)
      } else {
        flags.unshift('HISTORICAL')
      }

      return {
        bookingId: item.bookingId,
        sequence: item.sequence,
        status: item.status,
        entitlementSessions: item.newBookingEntitlementSessions,
        rawActiveSessionRows: integration.rawActiveSessionRows,
        rawAllSessionRows: integration.rawAllSessionRows,
        cumulativeSessionsAfter: item.cumulativeSessionsAfter,
        selectedTierId: item.selectedTier.id,
        ratePerSession: item.ratePerSession,
        expectedGross: item.grossBookingPrice,
        couponDiscount: item.couponDiscount,
        expectedFinal: item.finalBookingPrice,
        storedPrice: item.storedPrice,
        difference: item.storedPriceDifference,
        dependencyBookingIds: item.pendingDependencyBookingIds,
        flags,
      }
    })

    scopes.push({
      maskedUserId: mask(scope.userId),
      maskedParent: mask(scope.profile?.full_name || scope.profile?.email || scope.userId),
      course: 'kids_group',
      period: periodKey,
      currency: 'THB',
      activeBookings: bookingResults.length,
      pendingBookings: pendingItems.length,
      bookings: bookingResults,
    })
  }

  scopes.sort((left, right) => right.pendingBookings - left.pendingBookings || left.maskedUserId.localeCompare(right.maskedUserId))
  const report = {
    generatedAt: new Date().toISOString(),
    period: periodKey,
    entitlementSource: bookingLoad.entitlementColumnAvailable
      ? 'bookings.entitlement_sessions with total_sessions fallback'
      : 'legacy fallback: bookings.total_sessions (remote additive migration not applied)',
    couponSource: progressiveCouponLoad.available
      ? 'progressive_coupon_reservations with legacy coupon_usages fallback'
      : 'legacy coupon_usages (progressive coupon migration not applied)',
    filters: {
      userId: options.userId,
      courseTypeId: kidsCourse.id,
    },
    summary: {
      totalScopes: scopeResults.length,
      totalActiveBookings: integrations.length,
      pendingBookings,
      matchCount,
      overpricedCount,
      overpricedAmount: roundCurrency(overpricedAmount),
      underpricedCount,
      underpricedAmount: roundCurrency(underpricedAmount),
      entitlementDriftCount,
      rawLineageExpansionCount,
      multiMonthCount: anomalies.filter((item) => item.code === 'MULTI_MONTH_BOOKING').length,
      missingTierCount,
      dependencyChainCount,
    },
    scopes,
    anomalies,
    entitlementDriftFindings,
  }

  if (options.json) console.log(JSON.stringify(report, null, 2))
  else printHumanReport(report)
}

main().catch((error) => {
  console.error(`Progressive pricing shadow audit failed: ${error.message}`)
  process.exitCode = 1
})

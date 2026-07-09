const assert = require('assert')
const fs = require('fs')
const path = require('path')
const ts = require('typescript')
const Module = require('module')

const pricingPath = path.join(__dirname, '..', 'src', 'lib', 'pricing.ts')
const source = fs.readFileSync(pricingPath, 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
  fileName: pricingPath,
})

const pricingModule = new Module(pricingPath, module)
pricingModule.filename = pricingPath
pricingModule.paths = Module._nodeModulePaths(path.dirname(pricingPath))
pricingModule._compile(outputText, pricingPath)

const { getAdultGroupTotal, getKidsGroupIncremental, getKidsGroupTotal } = pricingModule.exports

function check(name, actual, expected) {
  assert.deepStrictEqual(actual, expected, name)
  console.log(`PASS ${name}`)
}

check(
  'single booking 16 sessions uses 15-18 tier',
  getKidsGroupTotal(16),
  { total: 6496, perSession: 406, tierLabel: '15-18 ครั้ง' },
)

check(
  'first split booking 8 sessions charges 7-10 tier',
  getKidsGroupIncremental(0, 0, 8),
  {
    incrementalPrice: 4000,
    rawCharge: 4000,
    creditDifference: 0,
    existingPaid: 0,
    perSession: 500,
    tierLabel: '7-10 ครั้ง',
    newSessions: 8,
    totalSessionsForMonth: 8,
    totalCostForMonth: 4000,
    effectivePerSession: 500,
  },
)

check(
  'second split booking true-ups monthly total to 16 sessions',
  getKidsGroupIncremental(8, 4000, 8),
  {
    incrementalPrice: 2496,
    rawCharge: 2496,
    creditDifference: 0,
    existingPaid: 4000,
    perSession: 406,
    tierLabel: '15-18 ครั้ง',
    newSessions: 8,
    totalSessionsForMonth: 16,
    totalCostForMonth: 6496,
    effectivePerSession: 312,
  },
)

check(
  'existing 8 sessions then add 1 keeps 7-10 tier and charges one more session',
  getKidsGroupIncremental(8, 4000, 1),
  {
    incrementalPrice: 500,
    rawCharge: 500,
    creditDifference: 0,
    existingPaid: 4000,
    perSession: 500,
    tierLabel: '7-10 ครั้ง',
    newSessions: 1,
    totalSessionsForMonth: 9,
    totalCostForMonth: 4500,
    effectivePerSession: 500,
  },
)

check(
  'brand-new kids_group 1 session charges 700',
  getKidsGroupIncremental(0, 0, 1).incrementalPrice,
  700,
)

check(
  'paid 1 session 700 then add 1 charges 550',
  getKidsGroupIncremental(1, 700, 1).incrementalPrice,
  550,
)

check(
  'paid 2 sessions 1250 then add 1 charges 625',
  getKidsGroupIncremental(2, 1250, 1).incrementalPrice,
  625,
)

check(
  'paid 6 sessions 3750 then add 1 uses credit difference and charges 0',
  getKidsGroupIncremental(6, 3750, 1),
  {
    incrementalPrice: 0,
    rawCharge: -250,
    creditDifference: 250,
    existingPaid: 3750,
    perSession: 500,
    tierLabel: '7-10 ครั้ง',
    newSessions: 1,
    totalSessionsForMonth: 7,
    totalCostForMonth: 3500,
    effectivePerSession: 0,
  },
)

check(
  'paid 6 sessions 3750 then add 2 charges 250',
  getKidsGroupIncremental(6, 3750, 2).incrementalPrice,
  250,
)

check(
  'previous pending 1 session is ignored by settled-only true-up',
  getKidsGroupIncremental(0, 0, 1).incrementalPrice,
  700,
)

check(
  'affected 9112a5cb recomputes to 500 with only settled 8 sessions',
  getKidsGroupIncremental(8, 4000, 1).incrementalPrice,
  500,
)

check(
  'affected 60779d60 recomputes to 500 with only settled 8 sessions',
  getKidsGroupIncremental(8, 4000, 1).incrementalPrice,
  500,
)

check(
  'adult 1 session unchanged',
  getAdultGroupTotal(1),
  { total: 600, perSession: 600, tierLabel: 'รายครั้ง' },
)

check(
  'adult 10-session package unchanged',
  getAdultGroupTotal(10),
  { total: 5500, perSession: 550, tierLabel: '10 ครั้ง' },
)

console.log('Pricing true-up checks passed.')

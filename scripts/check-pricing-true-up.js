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

const { getKidsGroupIncremental, getKidsGroupTotal } = pricingModule.exports

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
    perSession: 500,
    tierLabel: '7-10 ครั้ง',
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
    perSession: 406,
    tierLabel: '15-18 ครั้ง',
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
    perSession: 500,
    tierLabel: '7-10 ครั้ง',
    totalSessionsForMonth: 9,
    totalCostForMonth: 4500,
    effectivePerSession: 500,
  },
)

console.log('Pricing true-up checks passed.')

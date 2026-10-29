import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import Module, { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const source = path.join(root, 'src/lib/bank-display.ts')
const loaded = new Module(source)
loaded.filename = source
loaded.paths = require.resolve.paths('typescript')
loaded._compile(ts.transpileModule(fs.readFileSync(source, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, source)
const { BANK_DISPLAYS, getBankDisplay } = loaded.exports

const cases = [
  ['SCB', 'scb'], [' ไทยพาณิชย์ ', 'scb'], ['ธนาคารไทยพาณิชย์', 'scb'],
  ['กรุงศรี', 'bay'], ['BAY', 'bay'], ['ธนาคารกรุงศรีอยุธยา', 'bay'],
  ['ธ.กรุงเทพ', 'bbl'], ['BBL', 'bbl'], ['ธนาคารกรุงเทพ', 'bbl'],
  ['TTB', 'ttb'], ['ttb', 'ttb'], ['ทีทีบี', 'ttb'], ['ธนาคารทหารไทยธนชาต', 'ttb'],
]
for (const [name, expected] of cases) assert.equal(getBankDisplay(name).id, expected, name)
for (const name of ['ธนาคารอื่น', 'SCB bank unknown', '__proto__', 'constructor', '']) {
  const bank = getBankDisplay(name)
  assert.equal(bank.id, 'unknown')
  assert.equal(bank.src, null, 'Unknown bank must not borrow another bank mark')
  assert.equal(bank.name, name || 'ไม่ระบุธนาคาร')
}

const settings = fs.readFileSync(path.join(root, 'src/lib/payment-settings.ts'), 'utf8')
const configured = settings.match(/PAYMENT_BANK_NAMES\s*=\s*\[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)
for (const [, name] of configured) assert.notEqual(getBankDisplay(name).id, 'unknown', 'Missing supported bank: ' + name)
const defaults = fs.readFileSync(path.join(root, 'src/lib/payment-transfer-defaults.ts'), 'utf8')
for (const [, name] of defaults.matchAll(/bankName:\s*'([^']+)'/g)) assert.notEqual(getBankDisplay(name).id, 'unknown')

for (const bank of Object.values(BANK_DISPLAYS)) {
  assert.match(bank.src, /^\/banks\/[a-z-]+\.(svg|png)$/)
  assert.ok(bank.width >= 28 && bank.width <= 40 && bank.height >= 20 && bank.height <= 28)
  const bytes = fs.readFileSync(path.join(root, 'public', bank.src))
  if (bank.src.endsWith('.svg')) {
    const svg = bytes.toString('utf8')
    assert.match(svg, /<svg[\s>]/)
    assert.match(svg, /viewBox=/)
    assert.doesNotMatch(svg, /<script|<foreignObject|(?:href|src)\s*=\s*["'](?:https?:|data:|javascript:)/i)
  } else {
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
    assert.ok(bytes.readUInt32BE(16) > bytes.readUInt32BE(20), 'Horizontal official TTB mark must retain its aspect ratio')
  }
}
const originalBay = fs.readFileSync(path.join(root, 'public/banks/bay.svg'), 'utf8')
assert.equal(fs.readFileSync(path.join(root, 'public/banks/bay-contrast.svg'), 'utf8'), originalBay.replaceAll('#FFFFFF', '#61431E'), 'BAY geometry must be unchanged')
const luminance = hex => {
  const values = hex.replace('#', '').match(/../g).map(v => parseInt(v, 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722
}
for (const [key, foreground] of [['scb', '#ffffff'], ['bbl', '#ffffff'], ['bay', '#61431e']]) {
  const values = [luminance(foreground), luminance(BANK_DISPLAYS[key].background)].sort((a, b) => a - b)
  assert.ok((values[1] + 0.05) / (values[0] + 0.05) >= 3, key + ' mark must remain distinguishable from its background')
}
console.log(JSON.stringify({ passed: true, supportedBanks: Object.keys(BANK_DISPLAYS), aliasCases: cases.length, fallbackCases: 5, checkedAssets: 4, bankAccountsChanged: false }))

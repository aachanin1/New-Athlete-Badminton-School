const fs = require('fs')
const path = require('path')

const ROOT = process.cwd()
const SCAN_TARGETS = [
  'src',
  'docs',
  'DEVELOPMENT_TODO.md',
  'README.md',
  'TODO.md',
  'IMPLEMENTATION_PLAN.md',
  'TESTING_GUIDE.md',
  'SETUP_GUIDE.md',
]

const TEXT_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.md',
  '.mdx',
  '.css',
  '.json',
  '.sql',
])

const SKIP_DIRS = new Set(['.git', '.next', 'node_modules'])

const MOJIBAKE_PATTERNS = [
  /เธ/g,
  /เน€/g,
  /โ€/g,
  /โ–/g,
  /โ/g,
  /(^|\s)ยท(\s|$)/g,
  /�/g,
]

function shouldScanFile(filePath) {
  return TEXT_EXTENSIONS.has(path.extname(filePath))
}

function walk(target, files = []) {
  const absolute = path.join(ROOT, target)
  if (!fs.existsSync(absolute)) return files

  const stat = fs.statSync(absolute)
  if (stat.isFile()) {
    if (shouldScanFile(absolute)) files.push(absolute)
    return files
  }

  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      walk(path.join(target, entry.name), files)
    } else if (entry.isFile()) {
      const filePath = path.join(absolute, entry.name)
      if (shouldScanFile(filePath)) files.push(filePath)
    }
  }

  return files
}

function findMatches(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  const lines = text.split(/\r?\n/)
  const matches = []

  lines.forEach((line, index) => {
    if (MOJIBAKE_PATTERNS.some((pattern) => {
      pattern.lastIndex = 0
      return pattern.test(line)
    })) {
      matches.push({
        line: index + 1,
        text: line.trim().slice(0, 180),
      })
    }
  })

  return matches
}

const files = Array.from(new Set(SCAN_TARGETS.flatMap((target) => walk(target))))
const problems = []

for (const file of files) {
  const matches = findMatches(file)
  if (matches.length > 0) {
    problems.push({
      file: path.relative(ROOT, file),
      matches,
    })
  }
}

if (problems.length > 0) {
  console.error('Mojibake guard failed: found likely garbled Thai text.\n')
  for (const problem of problems) {
    console.error(problem.file)
    for (const match of problem.matches.slice(0, 8)) {
      console.error(`  ${match.line}: ${match.text}`)
    }
    if (problem.matches.length > 8) {
      console.error(`  ...and ${problem.matches.length - 8} more lines`)
    }
  }
  console.error('\nFix the text encoding/copy before continuing.')
  process.exit(1)
}

console.log(`Mojibake guard passed (${files.length} files scanned).`)

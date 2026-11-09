/**
 * Lighthouse performance check with a fixed method, so results stay comparable over time.
 *
 * Usage:
 *   pnpm perf -- <url> --pr https://github.com/paulliep2206/zlatashop/pull/7 [--spec "Image sizing"] [--page Home] [--notes "..."] [--dry-run]
 *   pnpm perf -- <url> --label Baseline [--page Home] [--notes "..."] [--dry-run]
 *
 * Runs Lighthouse 3 times (mobile, headless Chrome, pinned version), takes the per-metric
 * median and appends one row to each table in docs/performance/results.md ("Core results" and
 * "Other category scores (medians)"). --pr takes the PR link or just its number. The Core row links to the PR, the other row
 * says "PR #N", matching the existing rows. --dry-run only prints the rows.
 * Raw reports are saved to lighthouse-reports/ (git-ignored).
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

const LIGHTHOUSE = 'lighthouse@12.8.2'
const RUNS = 3
const REPORT_DIR = 'lighthouse-reports'
const RESULTS_FILE = 'docs/performance/results.md'
const REPO_URL = 'https://github.com/paulliep2206/zlatashop'
const CORE_HEADING = '## Core results'
const OTHER_HEADING = '## Other category scores (medians)'
const USAGE =
  'Usage: pnpm perf -- <url> (--pr <PR link or number> [--spec "..."] | --label "...") [--page Home] [--notes "..."] [--dry-run]'

type Report = {
  lighthouseVersion: string
  runtimeError?: { code: string; message: string }
  runWarnings: string[]
  categories: Record<string, { score: number | null }>
  audits: Record<string, { numericValue?: number }>
}

type RunResult = {
  perf: number
  a11y: number
  bestPractices: number
  seo: number
  lcpMs: number
  cls: number
  tbtMs: number
}

function fail(message: string): never {
  console.error(`\nperf: ${message}`)
  process.exit(1)
}

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const pageFromUrl = (url: URL): string => {
  const first = url.pathname.split('/').filter(Boolean)[0]
  if (!first) return 'Home'
  if (first === 'category') return 'Category'
  if (first === 'products') return 'Product'
  return first.charAt(0).toUpperCase() + first.slice(1)
}

const score = (report: Report, id: string): number => {
  const value = report.categories[id]?.score
  if (value == null) fail(`category "${id}" has no score`)
  return Math.round(value * 100)
}

const metric = (report: Report, id: string): number => {
  const value = report.audits[id]?.numericValue
  if (value == null) fail(`audit "${id}" has no value`)
  return value
}

const formatLcp = (ms: number): string => `${(ms / 1000).toFixed(1)} s`
const formatCls = (cls: number): string => (cls === 0 ? '0' : cls.toFixed(3))
const formatTbt = (ms: number): string => `${Math.round(ms)} ms`

const { values, positionals } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  allowPositionals: true,
  options: {
    label: { type: 'string' },
    pr: { type: 'string' },
    spec: { type: 'string' },
    page: { type: 'string' },
    notes: { type: 'string' },
    'dry-run': { type: 'boolean' },
  },
})

const rawUrl = positionals[0]
if (!rawUrl) fail(`missing URL. ${USAGE}`)
if (positionals.length > 1) {
  fail(
    `unexpected arguments: ${positionals.slice(1).join(' ')}\n` +
      `Quote values that contain spaces or #, e.g. --spec "Image sizing". ${USAGE}`,
  )
}
// --pr accepts a pasted GitHub PR link (kept as is) or a bare number (linked to this repo).
const prMatch = values.pr
  ?.trim()
  .match(/^(?:(https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/(\d+))\S*|#?(\d+))$/)
if (values.pr && !prMatch) {
  fail(`--pr must be a GitHub PR link or number, got "${values.pr}"`)
}
const prNumber = prMatch ? (prMatch[2] ?? prMatch[3]) : undefined
const prUrl = prMatch ? (prMatch[1] ?? `${REPO_URL}/pull/${prNumber}`) : undefined
if (values.pr && values.label) fail('use either --pr or --label, not both')
if (!values.pr && !values.label && !values.spec) fail(`missing --pr, --spec or --label. ${USAGE}`)

let url: URL
try {
  url = new URL(rawUrl)
} catch {
  fail(`invalid URL: ${rawUrl}`)
}

const page = values.page ?? pageFromUrl(url)
// Core table links the PR and adds the spec in brackets; the other table uses the short form.
const coreLabel = prNumber
  ? `[PR #${prNumber}](${prUrl})${values.spec ? ` (${values.spec})` : ''}`
  : (values.label ?? values.spec ?? '')
const otherLabel = prNumber ? `PR #${prNumber}` : (values.label ?? values.spec ?? '')
const date = new Date().toISOString().slice(0, 10)
const toSlug = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, '-')
const slug = toSlug(page)
// Label in the file name so a second measurement on the same day doesn't overwrite the first.
const reportPrefix = `${date}-${toSlug(otherLabel)}-${slug}`

mkdirSync(REPORT_DIR, { recursive: true })

console.log(`${LIGHTHOUSE}, mobile, ${RUNS} runs: ${url.href}`)

const results: RunResult[] = []
for (let run = 1; run <= RUNS; run++) {
  const outputPath = path.join(REPORT_DIR, `${reportPrefix}-run${run}.json`)
  const started = Date.now()
  process.stdout.write(`  run ${run}/${RUNS}... `)

  const child = spawnSync(
    'npx',
    [
      '--yes',
      LIGHTHOUSE,
      url.href,
      '--output=json',
      `--output-path=${outputPath}`,
      '--chrome-flags=--headless=new',
      '--quiet',
    ],
    { encoding: 'utf8' },
  )

  if (child.error) fail(`could not start npx: ${child.error.message}`)
  if (child.status !== 0) {
    const output = `${child.stderr ?? ''}${child.stdout ?? ''}`.trim()
    if (/chrome/i.test(output) && /(not found|no chrome|launch)/i.test(output)) {
      fail(
        `Lighthouse could not find or launch Chrome. Install Google Chrome or set CHROME_PATH.\n${output}`,
      )
    }
    fail(`Lighthouse exited with code ${child.status}.\n${output}`)
  }

  let report: Report
  try {
    report = JSON.parse(readFileSync(outputPath, 'utf8')) as Report
  } catch (error) {
    fail(`could not read report ${outputPath}: ${(error as Error).message}`)
  }

  if (report.runtimeError) {
    fail(
      `run ${run} had a runtime error: ${report.runtimeError.code} ${report.runtimeError.message}`,
    )
  }
  if (report.lighthouseVersion !== LIGHTHOUSE.split('@')[1]) {
    fail(`expected Lighthouse ${LIGHTHOUSE}, got ${report.lighthouseVersion}`)
  }

  const result: RunResult = {
    perf: score(report, 'performance'),
    a11y: score(report, 'accessibility'),
    bestPractices: score(report, 'best-practices'),
    seo: score(report, 'seo'),
    lcpMs: metric(report, 'largest-contentful-paint'),
    cls: metric(report, 'cumulative-layout-shift'),
    tbtMs: metric(report, 'total-blocking-time'),
  }
  results.push(result)

  const seconds = Math.round((Date.now() - started) / 1000)
  const warnings = report.runWarnings.length ? `, ${report.runWarnings.length} warning(s)` : ''
  console.log(
    `perf ${result.perf}, LCP ${formatLcp(result.lcpMs)}, CLS ${formatCls(result.cls)}, ` +
      `TBT ${formatTbt(result.tbtMs)} (${seconds}s${warnings})`,
  )
}

const pick = (key: keyof RunResult): number[] => results.map((r) => r[key])
const range = (key: keyof RunResult, format: (n: number) => string = String): string => {
  const list = pick(key)
  return `${format(Math.min(...list))}–${format(Math.max(...list))}`
}

const m = {
  perf: Math.round(median(pick('perf'))),
  a11y: Math.round(median(pick('a11y'))),
  bestPractices: Math.round(median(pick('bestPractices'))),
  seo: Math.round(median(pick('seo'))),
  lcpMs: median(pick('lcpMs')),
  cls: median(pick('cls')),
  tbtMs: median(pick('tbtMs')),
}

const clsRuns = pick('cls').filter((cls) => cls > 0).length
const autoNotes = [
  `Perf ${range('perf')}, LCP ${range('lcpMs', formatLcp)} across runs`,
  clsRuns ? `CLS > 0 in ${clsRuns} of ${RUNS} runs` : '',
]
  .filter(Boolean)
  .join('; ')
const notes = values.notes ? `${values.notes}; ${autoNotes}` : autoNotes

const cell = (value: string | number): string => String(value).replace(/\|/g, '\\|')
const row = (cells: (string | number)[]): string => `| ${cells.map(cell).join(' | ')} |`

// Inserts the row after the last line of the first table below the heading.
const appendRow = (markdown: string, heading: string, newRow: string): string => {
  const lines = markdown.split('\n')
  const start = lines.findIndex((line) => line.trim() === heading)
  if (start === -1) fail(`heading "${heading}" not found in ${RESULTS_FILE}`)
  let end = start + 1
  while (end < lines.length && !lines[end].startsWith('|')) {
    if (lines[end].startsWith('#')) fail(`no table under "${heading}" in ${RESULTS_FILE}`)
    end++
  }
  if (end === lines.length) fail(`no table under "${heading}" in ${RESULTS_FILE}`)
  while (end < lines.length && lines[end].startsWith('|')) end++
  lines.splice(end, 0, newRow)
  return lines.join('\n')
}

const coreRow = row([
  date,
  coreLabel,
  page,
  m.perf,
  formatLcp(m.lcpMs),
  formatCls(m.cls),
  formatTbt(m.tbtMs),
  notes,
])
const otherRow = row([date, otherLabel, page, m.a11y, m.bestPractices, m.seo])

console.log('\nCore results row:')
console.log(coreRow)
console.log('\nOther category scores row:')
console.log(otherRow)
console.log(`\nRaw reports: ${REPORT_DIR}/${reportPrefix}-run{1..${RUNS}}.json`)

if (values['dry-run']) {
  console.log(`\n--dry-run: ${RESULTS_FILE} not changed.`)
} else {
  const markdown = readFileSync(RESULTS_FILE, 'utf8')
  const updated = appendRow(appendRow(markdown, CORE_HEADING, coreRow), OTHER_HEADING, otherRow)
  writeFileSync(RESULTS_FILE, updated)
  console.log(`\nAppended both rows to ${RESULTS_FILE}. Review with: git diff ${RESULTS_FILE}`)
}

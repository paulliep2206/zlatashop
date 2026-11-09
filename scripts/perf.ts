/**
 * Lighthouse performance check with a fixed method, so results stay comparable over time.
 *
 * Usage:
 *   pnpm perf -- <url> [--label "PR #7"] [--page Home] [--notes "..."]
 *
 * Runs Lighthouse 3 times (mobile, headless Chrome, pinned version), takes the per-metric
 * median and prints rows ready to paste into docs/performance/results.md.
 * Raw reports are saved to lighthouse-reports/ (git-ignored).
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

const LIGHTHOUSE = 'lighthouse@12.8.2'
const RUNS = 3
const REPORT_DIR = 'lighthouse-reports'

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
    page: { type: 'string' },
    notes: { type: 'string' },
  },
})

const rawUrl = positionals[0]
if (!rawUrl) fail('missing URL. Usage: pnpm perf -- <url> [--label "PR #7"] [--page Home]')

let url: URL
try {
  url = new URL(rawUrl)
} catch {
  fail(`invalid URL: ${rawUrl}`)
}

const page = values.page ?? pageFromUrl(url)
const label = values.label ?? '?'
const date = new Date().toISOString().slice(0, 10)
const slug = page.toLowerCase().replace(/[^a-z0-9]+/g, '-')

mkdirSync(REPORT_DIR, { recursive: true })

console.log(`${LIGHTHOUSE}, mobile, ${RUNS} runs: ${url.href}`)

const results: RunResult[] = []
for (let run = 1; run <= RUNS; run++) {
  const outputPath = path.join(REPORT_DIR, `${date}-${slug}-run${run}.json`)
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
      fail(`Lighthouse could not find or launch Chrome. Install Google Chrome or set CHROME_PATH.\n${output}`)
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
    fail(`run ${run} had a runtime error: ${report.runtimeError.code} ${report.runtimeError.message}`)
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

const row = (cells: (string | number)[]): string => `| ${cells.join(' | ')} |`

console.log('\nCore results row:')
console.log(
  row([date, label, page, m.perf, formatLcp(m.lcpMs), formatCls(m.cls), formatTbt(m.tbtMs), notes]),
)
console.log('\nOther category scores row:')
console.log(row([date, label, page, m.a11y, m.bestPractices, m.seo]))
console.log(`\nRaw reports: ${REPORT_DIR}/${date}-${slug}-run{1..${RUNS}}.json`)

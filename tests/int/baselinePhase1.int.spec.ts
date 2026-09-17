import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import {
  assertPhase1Target,
  assertPhase1Arguments,
  PHASE1_ACKNOWLEDGEMENT,
  PHASE1_TARGET_ID,
} from '../../scripts/baseline/phase1.mjs'

const safeTarget = {
  acknowledgement: PHASE1_ACKNOWLEDGEMENT,
  databaseURL: 'postgresql://baseline_runner:local@127.0.0.1:55432/bookstore_baseline_phase1',
  expectedTarget: PHASE1_TARGET_ID,
  nodeEnv: 'development',
}

describe('Phase 1 database target guard', () => {
  it('accepts only the dedicated loopback database', () => {
    expect(
      assertPhase1Target({
        ...safeTarget,
      }),
    ).toMatchObject({
      database: 'bookstore_baseline_phase1',
      host: '127.0.0.1',
      port: '55432',
    })
  })

  it.each([
    'postgresql://baseline_runner:secret@example.com:55432/bookstore_baseline_phase1',
    'postgresql://baseline_runner:secret@localhost:55432/bookstore_baseline_phase1',
    'postgresql://baseline_runner:secret@127.0.0.1:5432/bookstore_baseline_phase1',
    'postgresql://baseline_runner:secret@127.0.0.1:55432/bookstore_dev',
    'postgresql://baseline_runner:secret@db.production.example:55432/bookstore_baseline_phase1',
    'postgresql://wrong_user:secret@127.0.0.1:55432/bookstore_baseline_phase1',
    'mongodb://baseline_runner:secret@127.0.0.1:55432/bookstore_baseline_phase1',
  ])('rejects an unsafe target: %s', (databaseURL) => {
    expect(() => assertPhase1Target({ ...safeTarget, databaseURL })).toThrow()
  })

  it('rejects production NODE_ENV', () => {
    expect(() => assertPhase1Target({ ...safeTarget, nodeEnv: 'production' })).toThrow(/prohibited/)
  })

  it('requires the explicit Phase 1 acknowledgement', () => {
    expect(() => assertPhase1Target({ ...safeTarget, acknowledgement: undefined })).toThrow(
      /BASELINE_PHASE1_ACK/,
    )
  })

  it('requires the independently supplied target identifier', () => {
    expect(() =>
      assertPhase1Target({
        ...safeTarget,
        expectedTarget: 'derived-from-url',
      }),
    ).toThrow(/BASELINE_EXPECTED_TARGET/)
  })
})

describe('candidate baseline artifacts', () => {
  const migrationStem = '20260912_131510_baseline_candidate'
  const migrationDir = path.resolve(process.cwd(), 'src/migrations')

  it('commits the Payload migration, snapshot, and index', () => {
    const index = readFileSync(path.join(migrationDir, 'index.ts'), 'utf8')
    const snapshot = JSON.parse(
      readFileSync(path.join(migrationDir, `${migrationStem}.json`), 'utf8'),
    )

    expect(index).toContain(migrationStem)
    expect(snapshot).toBeTypeOf('object')
  })

  it('keeps destructive and data-mutating statements out of candidate up', () => {
    const migration = readFileSync(path.join(migrationDir, `${migrationStem}.ts`), 'utf8')
    const up = migration.split('export async function down')[0]

    expect(up).not.toMatch(/^\s*(DROP|TRUNCATE|RENAME|INSERT INTO|DELETE FROM)\b/im)
    expect(up).not.toMatch(/^\s*UPDATE\s+.+\s+SET\b/im)
    expect(up).not.toMatch(/\bALTER\s+(?:TABLE|TYPE|INDEX)\b[^;]*\bRENAME\b/i)
  })

  it('makes direct and generic baseline down invocation refuse without using the database', async () => {
    const migration = await import('../../src/migrations/20260912_131510_baseline_candidate')
    const execute = vi.fn()

    await expect(migration.down({ db: { execute } } as never)).rejects.toThrow(
      /Baseline rollback is unsupported/,
    )
    expect(execute).not.toHaveBeenCalled()

    const source = readFileSync(path.join(migrationDir, `${migrationStem}.ts`), 'utf8')
    expect(source).toContain('export async function down')
    expect(source).not.toMatch(/down[\s\S]*await\s+db\.(?:execute|query)/)
  })

  it('keeps generic migration-down entry points non-destructive', () => {
    const packageJSON = JSON.parse(
      readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'),
    )
    const migration = readFileSync(path.join(migrationDir, `${migrationStem}.ts`), 'utf8')

    expect(packageJSON.scripts.payload).toBeDefined()
    expect(migration).toContain('Baseline rollback is unsupported')
    expect(migration).not.toMatch(/export async function down[\s\S]*db\.execute\s*\(/)
    expect(() => assertPhase1Arguments('migrate', ['migrate:down'])).toThrow(/Unexpected arguments/)
    expect(() => assertPhase1Arguments('migrate', ['--', 'migrate:down'])).toThrow(
      /Unexpected arguments/,
    )
  })

  it('keeps schema push explicit and production-disabled', () => {
    const config = readFileSync(path.resolve(process.cwd(), 'src/payload.config.ts'), 'utf8')

    expect(config).toContain("process.env.NODE_ENV !== 'production'")
    expect(config).toContain("process.env.PAYLOAD_DB_PUSH === 'true'")
    expect(config).toContain("migrationDir: path.resolve(dirname, 'migrations')")
  })
})

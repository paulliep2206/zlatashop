import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import process from 'node:process'

export const PHASE1_TARGET_ID = 'local-phase1:127.0.0.1:55432/bookstore_baseline_phase1'
export const PHASE1_ACKNOWLEDGEMENT = 'I_ACKNOWLEDGE_PHASE1_LOCAL_DISPOSABLE_DATABASE'
const EXPECTED_HOST = '127.0.0.1'
const EXPECTED_DATABASE = 'bookstore_baseline_phase1'
const EXPECTED_PORT = '55432'
const EXPECTED_USER = 'baseline_runner'

export function assertPhase1Target({ acknowledgement, databaseURL, expectedTarget, nodeEnv }) {
  if (nodeEnv === 'production') {
    throw new Error('Phase 1 commands are prohibited when NODE_ENV=production')
  }
  if (acknowledgement !== PHASE1_ACKNOWLEDGEMENT) {
    throw new Error(`Expected BASELINE_PHASE1_ACK=${PHASE1_ACKNOWLEDGEMENT}`)
  }
  if (expectedTarget !== PHASE1_TARGET_ID) {
    throw new Error(`Expected BASELINE_EXPECTED_TARGET=${PHASE1_TARGET_ID}`)
  }

  if (!databaseURL) throw new Error('BASELINE_DATABASE_URL is required')

  const target = new URL(databaseURL)
  const database = target.pathname.replace(/^\//, '')
  const user = decodeURIComponent(target.username)

  if (target.protocol !== 'postgresql:' && target.protocol !== 'postgres:') {
    throw new Error('Phase 1 requires a PostgreSQL URL')
  }
  if (target.hostname !== EXPECTED_HOST) {
    throw new Error(`Expected exact Phase 1 host ${EXPECTED_HOST}; received ${target.hostname}`)
  }
  if (target.port !== EXPECTED_PORT) {
    throw new Error(
      `Expected exact Phase 1 port ${EXPECTED_PORT}; received ${target.port || '(default)'}`,
    )
  }
  if (database !== EXPECTED_DATABASE) {
    throw new Error(`Expected exact Phase 1 database ${EXPECTED_DATABASE}; received ${database}`)
  }
  if (user !== EXPECTED_USER) {
    throw new Error(
      `Expected exact Phase 1 database user ${EXPECTED_USER}; received ${user || '(missing)'}`,
    )
  }
  if (process.env.PAYLOAD_DROP_DATABASE === 'true') {
    throw new Error('PAYLOAD_DROP_DATABASE=true is prohibited')
  }

  return {
    database,
    host: target.hostname,
    port: target.port,
    user,
    targetID: PHASE1_TARGET_ID,
  }
}

function safeEnvironment() {
  const databaseURL = process.env.BASELINE_DATABASE_URL
  const target = assertPhase1Target({
    databaseURL,
    acknowledgement: process.env.BASELINE_PHASE1_ACK,
    expectedTarget: process.env.BASELINE_EXPECTED_TARGET,
    nodeEnv: process.env.NODE_ENV,
  })

  const safeOverrides = {
    DATABASE_URL: databaseURL,
    NOVA_POSHTA_API_KEY: '',
    NOVA_POSHTA_CREATE_WAYBILL_ON_ORDER: 'false',
    NODE_ENV: 'development',
    PAYLOAD_DB_PUSH: 'false',
    PAYLOAD_DROP_DATABASE: 'false',
    PAYLOAD_MIGRATING: 'true',
    PAYLOAD_PUBLIC_SERVER_URL: 'http://127.0.0.1:3000',
    PAYLOAD_SECRET: 'phase1-local-only-not-for-deployment',
    UPLOADTHING_TOKEN: '',
    WAYFORPAY_ENABLE_MIXED_CARTS: 'false',
    WAYFORPAY_ENABLE_VIRTUAL_ONLY_CARTS: 'false',
    WAYFORPAY_MERCHANT_ACCOUNT: '',
    WAYFORPAY_SECRET_KEY: '',
  }
  Object.assign(process.env, safeOverrides)

  return { databaseURL, env: { ...process.env, ...safeOverrides }, target }
}

function printTarget(operation, target) {
  console.log(JSON.stringify({ environment: 'local/clean-room', operation, target }, null, 2))
}

export function assertPhase1Arguments(action, extraArguments) {
  if (action === 'check') {
    if (extraArguments.length === 0) return
    if (extraArguments.length === 1 && extraArguments[0] === '--require-empty') return
    if (
      extraArguments.length === 2 &&
      extraArguments[0] === '--' &&
      extraArguments[1] === '--require-empty'
    )
      return
  } else if (extraArguments.length === 0) {
    return
  }
  throw new Error(
    `Unexpected arguments for Phase 1 ${action || '(missing)'}: ${extraArguments.join(' ')}`,
  )
}

function runPayload(command, env) {
  const result = spawnSync('pnpm', ['payload', command], {
    env,
    encoding: 'utf8',
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

async function checkConnection(databaseURL, requireEmpty) {
  const { getPayload } = await import('payload')
  const { default: config } = await import('../../src/payload.config.ts')
  const payload = await getPayload({ config })
  try {
    const identity = await payload.db.pool.query(
      `select current_database() as database,
              current_user as "user",
              current_setting('server_version') as version,
              inet_client_addr()::text as client_address`,
    )
    const tables = await payload.db.pool.query(
      `select count(*)::integer as count
         from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'`,
    )
    const extensions = await payload.db.pool.query(
      `select extname as name, extversion as version from pg_extension order by extname`,
    )
    if (
      identity.rows[0].database !== EXPECTED_DATABASE ||
      identity.rows[0].user !== EXPECTED_USER
    ) {
      throw new Error('Connected database identity does not match the guarded Phase 1 target')
    }
    if (requireEmpty && tables.rows[0].count !== 0) {
      throw new Error(`Expected an empty database; found ${tables.rows[0].count} public tables`)
    }
    return { ...identity.rows[0], extensions: extensions.rows, publicTables: tables.rows[0].count }
  } finally {
    await payload.destroy()
  }
}

async function smoke(databaseURL) {
  const { getPayload } = await import('payload')
  const { default: config } = await import('../../src/payload.config.ts')
  const payload = await getPayload({ config })
  const collections = ['users', 'products', 'media', 'carts', 'orders', 'wayforpay-payments']
  const counts = {}
  try {
    for (const collection of collections) {
      counts[collection] = await payload.count({ collection, overrideAccess: true })
    }
  } finally {
    await payload.destroy()
  }
  return { database: new URL(databaseURL).pathname.slice(1), counts }
}

async function inventory() {
  const { getPayload } = await import('payload')
  const { default: config } = await import('../../src/payload.config.ts')
  const payload = await getPayload({ config })
  try {
    return {
      collections: payload.config.collections.map(({ slug }) => slug).sort(),
      globals: payload.config.globals.map(({ slug }) => slug).sort(),
    }
  } finally {
    await payload.destroy()
  }
}

async function main() {
  const action = process.argv[2]
  assertPhase1Arguments(action, process.argv.slice(3))
  const { databaseURL, env, target } = safeEnvironment()
  printTarget(action, target)

  if (action === 'check') {
    const identity = await checkConnection(databaseURL, process.argv.includes('--require-empty'))
    console.log(JSON.stringify({ identity }, null, 2))
    return
  }
  if (action === 'create') {
    await checkConnection(databaseURL, true)
    const result = spawnSync('pnpm', ['payload', 'migrate:create', 'baseline_candidate'], {
      env,
      encoding: 'utf8',
      stdio: 'inherit',
    })
    if (result.error) throw result.error
    if (result.status !== 0) process.exit(result.status ?? 1)
    return
  }
  if (action === 'migrate') {
    await checkConnection(databaseURL, true)
    runPayload('migrate', env)
    return
  }
  if (action === 'inventory') {
    console.log(JSON.stringify(await inventory(), null, 2))
    return
  }
  if (action === 'schema-check') {
    const result = spawnSync(
      'pnpm',
      ['payload', 'migrate:create', 'phase1_schema_check', '--skip-empty'],
      { env, encoding: 'utf8', stdio: 'inherit' },
    )
    if (result.error) throw result.error
    if (result.status !== 0) process.exit(result.status ?? 1)
    return
  }
  if (action === 'status') {
    runPayload('migrate:status', env)
    return
  }
  if (action === 'smoke') {
    console.log(JSON.stringify(await smoke(databaseURL), null, 2))
    return
  }

  throw new Error(
    'Usage: phase1.mjs check [--require-empty] | create | inventory | migrate | schema-check | status | smoke',
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error)
      process.exit(1)
    })
}

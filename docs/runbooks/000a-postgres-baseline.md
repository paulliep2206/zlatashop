# 000a PostgreSQL baseline runbook

This runbook is pinned to Payload and `@payloadcms/db-postgres` 3.85.1. It separates the four gates
in the approved specification. Passing one phase never authorizes the next.

## Phase 1: local candidate baseline

Phase 1 uses only `docker-compose.baseline.yml`. Its PostgreSQL 16 service is bound to
`127.0.0.1:55432`, uses database `bookstore_baseline_phase1`, and stores data in tmpfs. Never source
the repository `.env`; it may describe a remote application database.

Set these values in the command environment without committing them:

```sh
export BASELINE_DATABASE_URL=postgresql://baseline_runner:LOCAL_PASSWORD@127.0.0.1:55432/bookstore_baseline_phase1
export BASELINE_EXPECTED_TARGET=local-phase1:127.0.0.1:55432/bookstore_baseline_phase1
export BASELINE_PHASE1_ACK=I_ACKNOWLEDGE_PHASE1_LOCAL_DISPOSABLE_DATABASE
export NODE_ENV=development
export PAYLOAD_DROP_DATABASE=false
```

Start the isolated service, wait for health, and prove the target is empty before generation:

```sh
docker compose -f docker-compose.baseline.yml up -d --wait postgres-baseline
pnpm baseline:phase1:check -- --require-empty
pnpm baseline:phase1:create
```

The wrapper requires the exact host `127.0.0.1`, port, database, user, independent target identifier,
and explicit Phase 1 acknowledgement. It rejects production `NODE_ENV`, unexpected command
arguments, and `PAYLOAD_DROP_DATABASE=true`. It forces `NODE_ENV=development`,
`PAYLOAD_MIGRATING=true`, and `PAYLOAD_DB_PUSH=false`. Every entry point prints the sanitized target
and operation before connecting.

Review candidate `up` and `down`. `up` may create the complete schema and add its constraints on an
empty database. It must not rename, truncate, drop, or mutate existing objects/data. Baseline
`down` always refuses: rollback is unsupported. Destroy the disposable local database as a whole
container/database. Existing-database recovery requires a verified backup under a later gate.

Reconstruct and verify:

```sh
pnpm baseline:phase1:migrate
pnpm baseline:phase1:status
pnpm baseline:phase1:smoke
pnpm baseline:phase1:schema-check
docker exec bookstore_baseline_phase1_pg16 pg_dump --username=baseline_runner --dbname=bookstore_baseline_phase1 --schema-only --no-owner --no-privileges
```

The schema check must report no changes. Hash the generated migration, snapshot, index, and sanitized
schema-only dump. Record tool versions, frozen commit, configuration/lock hashes, resolved
collections/globals, local server identity, commands, and results in the Phase 1 evidence report.

Stopping the service with `docker compose -f docker-compose.baseline.yml down` deletes only the
explicit Phase 1 container; its tmpfs data is non-persistent. Do not use `--remove-orphans`, because
other local project containers are outside this runbook.

## Phase 2: production inventory and backup verification

Phase 2 is not authorized by Phase 1. A named operator and independent reviewer must follow the
approved specification. Production access is read-only for inventory and backup creation. The
operator independently verifies the target before running
`scripts/baseline/inspect-ledger-readonly.sql`; its output must be sanitized. The script starts a
read-only transaction, rejects a database-name mismatch, discovers candidate migration relations and
their physical shapes, inventories their rows, and rolls back. It neither stamps nor changes a
ledger. No ledger write artifact may be finalized until the observed production shape and complete
pre-operation state have been reviewed.

This phase also captures the authoritative production schema, backup/PITR evidence, isolated restore
proof, non-Payload objects, and drift classification. Any drift invalidates candidate acceptance and
returns the changed artifacts to Phase 1 review.

## Phase 3: production-copy rehearsal

Phase 3 begins only after Phase 2 approval. Use a fresh isolated restore, disable external effects,
and rehearse the separately reviewed ledger-only transaction, rollback/recovery, schema and data
fingerprints, migration status, application reads, and physical checkout/media regressions. Never
substitute a staging or production target. No production write is authorized.

## Phase 4: separately approved production execution

Phase 4 requires the specification's fresh production change authorization immediately before the
operation. Only the exact reviewed ledger-only transaction and read-only verification are permitted.
Baseline `up`/`down`, schema push, feature migrations, and destructive migration commands remain
prohibited. Abort on any target, fingerprint, ledger, artifact, approval, or maintenance-control
mismatch.

`000a` remains incomplete until all four phases and final completion approval pass. `001a` migration
generation and application remain blocked throughout Phase 1.

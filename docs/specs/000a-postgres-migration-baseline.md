# PostgreSQL migration baseline

Status: Approved

## Goal

Establish a verified, reproducible Payload/PostgreSQL migration baseline for the existing production
schema before any feature migration is generated or applied.

## Current repository behavior

- Payload uses `@payloadcms/db-postgres` 3.85.1 with development schema push left at its default.
- `payload` and `@payloadcms/db-postgres` are pinned to 3.85.1 in `package.json` and resolve to 3.85.1
  in `pnpm-lock.yaml`.
- `src/payload.config.ts` reads `DATABASE_URL`, does not set `push`, `migrationDir`, `schemaName`, or
  `prodMigrations`, and registers collections supplied by several plugins. With the installed adapter,
  an unset `push` permits automatic schema push outside `NODE_ENV=production` unless
  `PAYLOAD_MIGRATING=true`; production startup does not run migrations because `prodMigrations` is
  unset.
- The repository has a Payload CLI script but no committed migration directory, migration index, or
  schema snapshot. With the current source layout, Payload 3.85.1 would choose `src/migrations` as its
  default migration directory.
- The current application schema includes collections and fields contributed by Payload plugins, so
  the baseline must be generated from the complete resolved Payload configuration rather than from
  handwritten collection files alone.
- `docker-compose.yml` supplies a local PostgreSQL 16 container. No staging or production deployment
  workflow is committed. `.env.example` currently contains a MongoDB URL and therefore is not a safe
  source for a PostgreSQL migration target.

## Readiness states

These states are separate and must not be inferred from one another:

- **Specification readiness** means this document is Approved and contains unambiguous safety gates,
  acceptance criteria, and evidence requirements. It authorizes implementation of the baseline
  tooling and runbook, but no staging-copy or production operation.
- **Local implementation readiness** means the frozen commit and dependency lock are recorded; an
  isolated PostgreSQL target is positively identified; automatic push and destructive database
  switches are disabled for migration commands; and the committed baseline, comparison tooling,
  runbook, and local tests have passed review. It does not authorize use of production credentials.
- **Production execution readiness** additionally requires the named operator and reviewer, target
  identifiers, production inventory, tested backups, production-copy rehearsal, clean comparisons,
  approved command transcript, maintenance/concurrency controls, and an explicit production
  authorization immediately before the ledger-only transaction.

Changing this specification to Approved establishes only specification readiness. Changing it to
Implemented requires all three states and the final evidence approval described below.

## Authoritative schema and comparison rule

- The authoritative record of what exists in production is a timestamped, read-only inventory and
  normalized schema-only dump taken from the identified production PostgreSQL database at the frozen
  application commit. The repository configuration is the authoritative statement of what that
  frozen application expects. Neither source may be silently preferred when they disagree.
- The baseline must reconstruct the Payload-owned portion of the captured production schema and boot
  the frozen application. Any difference between production, the resolved Payload configuration,
  and the reconstructed database is classified as expected environment metadata, a reviewed
  non-Payload object, or a blocking drift item. A blocking drift item is resolved under a separate
  reviewed change before the baseline is recorded; baseline stamping must not conceal it.
- The approved ignore list is limited to environment-specific owners, grants, tablespaces, and
  extension installation metadata. Object definitions, extension versions used by Payload-owned
  objects, and search paths are recorded and compared rather than assumed.

## Environment separation and command safety

| Environment | Permitted operations in this specification | Prohibited operations |
| --- | --- | --- |
| Local/clean-room | Generate and review artifacts; create/drop disposable databases; apply and roll back committed migrations; run tests. | Any production or staging-copy credential. |
| Isolated restore/production copy | Restore a backup; inspect; rehearse the reviewed ledger-only operation; run later migrations and recovery rehearsals. | Treating the copy as production, external side effects, or changing the source backup/database. |
| Production | Read-only inventory and backup creation first; after all approvals, one reviewed ledger-only transaction and read-only verification. | Schema push, baseline `up`/`down`, `migrate:fresh`, `migrate:reset`, `migrate:refresh`, database drop/create, or feature migrations. |

- Every script and transcript identifies environment class, database host, port, database name,
  PostgreSQL server identity/version, and frozen commit without printing credentials. The operator
  must type or supply an independently issued expected-target identifier; deriving the expected value
  from `DATABASE_URL` alone is insufficient. A mismatch aborts before any write.
- Local and copy databases use credentials and host/database identifiers distinct from production.
  Restored copies have outbound application side effects disabled and are inaccessible to the public
  application.
- `PAYLOAD_DROP_DATABASE` must be absent or false everywhere except an explicitly disposable local
  teardown. Migration processes set `NODE_ENV=production`, `PAYLOAD_MIGRATING=true`, and explicit
  safe adapter settings so application initialization cannot auto-push. The implementation must set
  `push: false` and an explicit `migrationDir` before any baseline command is approved.
- Generic `pnpm payload migrate` must never be pointed at the pre-baseline production database: in
  Payload 3.85.1 an absent ledger entry causes the baseline `up` function to execute.

## Requirements

### Freeze and inventory

- Name separate operator and reviewer people and record the target environment, application commit,
  Payload and database-adapter versions, PostgreSQL version/extensions, resolved collection/global
  slugs, and all environment switches that alter schema or plugin registration. Do not record
  secrets.
- Freeze feature-schema changes while the baseline is produced. `001a` and later feature migrations
  cannot be generated against a moving configuration.
- Record and review the resolved `pnpm-lock.yaml`, Payload config, plugin registration, adapter
  options, `NODE_ENV`, `PAYLOAD_MIGRATING`, `PAYLOAD_DROP_DATABASE`, and the presence or absence of
  any deployment-supplied schema or migration command. An unknown deployment command or schema
  switch blocks execution.
- Capture read-only production inventory: the Payload migration ledger if present, schemas, tables,
  columns, enums, sequences/identities, indexes, unique constraints, foreign keys and delete actions,
  views, functions/triggers, extensions, and approximate row counts. Record any object outside
  Payload ownership separately.

### Backup and recovery

- Before changing migration metadata, create both a database-provider snapshot/PITR recovery point
  and a PostgreSQL logical backup that includes schema, data, large objects, ownership/privilege
  information needed for recovery, and the migration ledger.
- Restore the logical backup into an isolated database and prove that the application can boot and
  read representative users, products, media, carts, orders, and payment records. Record backup IDs,
  timestamps, checksums, restore duration, row-count comparisons, and the reviewer result without
  committing credentials or customer data.
- Document recovery triggers, responsible operator, connection cutover procedure, and the maximum
  accepted recovery point and recovery time. Recovery never runs destructive commands against the
  original production database while evidence is being collected.

### Baseline construction and comparison

- From the frozen pre-001a Payload configuration, generate and commit a baseline migration and its
  Payload-generated schema snapshot/index in the repository's standard `src/migrations` directory.
  Preserve every generated artifact required by future `migrate:create` comparisons.
- Run generation only in the local/clean-room environment, with no production credentials available
  and any configured database target empty and disposable; automatic push remains disabled. Review
  the baseline `up` as a complete schema-creation artifact: it may create the frozen schema on an
  empty database but must contain no operation intended to mutate, rename, truncate, or drop an
  existing production object. Its `down` is destructive by nature and is restricted to disposable
  local reconstruction tests; it is never a production rollback mechanism.
- Apply the committed baseline to a new empty PostgreSQL database. Run `payload migrate:status`, boot
  the frozen application, generate a schema-only dump, and execute representative API/read smoke
  tests. This empty-database reconstruction is the authoritative proof that a new environment can be
  built only from committed migrations.
- Take normalized schema-only dumps of production and the reconstructed database and compare tables,
  columns/types/defaults/nullability, enums, sequences/identities, indexes, constraints, foreign-key
  actions, and Payload-owned functions/triggers. Normalization may ignore only reviewed
  environment-specific owners, grants, tablespaces, and extension installation metadata; every
  other difference is resolved or explicitly blocks the baseline.
- A baseline migration that creates the already-existing schema must never execute its DDL against
  production. Only after the normalized schemas are equivalent may the runbook establish the
  baseline as already applied in production using a reviewed, transactional migration-ledger
  operation compatible with the installed Payload version.

### Existing-database baseline record

- Payload 3.85.1 identifies an applied migration by an entry in the hidden `payload-migrations`
  collection whose `name` exactly equals the committed migration filename stem and whose numeric
  `batch` participates in migration ordering. The physical table and column shape, including IDs and
  timestamps, must be taken from the production inventory; it must not be guessed from a local
  database.
- Before implementation is considered ready, commit a version-pinned, single-purpose ledger script
  or exact SQL runbook. In one transaction it must acquire a lock that excludes concurrent migration
  ledger changes while the reviewed maintenance controls exclude concurrent schema changes, assert
  the expected production target and frozen schema fingerprint, assert the complete reviewed
  pre-operation ledger state, assert that the baseline name is absent, calculate and record the
  reviewed next batch, insert exactly one baseline row, read it back, and commit. Any failed
  assertion rolls back without a write. The transcript records affected-row counts and the
  before/after ledger without credentials.
- If the migration ledger/table is absent, has an unexpected shape, contains an unclassified entry,
  or cannot be locked and updated atomically, production execution is blocked. This specification
  does not authorize creating or altering the ledger schema in production.
- Rehearse that exact artifact against a fresh restored production copy and prove with statement/DDL
  logging and before/after schema fingerprints that it executes no schema DDL and changes no row
  outside the single expected ledger row. After the row exists, `payload migrate:status` is a
  read-only confirmation only; all committed migration files must show as run and the separately
  inventoried ledger must contain no unclassified rows.

### Production-copy rehearsal

- Restore a current production backup into an isolated production-copy database. Rehearse the exact
  baseline-ledger operation there, verify that it executes no schema DDL, and require clean
  `payload migrate:status` afterward.
- Re-run schema comparison, row counts, application boot, representative reads, and physical
  checkout/media regressions on the production copy. The rehearsal must prove that existing records
  are unchanged.
- Rehearse rollback by restoring the pre-operation migration ledger transactionally. If rollback
  cannot safely restore the ledger, restore the verified backup to another isolated database and
  prove the documented cutover/recovery process. Record commands, sanitized outputs, timestamps,
  and reviewer approval.
- The ordinary rollback for the production baseline operation deletes only the exact newly inserted
  baseline ledger row in a locked transaction after asserting its ID, name, batch, timestamps, and
  the absence of later migration rows. It never invokes the baseline `down`. If those assertions do
  not hold, use the approved restore-and-cutover recovery path instead of editing the ledger.

### Human approval gates

The named reviewer, who must not be the operator, signs each gate in the evidence artifact:

1. **Specification approval:** approve this document before implementation begins.
2. **Freeze and inventory approval:** approve the frozen commit/configuration, exact environment
   classification, production inventory, drift classification, and non-Payload ownership list before
   generating the baseline.
3. **Backup/restore approval:** approve provider recovery-point and logical-backup evidence plus a
   successful isolated restore before any migration-ledger write is rehearsed.
4. **Artifact approval:** approve baseline migration/snapshot/index checksums, destructive-statement
   review, empty-database reconstruction, and schema comparison before the production-copy rehearsal.
5. **Production-copy approval:** approve the exact ledger script and transcript, no-DDL proof,
   regressions, rollback, and recovery rehearsal on a fresh production copy.
6. **Production change authorization:** immediately before execution, approve the named operator,
   target identifier, maintenance/concurrency controls, backup recency, exact artifact checksums, and
   command transcript. Approval expires if any recorded input changes.
7. **Completion approval:** after production verification, approve the final evidence package before
   changing this specification to Implemented or allowing generation of 001a.

### Handoff to feature migrations

- `000a` is complete only when the committed baseline reconstructs an empty database, matches the
  production schema, is recorded as applied without executing baseline DDL on production, and all
  backup/recovery and production-copy evidence is approved.
- After completion, future migrations—including 001a—are generated only from the committed baseline
  and tested through both paths: (1) apply the entire committed chain to a new empty database, and
  (2) restore a fresh production copy whose baseline ledger row has been established by the approved
  procedure, then apply only migrations after the baseline. A schema difference, dirty
  migration status, failed restore, or unexplained legacy migration entry stops the feature release.
- Applying the 001a feature migration remains a separate 001a deployment operation. Completing 000a
  neither changes product behavior nor enables a virtual payment gate.

## Evidence artifact

Store a sanitized operational report outside production data containing:

- frozen commit and dependency/database versions;
- readiness state, environment classification, sanitized target identifiers, resolved Payload
  collections/globals/plugins, adapter options, and schema-affecting environment/deployment switches;
- backup and provider recovery-point identifiers and restore proof;
- checksums of committed migration artifacts and normalized schema dumps;
- full categorized schema comparison and reviewed ignore list;
- empty-database reconstruction result;
- baseline `up`/`down` destructive-statement review and proof that `up` ran only on an empty database;
- exact ledger script/checksum, expected preconditions, before/after rows, affected-row count,
  transaction result, statement/DDL log, and schema/data fingerprints;
- production-copy rehearsal, migration-status, regression, rollback, and recovery results, plus the
  reviewed commands or test harness that future migrations must use for both migration paths;
- operator/reviewer names, timestamps, all seven gate decisions, production authorization expiry,
  and any explicitly accepted non-Payload objects.

Do not commit database credentials, secrets, raw customer records, or an unsanitized production dump.

## Acceptance criteria

- Given the frozen pre-001a configuration, when the baseline is generated, then all required
  migration files, snapshots, and index artifacts are committed and their checksums are recorded.
- Given a new empty PostgreSQL database, when only committed migrations are applied, then migration
  status is clean, the frozen application boots, the reconstructed schema matches the expected
  Payload schema, and representative reads pass.
- Given the captured production schema and the frozen resolved Payload configuration, when they are
  compared, then production is the authoritative record of existing objects, configuration is the
  authoritative application expectation, and every disagreement is classified and resolved or
  blocks the baseline without being hidden by ledger stamping.
- Given normalized schema-only dumps from production and empty-database reconstruction, when they are
  compared, then there is no unexplained difference in any Payload-owned table, column/type/default,
  enum, sequence/identity, index, constraint, foreign-key action, or function/trigger.
- Given the provider recovery point and logical backup, when the logical backup is restored in
  isolation, then checksums/row counts agree, the application boots, representative legacy records
  are readable, and measured restore evidence is approved.
- Given a fresh production copy, when the exact baseline-ledger procedure is rehearsed, then no
  baseline schema DDL executes, exactly one expected migration-ledger row changes, every other record
  and the schema remain unchanged, and
  `payload migrate:status` reports the baseline cleanly applied.
- Given the pre-baseline production database, when baseline recording is authorized, then the
  version-pinned procedure locks and validates the expected target, schema fingerprint, and ledger
  state before atomically inserting exactly one row; it never invokes the baseline `up` or `down`.
- Given any later feature migration, when it is prepared for deployment, then the complete committed
  chain reconstructs an empty database and only the post-baseline migrations apply successfully to a
  fresh restored production copy with the stamped baseline.
- Given the production-copy baseline rehearsal, when rollback is invoked, then the prior migration
  ledger or verified restored database is recovered according to the runbook and application/read
  regressions pass.
- Given any failed restore, unexplained schema difference, dirty migration status, unclassified
  migration entry, unexpected DDL, target mismatch, missing approval, expired authorization, unsafe
  environment switch, or changed legacy record, when readiness is evaluated, then 000a remains
  incomplete and generation/application of the 001a feature migration is blocked.
- Given an Approved specification but incomplete operational evidence, when readiness is reported,
  then specification, local implementation, and production execution readiness are reported
  separately and neither approval nor local test success is represented as production authorization.

## Out of scope

- Changing Payload collections, product data, media storage, checkout behavior, or payment gates.
- Generating, applying, or rolling back the 001a feature migration.
- Committing production data or credentials.

## Open questions

None at the specification level. The production platform and deployment command, target identifiers,
operator/reviewer names, backup identifiers and retention, accepted recovery objectives, production
PostgreSQL version/extensions, actual ledger shape/state, normalized comparison output, maintenance
window/concurrency control, and exact version-pinned ledger artifact are deliberately not invented
from repository evidence. They are required implementation or operational decisions and evidence at
the gates above before this specification can be marked Implemented.

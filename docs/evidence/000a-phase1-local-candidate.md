# 000a Phase 1 local candidate evidence

Recorded: 2026-09-17T10:34:57Z (UTC). This report is sanitized: it contains no database password,
production credential, customer record, or production-derived data.

## Readiness

- Specification readiness: **ready** (`000a` remains Approved).
- Local candidate construction and automated verification: **complete** for the uncommitted source
  state and artifacts recorded below. The final artifact commit is pending.
- Local candidate human approval gate: **pending**; no independent reviewer decision is recorded.
- Production inventory/backup verification (Phase 2): **not started**.
- Production-copy rehearsal (Phase 3): **not started**.
- Production execution (Phase 4): **not authorized and not started**.
- Overall `000a`: **incomplete**. `001a` generation/application remains blocked.

## Source and tools

- Source HEAD: `a92364f0bbe3844b806a2be8e2655474185773d8`.
- The candidate was generated from a dirty working tree containing the Phase 1 implementation and
  pre-existing specification changes. The repository candidate artifact hashes below, rather than
  HEAD alone, identify this review candidate. A final frozen commit must be recorded after review.
- Payload: `3.85.1`.
- `@payloadcms/db-postgres`: `3.85.1`.
- `@payloadcms/drizzle`: `3.85.1`.
- `drizzle-orm`: `0.45.2`; `pg`: `8.20.0`.
- Node.js: `22.20.0`; pnpm: `10.33.0`; Git: `2.37.1`.
- Docker: `20.10.17`; Docker Compose: `2.6.1`.
- PostgreSQL server: `16.14`, image `postgres:16-alpine`, image ID
  `sha256:0ab885cf71916beded83c51df1ea71acddeab24048fd957b4f4471f59dcb9bc5`.

## Configuration inventory

- Environment class: `local/clean-room`.
- Independently supplied target ID: `local-phase1:127.0.0.1:55432/bookstore_baseline_phase1`.
- Connection target: loopback host `127.0.0.1`, port `55432`, database
  `bookstore_baseline_phase1`, role `baseline_runner`.
- Container port binding: `127.0.0.1:55432 -> 5432/tcp`; data directory is tmpfs.
- Migration environment: `NODE_ENV=development`, `PAYLOAD_MIGRATING=true`,
  `PAYLOAD_DROP_DATABASE=false`, `PAYLOAD_DB_PUSH=false`.
- External-service credentials are overridden to empty values and both virtual WayForPay rollout
  gates are forced false by the Phase 1 wrapper before Payload configuration is imported.
- Adapter: explicit `push: false` under the migration environment and explicit migration directory
  `src/migrations`; no `prodMigrations` configured.
- Schema-affecting application variables found: `DATABASE_URL`, `PAYLOAD_DB_PUSH`, `PAYLOAD_SECRET`,
  and `UPLOADTHING_TOKEN`. The local run used a non-deployment Payload secret and no UploadThing
  token. No deployment-supplied schema/migration command exists in the repository.
- Plugins: SEO, form builder, ecommerce (variants disabled plus repository overrides), and public
  UploadThing storage for `media`.
- Resolved collections (17): `addresses`, `attributes`, `carts`, `categories`, `form-submissions`,
  `forms`, `media`, `orders`, `pages`, `payload-kv`, `payload-locked-documents`,
  `payload-migrations`, `payload-preferences`, `products`, `transactions`, `users`, and
  `wayforpay-payments`.
- Resolved globals (2): `footer`, `header`.

## Artifact hashes (SHA-256)

- `pnpm-lock.yaml`: `9a87b294ad2b2e995b7d63d684e0a428ea31ea4e15aba5b15288e2831cb12759`.
- `package.json`: `6d7e57512e7beca12c4bd419fabd26ed529350eade70ad6982a6330090e5823d`.
- `src/payload.config.ts`: `792e7c4187fbb6fbf1450bae5e4ab94eb4d1f359178d2834b095632d3ad541ed`.
- Candidate migration TypeScript: `cfba250c2af23b55817e49ef14989a24dca6ebf2f6a6d8645e036b3808abedcb`.
- Candidate Payload snapshot JSON: `284ed663e9d0a84610c1a67db97f7dbc28e4a42672d09c39ebcf506151eb24fe`.
- Migration index: `38f45e61f183b5352d905cc586bcf3b875f9c1560b78ec6351093e4e19845409`.
- Local schema-only dump (not committed):
  `f23004808bb2dac404bda002c41ef868e9bd82326685ad7e08c038d7808f6d45`.

## Reconstruction evidence

1. The target guard connected to the independently identified loopback target and reported zero
   public tables before migration. Server identity was PostgreSQL `16.14`; no remote address was
   accepted by the guard.
2. Payload generated `20260912_131510_baseline_candidate.ts`, its JSON snapshot, and `index.ts` from
   the complete resolved configuration.
3. Review of `up` found schema creation and `ALTER TABLE ... ADD CONSTRAINT` statements only. It has
   no `DROP`, `TRUNCATE`, `RENAME`, data `INSERT`, data `UPDATE`, or data `DELETE`. Destructive drops
   are absent from executable `down`; `down` unconditionally refuses before using its database
   argument.
4. Applying only the repository candidate to the fresh database succeeded in 270 ms.
5. `payload migrate:status` reported candidate batch 1, `Ran: Yes`.
6. The candidate application configuration booted with schema push disabled. Representative Payload
   reads of users, products, media, carts, orders, and WayForPay payments succeeded; each correctly
   returned zero records in the fresh database.
7. Reconstruction inventory: 88 public tables, 60 public enums, 408 public indexes, and 141 public
   foreign keys.
8. `migrate:create phase1_schema_check --skip-empty` produced no additional artifact, proving the
   generated snapshot matches the resolved configuration.

Commands were run under Node 22 with the local password replaced by `LOCAL_PASSWORD` below. All
listed commands exited 0 except the intentional generic-down refusal, which exited 1. Routine
Payload email-adapter warnings and package-manager banners are omitted from this summary.
The repeated temporary Node launcher was
`pnpm dlx node@22.20.0 /opt/homebrew/Cellar/pnpm/10.33.0/libexec/bin/pnpm`; the shorter `pnpm`
spelling below is a manually normalized presentation of that exact prefix.

```sh
docker compose -f docker-compose.baseline.yml up -d --wait postgres-baseline
export BASELINE_DATABASE_URL=postgresql://baseline_runner:LOCAL_PASSWORD@127.0.0.1:55432/bookstore_baseline_phase1
export BASELINE_EXPECTED_TARGET=local-phase1:127.0.0.1:55432/bookstore_baseline_phase1
export BASELINE_PHASE1_ACK=I_ACKNOWLEDGE_PHASE1_LOCAL_DISPOSABLE_DATABASE
export NODE_ENV=development
export PAYLOAD_DROP_DATABASE=false
pnpm baseline:phase1:check -- --require-empty
pnpm baseline:phase1:migrate
pnpm baseline:phase1:status
pnpm baseline:phase1:smoke
pnpm baseline:phase1:inventory
pnpm baseline:phase1:schema-check
docker exec bookstore_baseline_phase1_pg16 pg_dump --username=baseline_runner --dbname=bookstore_baseline_phase1 --schema-only --no-owner --no-privileges > /tmp/000a-phase1-schema.sql
pnpm exec vitest run --config ./vitest.config.mts tests/int/baselinePhase1.int.spec.ts
DATABASE_URL=postgresql://baseline_runner:LOCAL_PASSWORD@127.0.0.1:55432/bookstore_baseline_phase1 PAYLOAD_MIGRATING=true PAYLOAD_DB_PUSH=false PAYLOAD_DROP_DATABASE=false NODE_ENV=development PAYLOAD_SECRET=phase1-local-only-not-for-deployment pnpm payload migrate:down
pnpm baseline:phase1:status
```

Observed relevant output (manually summarized unless quoted):

- Pre-migration identity: database `bookstore_baseline_phase1`, role `baseline_runner`, PostgreSQL
  `16.14`, extension `plpgsql` `1.0`, zero public tables.
- Migration: `Migrated: 20260912_131510_baseline_candidate (270ms)`; exit 0.
- Status: candidate batch 1, `Ran: Yes`; exit 0.
- Smoke: users, products, media, carts, orders, and WayForPay payments each returned zero; exit 0.
- Schema check: generated no migration artifact; exit 0.
- Schema dump: exit 0; SHA-256
  `f23004808bb2dac404bda002c41ef868e9bd82326685ad7e08c038d7808f6d45`.
- Direct `down` unit test: refused and did not call `db.execute`.
- Generic `pnpm payload migrate:down`: exit 1 with `Baseline rollback is unsupported`; the following
  status check remained batch 1, `Ran: Yes`.

## Repository validation

- Phase 1 focused suite: 16/16 tests passed under Node 22.20.0.
- Focused pricing/physical checkout/disabled-gate regression suite: 40/40 tests passed when both
  WayForPay rollout gates were explicitly false.
- TypeScript validation: `pnpm exec tsc --noEmit` passed under Node 22.20.0.
- Formatting/structure: Prettier completed for supported changed files; `.env.example` and SQL are
  unsupported by the configured Prettier invocation. `git diff --check` passed,
  and `docker compose -f docker-compose.baseline.yml config --quiet` passed.
- Repository-wide `pnpm lint` could not run rules because the existing ESLint configuration crashes
  during loading with `TypeError: Converting circular structure to JSON`. No source lint diagnostics
  were produced.
- Repository-wide `pnpm test:int` under Node 22 reported 75 passed, 1 skipped, 3 failed, and one setup error. The
  failures are outside this phase: two WayForPay tests inherited enabled rollout gates, one Nova
  Poshta UI test expects English `City` while the component renders Ukrainian `Місто`, and the API
  suite hits UploadThing's server-only guard under jsdom. The same WayForPay suite passes with both
  gates explicitly disabled as required by this baseline regression.

## Candidate limitations and blocked evidence

- No production inventory or schema was captured, so production equivalence and drift classification
  are unknown. The local dump is not authoritative for production.
- No provider recovery point, logical backup, isolated production restore, row comparison, recovery
  objective, operator/reviewer approval, or production-copy rehearsal exists.
- The production ledger shape/state was not inspected. The prepared inspection procedure is
  read-only and unexecuted; no ledger stamping SQL has been prepared or authorized.
- The baseline has not been and must not be marked applied to any existing database.
- Phase 1 establishes a provisional candidate only. Human review and Phases 2–4 remain mandatory.

## Provisional commit preparation

No frozen commit is claimed while the tree is dirty. After independent review, the recommended
provisional Phase 1 commit contains exactly:

- `.env.example`
- `package.json`
- `src/payload.config.ts`
- `docker-compose.baseline.yml`
- `scripts/baseline/phase1.mjs`
- `scripts/baseline/inspect-ledger-readonly.sql`
- `src/migrations/20260912_131510_baseline_candidate.ts`
- `src/migrations/20260912_131510_baseline_candidate.json`
- `src/migrations/index.ts`
- `tests/int/baselinePhase1.int.spec.ts`
- `docs/specs/000a-postgres-migration-baseline.md`
- `docs/runbooks/000a-postgres-baseline.md`
- `docs/evidence/000a-phase1-local-candidate.md`

The approved but currently uncommitted specification change is included so that the exact approved
Phase 1 gates are frozen with the implementation. Unrelated 001 specification files must not be
included in the Phase 1 artifact commit.

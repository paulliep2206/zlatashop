\set ON_ERROR_STOP on

-- Payload/@payloadcms/db-postgres 3.85.1 only. Phase 2 inventory preparation.
-- Invoke with psql --set=expected_database=THE_INDEPENDENTLY_ISSUED_DATABASE_NAME.
-- This script is read-only and must not be used as authorization for a ledger write.
BEGIN TRANSACTION READ ONLY;

SELECT current_database() = :'expected_database' AS target_matches \gset
\if :target_matches
\else
  \echo 'Target mismatch; aborting read-only inventory.'
  \quit false
\endif

SELECT
  current_database() AS database,
  current_user AS database_user,
  current_setting('server_version') AS postgres_version,
  inet_server_addr() AS server_address,
  inet_server_port() AS server_port;

SELECT
  n.nspname AS schema_name,
  c.relname AS relation_name,
  c.relkind AS relation_kind,
  pg_total_relation_size(c.oid) AS total_bytes
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE c.relname ILIKE '%migration%'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY n.nspname, c.relname;

SELECT
  table_schema,
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_schema,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name ILIKE '%migration%'
ORDER BY table_schema, table_name, ordinal_position;

-- Inventory rows without guessing a physical ledger table name.
SELECT format('TABLE %I.%I;', n.nspname, c.relname)
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p')
  AND c.relname ILIKE '%migration%'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY n.nspname, c.relname
\gexec

ROLLBACK;

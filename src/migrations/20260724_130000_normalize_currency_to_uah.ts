import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from '@payloadcms/db-postgres'

/**
 * Payload's ecommerce plugin originally created carts with USD as its default,
 * while this storefront's custom prices have always represented UAH minor units.
 * Normalize the legacy labels before Drizzle casts the text column to the
 * UAH-only enum.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "carts"
    SET "currency" = 'UAH'
    WHERE "currency" IS DISTINCT FROM 'UAH';
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // The previous USD labels were incorrect metadata, so they must not be restored.
}

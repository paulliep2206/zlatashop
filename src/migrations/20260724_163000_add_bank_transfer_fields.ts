import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "enum_transactions_payment_method"
      ADD VALUE IF NOT EXISTS 'bankTransfer';

    DO $$ BEGIN
      CREATE TYPE "enum_transactions_bank_transfer_finalization_state"
        AS ENUM('pending', 'finalizing', 'finalized');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE "transactions"
      ADD COLUMN IF NOT EXISTS "bank_transfer_reference_i_d" varchar,
      ADD COLUMN IF NOT EXISTS "bank_transfer_finalization_state"
        "enum_transactions_bank_transfer_finalization_state" DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS "bank_transfer_shipping_address" jsonb,
      ADD COLUMN IF NOT EXISTS "bank_transfer_nova_poshta_delivery" jsonb;

    CREATE UNIQUE INDEX IF NOT EXISTS "transactions_bank_transfer_reference_i_d_idx"
      ON "transactions" USING btree ("bank_transfer_reference_i_d");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "transactions_bank_transfer_reference_i_d_idx";
    ALTER TABLE "transactions"
      DROP COLUMN IF EXISTS "bank_transfer_nova_poshta_delivery",
      DROP COLUMN IF EXISTS "bank_transfer_shipping_address",
      DROP COLUMN IF EXISTS "bank_transfer_finalization_state",
      DROP COLUMN IF EXISTS "bank_transfer_reference_i_d";
    DROP TYPE IF EXISTS "enum_transactions_bank_transfer_finalization_state";
  `)
}

import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "transactions"
      ADD COLUMN IF NOT EXISTS "liqpay_merchant_order_i_d" varchar,
      ADD COLUMN IF NOT EXISTS "liqpay_payment_i_d" varchar,
      ADD COLUMN IF NOT EXISTS "liqpay_liqpay_order_i_d" varchar,
      ADD COLUMN IF NOT EXISTS "liqpay_paytype" varchar,
      ADD COLUMN IF NOT EXISTS "liqpay_provider_status" varchar,
      ADD COLUMN IF NOT EXISTS "liqpay_last_callback_at" timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS "liqpay_finalization_state" "enum_transactions_liqpay_finalization_state" DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS "liqpay_shipping_address" jsonb,
      ADD COLUMN IF NOT EXISTS "liqpay_nova_poshta_delivery" jsonb;

    CREATE UNIQUE INDEX IF NOT EXISTS "transactions_liqpay_merchant_order_i_d_idx"
      ON "transactions" USING btree ("liqpay_merchant_order_i_d");
    CREATE INDEX IF NOT EXISTS "transactions_liqpay_payment_i_d_idx"
      ON "transactions" USING btree ("liqpay_payment_i_d");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "transactions_liqpay_payment_i_d_idx";
    DROP INDEX IF EXISTS "transactions_liqpay_merchant_order_i_d_idx";
    ALTER TABLE "transactions"
      DROP COLUMN IF EXISTS "liqpay_nova_poshta_delivery",
      DROP COLUMN IF EXISTS "liqpay_shipping_address",
      DROP COLUMN IF EXISTS "liqpay_finalization_state",
      DROP COLUMN IF EXISTS "liqpay_last_callback_at",
      DROP COLUMN IF EXISTS "liqpay_provider_status",
      DROP COLUMN IF EXISTS "liqpay_paytype",
      DROP COLUMN IF EXISTS "liqpay_liqpay_order_i_d",
      DROP COLUMN IF EXISTS "liqpay_payment_i_d",
      DROP COLUMN IF EXISTS "liqpay_merchant_order_i_d";
  `)
}

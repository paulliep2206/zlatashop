# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A Ukrainian online bookstore built on the official Payload CMS ecommerce template (Payload 3 + Next.js 16 App Router + React 19, Tailwind 4, shadcn/ui). It has been customized away from the template's Stripe/USD defaults. It now uses UAH-only pricing, WayForPay payments and Nova Poshta shipping, and stores data in Postgres.

For Payload-specific APIs (collections, hooks, access control, Local API, queries), use the `payload` skill (`.claude/skills/payload/`, mirrored in `.agents/skills/payload/` for other agents). Start with `SKILL.md`, then go to `reference/`.

## Commands

Package manager is **pnpm**.

```bash
docker compose up -d          # local Postgres 16 (db: bookstore_dev, user: bookstore_admin, port 5432)
pnpm dev                      # dev server at http://localhost:3000 (admin at /admin)
pnpm build && pnpm start      # production build
pnpm exec tsc --noEmit        # typecheck (there is no package.json script for it)
pnpm lint / pnpm lint:fix     # ESLint
pnpm generate:types           # regenerate src/payload-types.ts after any collection/field change
pnpm generate:importmap       # regenerate admin importMap after adding/changing admin components
pnpm test:int                 # Vitest (tests/int/**/*.int.spec.{ts,tsx}, jsdom)
pnpm test:e2e                 # Playwright (tests/e2e), starts/reuses `pnpm dev`
pnpm test                     # test:int + test:e2e (needs DB and dev server)
```

Run a single integration test: `pnpm test:int tests/int/wayforpay.int.spec.ts` (add `-t "<name>"` to filter by test name). Run a single e2e spec: `pnpm test:e2e tests/e2e/frontend.e2e.spec.ts`.

`tests/int/api.int.spec.ts` and the e2e suite need a running DB (`DATABASE_URL`). The pricing, WayForPay and Nova Poshta specs need no DB. Run them with:

```bash
pnpm test:int tests/int/pricing.int.spec.ts tests/int/wayforpay.int.spec.ts tests/int/novaPoshta.int.spec.tsx
```

Lint must pass with 0 errors (about 100 existing warnings are tolerated; don't add new ones). The React Compiler rules are on (`react-hooks/set-state-in-effect`, `refs`, `preserve-manual-memoization`). To reset UI state on navigation, store the route the state belongs to and derive from it (see `CartModal`, `MobileMenu`) instead of calling `setState` in an effect. Read external values (localStorage, DOM attributes) with `useSyncExternalStore` (see `src/providers/Theme`).

Environment: copy `.env.example` to `.env`. Note that `.env.example` still has the template's MongoDB `DATABASE_URL`. The app uses `@payloadcms/db-postgres`, so set a Postgres connection string matching `docker-compose.yml`. Media uploads go to UploadThing and need `UPLOADTHING_TOKEN`, which is missing from `.env.example`.

Schema changes: there is no `src/migrations/` and no `migrationDir`. In dev, the Postgres adapter syncs the schema automatically (push mode). Migration commands, if needed, are `pnpm payload migrate:create` and `pnpm payload migrate`. Ask before creating one.

Email: no email adapter is configured (`nodemailerAdapter()` is commented out in `payload.config.ts`), so `payload.sendEmail` (e.g. the find-order email) only logs to the console.

Formatting (Prettier): no semicolons, single quotes, trailing commas, 100-char width.

## Architecture

- **Route groups**: `src/app/(app)` is the storefront (pages, account, checkout, `/api/wayforpay/*` Next route handlers). `src/app/(payload)` holds Payload's admin UI and REST/GraphQL routes. Its `layout.tsx`, route files and `admin/importMap.js` are generated, so don't hand-edit them. `custom.scss` (admin styling) is meant to be edited.
- **Payload config**: `src/payload.config.ts` registers the collections it owns directly (Users, Pages, Categories, Media, Attributes, WayForPayPayments), the Header/Footer globals and the custom Nova Poshta endpoints. Most commerce collections (products, carts, orders, addresses, transactions) are created by `@payloadcms/plugin-ecommerce` in `src/plugins/index.ts` and customized through `*CollectionOverride` functions there. Look in that file to change carts, orders or addresses. Products are defined in `src/collections/Products/index.ts` and passed in as `productsCollectionOverride`.
- **Pricing (important deviation from the template)**: products use custom `price` / `specialPrice` fields in UAH (major units), not the plugin's generated `priceIn{Currency}` fields. The plugin's variants are disabled (`variants: false`). Instead, `Products` has its own `productType` (`simple` / `configurable` / `virtual`) and a self-referencing `variants` relationship that links simple products to a configurable one. The plugin's product validation is turned off (`validation: () => undefined`). Cart `subtotal` is recalculated in cart `afterRead`/`beforeChange` hooks via `src/lib/pricing.ts` (`getProductPrice`: `specialPrice` wins over `price`). Any new price-dependent code should go through `getProductPrice`. Currency config is in `src/lib/currency.ts`.
- **WayForPay checkout** (`src/integrations/wayforpay/`, routes in `src/app/(app)/api/wayforpay/`):
  1. `initiate` snapshots the cart into a `wayforpay-payments` document. Amounts are stored as integer kopiykas (`amountMinor`), converted with `amount.ts`. It returns a signed widget request.
  2. The client widget (`src/components/checkout/WayForPayPayment.tsx`) opens payment.
  3. Results arrive through two paths. One is the server-to-server `callback`, which is signature-verified. The other is client-triggered `confirm`, which requires the payment's `publicToken` and re-checks status with WayForPay's API. Both go through `applyWayForPayResult` in `finalize.ts`, which is idempotent (`finalizing` status / existing `order` guard) and creates the order on approval.
  4. HMAC signing and verification live in `signatures.ts`. Input parsing lives in `validation.ts`. Never trust client-sent amounts. Amounts are always rebuilt from DB product prices.
- **Nova Poshta shipping** (`src/integrations/nova-poshta/`, see its `README.md`): the browser calls Payload endpoints (`/api/nova-poshta/cities`, `/api/nova-poshta/warehouses`) so the API key stays server-side. The selected office is stored on the order's `novaPoshtaShipping` JSON field. Electronic waybill creation runs only after the paid order is created, and only when `NOVA_POSHTA_CREATE_WAYBILL_ON_ORDER=true`. A waybill failure records a `failed` status and never rolls back the order.
- **Orders for guests**: orders get a random `accessToken` (set in the orders override). The find-order flow (`src/components/forms/FindOrderForm`) emails a link with it to give guests access without an account. Without an email adapter, the link only appears in the server log.
- **Access control**: reusable access functions live in `src/access/` and are passed into the ecommerce plugin. Users are the admin auth collection and also the plugin's `customers` collection. The first user created becomes admin (`ensureFirstUserIsAdmin`).
- **Content**: Pages use a block-based layout builder (`src/blocks/*/config.ts` paired with `Component.tsx`, rendered by `RenderBlocks.tsx`), heros (`src/heros/`), drafts and live preview, plus on-demand revalidation hooks. Seed data is in `src/endpoints/seed/` (triggered from the admin dashboard's seed button). It is still template content.
- **Path aliases**: `@/*` maps to `src/*`, and `@payload-config` maps to `src/payload.config.ts`.

## Rules that must never be broken
- Orders are created only by `applyWayForPayResult` (`src/integrations/wayforpay/finalize.ts`) after an approved payment. It is reached in two ways: the `callback` route, which must verify the WayForPay signature before touching any payment or order, or the `confirm` route, which requires the payment's `publicToken` and a signature-verified status reply from WayForPay. The seed script is the only other code that creates orders (demo data).
- Never read, print or commit `.env` or any secrets. Keys live only in environment variables. `.env.example` and `test.env` contain no secrets and may be read.
- Never run migrations, deploys or database changes against production. Do not commit or push unless I ask.

## How to work with me
- Show a short plan first and wait for my OK if a change touches more than one file, or touches the schema, payments (WayForPay) or shipping (Nova Poshta).
- Work in small steps. One task at a time, and do not touch unrelated files.
- Do not add new dependencies without asking.
- Before saying a task is done, run the typecheck, lint and the DB-free tests (commands above) and report the result honestly, including failures. Run `api.int.spec.ts` and e2e only when I ask, or when the change needs them and the DB is up.
- After changing a Payload collection or field: run `pnpm generate:types`, plus `pnpm generate:importmap` if admin components changed.

## Code conventions
- TypeScript strict. No `any` in new code (the template's `src/blocks/Form/*` still has some, and ESLint only warns).
- Follow the existing structure: third-party integrations go in `src/integrations/<provider>/` (pure logic, separate from route handlers); layout blocks are `src/blocks/<Name>/config.ts` + `Component.tsx`, registered in `RenderBlocks.tsx`; shared access functions go in `src/access/`.
- Storefront text is a mix of Ukrainian and English (e.g. the Nova Poshta selector has Ukrainian labels but English messages). Tests query by visible text, so update them when you change copy.
- Accessibility matters: semantic HTML, labels, alt text, keyboard support.

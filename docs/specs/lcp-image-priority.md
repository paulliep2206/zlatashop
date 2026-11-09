# Spec A: LCP image priority (PDP and category page)

## Problem and evidence

- PDP: the main image is the LCP element. Load Delay is 76% of LCP (docs/performance/baseline.md). In the baseline deployment the main image had no preload and was `loading="lazy"`, so its request started only at 1,791 ms.
- After a later local change (`priority={active}` in `tile.tsx`), a preload appeared, but it came from the active **thumbnail**, not the main image, and showed Priority: Low in the Network panel. The main image was still lazy.
- Category page: the first product card image is the LCP element and is `loading="lazy"`. Load Delay is 51% of LCP.
- Baseline numbers (docs/performance/baseline.md, mobile, median of 3):
  - PDP: LCP 5.9 s, CLS 0
  - Category: LCP 7.0 s, CLS 0.196

## Technical constraints (Next.js 16.2.6)

- `priority` is deprecated in Next 16 in favour of `preload`. Both only add a preload and make the image eager. Neither sets `fetchpriority` (`node_modules/next/dist/shared/lib/get-img-props.js:269,569,584`).
- `fetchPriority` reaches the `<img>` only when it is passed explicitly.
- Next throws for these combinations: `priority` + `loading="lazy"`, `preload` + `loading="lazy"`, `preload` + `priority` (`get-img-props.js:390-409`).
- The Next docs say not to combine `preload` with `loading` or `fetchPriority`. They recommend `loading="eager"` or `fetchPriority="high"` in most cases.
- The shared `Media` wrapper currently has no `fetchPriority` prop (`src/components/Media/types.ts`). It sets `loading` from `priority` (`src/components/Media/Image/index.tsx:75,80`). So the wrapper must change before any component can request high priority.

## Approach

Use one method: `loading="eager"` + `fetchPriority="high"` on the LCP image. Do not use `priority` or `preload`, and do not add a separate preload link.

## Change

1. Media wrapper:
   - `src/components/Media/types.ts`: add an optional `fetchPriority?: 'high' | 'low' | 'auto'` prop.
   - `src/components/Media/Image/index.tsx`: forward `fetchPriority` to `next/image`. When `fetchPriority === 'high'`, render `loading="eager"`. Otherwise keep the current behaviour. Existing `priority` callers keep working.
2. PDP main image (`src/components/product/Gallery.tsx:21`): pass `fetchPriority="high"` to the main `Media`.
3. PDP thumbnails (`src/components/Grid/tile.tsx:39`): remove `priority={active}`.
   - Other users of `GridTileImage`: `blocks/Carousel/Component.client.tsx:38`, `blocks/ThreeItemGrid/Component.tsx:19`, `app/(app)/products/[slug]/page.tsx:155`. None of them pass `active`, so the removal does not change them.
   - Keep `active` in `Props`, because `Gallery.tsx:39` still passes it. Stop destructuring it, so there is no unused-variable lint warning.
4. Category grid:
   - `src/components/ProductGridItem/index.tsx`: add an optional `isLcpElement?: boolean` prop, default `false`. When it is true, pass `fetchPriority="high"` to `Media`. The name is deliberately not `priority`, which on `Media`/`next/image` means Next's deprecated preload flag.
   - `src/app/(app)/category/[slug]/page.tsx:157`: pass `isLcpElement={index < 3}` from the map index, so the whole first row on `lg` (3 columns) is covered, not only the mobile LCP card.
   - The first three cards are eager and high priority. All other cards stay lazy.
   - `src/app/(app)/shop/page.tsx:97` also renders `ProductGridItem`. It doesn't pass the prop, so it stays unchanged.

## Out of scope

- `sizes`, `quality`, image formats, `minimumCacheTTL`, the home hero, the shop page, storage or Payload config, and the unused `priority` prop in `ThreeItemGrid`. These, and any file not listed above, need my approval first.
- No new dependencies.

## Acceptance criteria

- **PDP:**
  - The main image `<img>` has `fetchpriority="high"` and no `loading="lazy"`.
  - In DevTools Network its Priority is High from the start: check initial priority with "Big request rows".
  - Thumbnails and all other images are still lazy, and no thumbnail is preloaded.
- **Category page:** only the first three card images have `fetchpriority="high"` and are eager. The other cards are lazy.
- **Server-rendered:** the image is present in view source, not added after hydration.
- **Preload links:** there is no `<link rel="preload">` added by the app. If React adds one automatically for the high-priority image, that is acceptable. Record whether it appears.
- **Checks:**
  - Typecheck and lint pass, with no new lint warnings.
  - The DB-free tests pass.
  - No new console warnings.
- **Layout shift:** no new shift. CLS is no worse than baseline (PDP 0, category 0.196).
- **Lighthouse:**
  - Run on a Vercel preview deployment (mobile, median of 3 runs).
  - PDP and category LCP must be better than 5.9 s and 7.0 s.
  - Record the numbers in `docs/performance/`.

## How to verify

- **Code:** typecheck, lint and the DB-free tests (see CLAUDE.md).
- **Local HTML (optional):** with `pnpm dev` running, view source of the PDP and the category page and check the `loading` and `fetchpriority` attributes.
- **Preview:**
  1. The user pushes the branch to get a Vercel preview URL. Claude does not deploy or push.
  2. Check view source and DevTools Network: enable the Priority column, filter by Img, use "Big request rows".
  3. Run the Lighthouse CLI as in the baseline, against the preview URL.

## Rollback

Revert the commit "LCP image priority". It touches six files:

- `Media/types.ts`
- `Media/Image/index.tsx`
- `product/Gallery.tsx`
- `Grid/tile.tsx`
- `ProductGridItem/index.tsx`
- `category/[slug]/page.tsx`

No schema, config or data changes, so the revert is clean.

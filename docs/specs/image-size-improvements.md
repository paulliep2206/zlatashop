# Spec: Responsive image sizing

**Status:** Approved (2026-11-09)
**Source:** `docs/performance/baseline.md` (Home #2, Category #2, Product #5) and the post-PR #6 reports in `lighthouse-reports/after-pr6/`.
**Out of scope:** image quality and format (separate spec: `image-quality.md`), cache lifetime, HTTP/2 and redirects, CLS.

## Problem

On a mobile viewport (412 px CSS wide, DPR 1.75), every storefront image is requested at the largest Next.js width, `w=3840`, whatever size it is displayed at. The browser then downloads the largest variant available, which is the full original.

Measured after PR #6 (Lighthouse 12.8.2, mobile):

| Page     | Image                       | Downloaded                   | Displayed  | Wasted (Lighthouse) |
| -------- | --------------------------- | ---------------------------- | ---------- | ------------------- |
| Home     | `stickerpack_1.png` (card)  | 2048×2048, 385 KiB           | 246×246    | 368 KiB             |
| Home     | `dreamcatchers.png` (card)  | 1254×1254, 190 KiB           | 246×246    | 168 KiB             |
| Home     | `ulamky-2.png` (card)       | 1254×1254, 166 KiB           | 246×246    | 147 KiB             |
| Home     | `homepage-mobile-3.png` (LCP) | 941×1672, 185 KiB          | 412×732    | 77 KiB              |
| Home     | `homepage-desktop-3.png`    | 108 KiB                      | not shown  | 108 KiB (hidden)    |
| Category | 4 product cards (LCP = 1st) | 1254×1254, 148–190 KiB each  | 378×378    | 492 KiB total       |
| Product  | `szhivets.png` (LCP)        | 1254×1254, 178 KiB           | 314×314    | 144 KiB             |

"Properly size images" fails on all three pages: 759 KiB on Home, 492 KiB on Category and 144 KiB on Product.

## Root cause

1. **The default `sizes` in `src/components/Media/Image/index.tsx` is wrong.** No caller passes `size`, so every image gets the fallback built from `cssVariables.breakpoints`:
   `(max-width: 1440px) 1440px, (max-width: 1024px) 1024px, (max-width: 768px) 768px`.
   The browser uses the first media condition that matches. Any viewport up to 1440 px matches the first one, so the image is treated as 1440 px wide: 1440 × 1.75 DPR = 2520 px, which rounds up to `w=3840`. The string also has no fallback length for viewports wider than 1440 px.
2. **The `width={80}` / `height={80}` props (on `ProductGridItem` and `GridTileImage`) don't control what is downloaded.** With a `sizes` attribute present, `next/image` builds the `srcset` from `deviceSizes`, and `sizes` decides which entry is used. The real box is set by CSS (`h-full w-full`).
3. **The hero banner downloads both images.** `HeroBanner` renders the mobile and desktop images, hides one with CSS (`md:hidden` / `hidden md:block`), and marks both `priority`. So both are preloaded eagerly on every viewport.

## Requirements

R1. **Correct default `sizes`.** The Media `Image` default must never resolve to a value wider than the viewport. Use `100vw` as the safe default.

R2. **Per-usage `sizes`.** Every storefront `Media` usage that renders an image passes a `size` that matches its CSS layout:

All values are derived from the page container (`globals.css`): `width: 100%`, padding `1rem` (`2rem` from md), max width 40 / 48 / 64 / 80 / 86rem at sm / md / lg / xl / 2xl. From 1376 px (2xl) the container stops growing and its content box is **1312 px** (1376 − 2 × 32), so every `vw` value is capped with a fixed px value from `(min-width: 1376px)`. Caps are rounded up, so the browser never picks an image narrower than the box.

| Component / usage                                | Layout (from current classes)                                                                     | Implemented `sizes`                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `ProductGridItem` (category, shop)               | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` inside the page container                             | `(min-width: 1376px) 448px, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw`                             |
| `blocks/Carousel` → `GridTileImage` (home cards) | `w-2/3 max-w-[475px] md:w-1/3`, carousel `-ml-4` / item `pl-4`                                    | `(min-width: 1376px) 443px, (min-width: 768px) 33vw, 67vw` ((1312 + 16) / 3 − 16; `475px` is never reached)        |
| `blocks/ThreeItemGrid` → `GridTileImage`         | `md:grid-cols-6 gap-4`; full tile `md:col-span-4`, half tiles `md:col-span-2`                     | full: `(min-width: 1376px) 870px, (min-width: 768px) 67vw, 100vw`; half: `(min-width: 1376px) 427px, (min-width: 768px) 33vw, 100vw` |
| PDP `RelatedProducts` → `GridTileImage`          | `w-full min-[475px]:w-1/2 sm:w-1/3 md:w-1/4 lg:w-1/5`                                             | `(min-width: 1376px) 263px, (min-width: 1024px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, (min-width: 475px) 50vw, 100vw` |
| PDP `Gallery` main image                         | full column, `lg:basis-1/2`                                                                       | `(min-width: 1376px) 656px, (min-width: 1024px) 50vw, 100vw` (see Notes)                                          |
| PDP `Gallery` thumbnails → `GridTileImage`       | `basis-1/5` of the gallery column (≈ 607 px at 2xl: card `p-8` + border, `lg:gap-8`)              | `(min-width: 1376px) 109px, (min-width: 1024px) 10vw, 20vw`                                                       |
| `HeroBanner`                                     | full width                                                                                        | `100vw` (both the `<picture>` and the single-image fallback)                                                     |
| `heros/HighImpact`                               | full-bleed `fill`                                                                                 | `100vw` (explicit)                                                                                               |
| `heros/MediumImpact`                             | container plus `-mx-4 md:-mx-8 2xl:-mx-16` (1312 + 2 × 64 = 1440 px at 2xl)                       | `(min-width: 1376px) 1440px, 100vw`                                                                              |
| `blocks/ImageText`                               | `md:grid-cols-2`, `lg:gap-16` ((1312 − 64) / 2 = 624 px at 2xl)                                   | `(min-width: 1376px) 624px, (min-width: 768px) 50vw, 100vw`                                                       |
| `blocks/MediaBlock` (layout block and RichText)  | inside the container, never wider than it                                                         | new optional `size` prop, default `(min-width: 1376px) 1312px, 100vw`                                             |
| `ProductItem`, `CheckoutPage` thumbnails         | `h-20 w-20 p-2` box (64 px image)                                                                 | `64px`                                                                                                           |
| `Cart/CartModal` thumbnails                      | `h-16 w-16` box                                                                                   | `64px`; switched from direct `next/image` to `<Media fill>` so it shares the Media defaults (quality, lazy loading) |

`GridTileImage` is shared by the carousel, ThreeItemGrid, related products and gallery thumbnails, so it takes a `sizes` prop from the caller (passed through to Media's `size`) instead of one hard-coded value. It falls back to `100vw` when no value is passed.

`components/Logo` (an unused template leftover that loads an external SVG) is out of scope.

R3. **The hero banner downloads one image per viewport.** When both mobile and desktop images are usable, `HeroBanner` renders one `<picture>` built with `getImageProps()` from `next/image` (the documented Next.js approach): a `<source media="(min-width: 768px)">` for desktop and an `<img>` for mobile. Only the image for the current breakpoint is downloaded. The `<source>` carries the desktop `width`/`height`, so each breakpoint reserves its own aspect ratio. The LCP `<img>` stays `loading="eager"` and `fetchPriority="high"` (PR #6 behaviour).

- **Guard:** an image counts as usable only when it has `url`, `width` and `height` (`isUsableImage`), because `getImageProps` throws without them. If only one image is usable, it is shown at every breakpoint through `<Media priority size="100vw">`. If neither is usable, the banner renders nothing.
- **No preload:** the old `priority` also emitted `<link rel="preload">`; the `<picture>` path does not. The `<img>` is in the server-rendered HTML, so the cost is expected to be small. Decision: keep as is and watch hero LCP after deploy. If it gets worse, add `ReactDOM.preload` with `media` / `imageSrcSet` / `imageSizes` for each breakpoint.

R4. **No visual change.** Displayed dimensions, aspect ratios, `object-cover` cropping and the PR #6 `fetchPriority` / eager-loading behaviour stay the same. Quality stays at `q=90` (the quality spec handles that). The value lives in one place, `IMAGE_QUALITY` in `src/components/Media/constants.ts`, used by `Media/Image` and `HeroBanner`. It is a separate module because `Media/Image` is `'use client'`, and a server component can't import a plain value from a client module. It must stay listed in `images.qualities` in `next.config.ts`.

R5. **Remove misleading props.** Drop or document `width={80}` / `height={80}` where they don't affect what is downloaded, but only if removing them doesn't change layout or `next/image` validation. Otherwise leave them and add a comment. **Implemented:** kept on `ProductGridItem` and `GridTileImage`, with a comment that they only set the intrinsic aspect ratio.

## Acceptance criteria

Measure with `pnpm perf -- <url> --label "<PR>"` on all three pages after deploy, and record the results in `docs/performance/results.md`.

- AC1: On mobile, no storefront image is requested at `w=3840`. Cards and the PDP image are requested at `w ≤ 828` (378 CSS px × 1.75 DPR ≈ 662 px → `w=750`).
- AC2: "Properly size images" (`uses-responsive-images`) passes, or reports < 50 KiB, on Home, Category and Product.
- AC3: On Home at mobile, `homepage-desktop-3.png` is not downloaded. On desktop (`--preset=desktop`, spot check only), `homepage-mobile-3.png` is not downloaded.
- AC4: Total image bytes per page drop by at least 50% against the post-PR #6 run (Home ≈ 1,036 KiB, Category ≈ 682 KiB, Product ≈ 178 KiB).
- AC5: "Largest Contentful Paint image was lazily loaded" still passes on Category and Product. The LCP element is unchanged.
- AC6: Desktop visual check of the home, category and PDP pages: images are sharp at 1× and 2× DPR (no upscaling blur).
- AC7: Typecheck, lint (0 errors, no new warnings) and the DB-free tests pass. Any e2e test that queries images still passes.

## Notes and risks

- Smaller `w` values create new `/_next/image` variants. On Vercel these count as new image transformations. The first request per variant is a cache MISS.
- **Cache lifetime is still 60 s:** `/_next/image` responses on the deployed `git-main` URL still return `cache-control: public, max-age=60`, even though `minimumCacheTTL: 2678400` was added in `833f21e` (now on main). This doesn't block this spec, but it is a separate open issue (baseline #1 on Home and Category) and needs its own investigation.
- Exact `sizes` strings depend on the page container's max width and padding. The values in R2 were derived from `.container` in `src/app/(app)/globals.css`. If the container, grid gaps or paddings change, recompute them.
- **Gallery main image cap kept at `656px`:** the real column at 2xl is ≈ 607 px (the PDP card's `p-8`, border and `lg:gap-8`). 656 px slightly overestimates, which is safe (never blurry). It was left unchanged on purpose.
- **Between breakpoints the `vw` values are upper bounds:** for example, at 1024–1375 px the container is capped at 1024 / 1280 px, so `33vw` asks for somewhat more than the card shows. This affects desktop only and is accepted.
- **CartModal alt text:** the old `alt={image.alt || product.title}` fallback is gone. It was unreachable, because `alt` is required on the Media collection and `Media/Image` uses the resource's `alt`.
- **Hero `alt`:** `alt={imgProps.alt}` stays explicit on the `<img>` even though the spread already includes it, because `jsx-a11y/alt-text` can't see through the spread and would add a lint warning.

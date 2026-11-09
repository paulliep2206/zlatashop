# Performance baseline

- **Date:** 2026-11-09
- **Tool:** Lighthouse CLI 12.8.2 (`npx --yes lighthouse@12`), headless Chrome
- **Mode:** mobile (Lighthouse default: emulated Moto G Power, simulated throttling)
- **Runs:** 3 per page, sequential. Each value below is the median of the 3 runs, taken per metric.
- **Raw reports:** `lighthouse-reports/<page>-run<N>.json` (git-ignored, local only)

## Tested URLs

| Page     | URL                                                                                          |
| -------- | -------------------------------------------------------------------------------------------- |
| Home     | https://zlatasoloveywriter-git-main-paulliep2206-gmailcoms-projects.vercel.app/              |
| Category | https://zlatasoloveywriter-git-main-paulliep2206-gmailcoms-projects.vercel.app/category/books |
| Product  | https://zlatasoloveywriter-git-main-paulliep2206-gmailcoms-projects.vercel.app/products/szhivets |

## Median results

| Page     | Performance | Accessibility | Best Practices | SEO | LCP   | CLS   | TBT   |
| -------- | ----------- | ------------- | -------------- | --- | ----- | ----- | ----- |
| Home     | 65          | 88            | 96             | 54  | 8.3 s | 0     | 8 ms  |
| Category | 67          | 89            | 96             | 63  | 7.0 s | 0.196 | 15 ms |
| Product  | 71          | 85            | 96             | 63  | 5.9 s | 0     | 25 ms |

All 9 runs completed with no runtime errors and no run warnings, so every value was measured.

### Run-to-run variation (min–max of 3 runs)

- **Home:** Performance 65–72, LCP 8.0–8.9 s, CLS 0–0.176 (the shift appeared in 1 of 3 runs), TBT 3–16 ms
- **Category:** Performance 66–75, LCP 4.4–8.1 s, CLS 0.196 in all runs, TBT 11–36 ms
- **Product:** Performance 71–76, LCP 5.8–6.0 s, CLS 0 in all runs, TBT 20–30 ms. SEO was 54 in run 1 and 63 in runs 2–3, because run 1 failed "Document does not have a meta description" and runs 2–3 passed it.

## Top issues

Each page's issues come from its median run: Home run 3, Category run 3, Product run 1. Titles and values are copied from the Lighthouse audits. Issues are ranked by Lighthouse's estimated LCP savings, plus the layout-shift audit where CLS fails. Savings estimates overlap and don't add up.

### Home

LCP element: `img` "Серія темного епічного фентезі "Джерело Лаверн"" (`homepage-mobile-3.png`). LCP breakdown: TTFB 8%, Load Delay 42%, Load Time 30%, Render Delay 20%.

1. **Use efficient cache lifetimes**: Est savings of 1,027 KiB (est. LCP −2,700 ms). The `/_next/image?url=/api/media/file/…` images are cached for only 60 s (`cacheLifetimeMs: 60000`).
2. **Improve image delivery**: Est savings of 872 KiB (est. LCP −2,400 ms). The related audit "Properly size images" reports Est savings of 759 KiB. Images displayed at 80×80 are requested at `w=3840` (e.g. `stickerpack_1.png`, 394 KiB, 96% wasted).
3. **Use HTTP/2**: 1 request not served via HTTP/2 (est. LCP −2,050 ms, FCP −600 ms). The request is the document URL itself, served over `http/1.1`.
4. **Avoid multiple page redirects**: Est savings of 810 ms (est. LCP/FCP −800 ms). The document URL redirects to itself before loading.
5. **Avoid large layout shifts**: 1 layout shift found (CLS 0.176 in this run). Culprit: the LCP hero `img`, with the cause "Media element lacking an explicit size".

### Category (`/category/books`)

LCP element: `img` "Живець" (product card image, `loading="lazy"`). LCP breakdown: TTFB 9%, Load Delay 51%, Load Time 24%, Render Delay 16%.

1. **Use efficient cache lifetimes**: Est savings of 677 KiB (est. LCP −1,900 ms). Same 60 s cache on `/_next/image` product images.
2. **Improve image delivery**: Est savings of 620 KiB (est. LCP −1,750 ms). The related audit "Properly size images" reports Est savings of 492 KiB. Product card images rendered at 80×80 are requested at `w=3840`.
3. **Use HTTP/2**: 1 request not served via HTTP/2 (est. LCP −1,700 ms, FCP −600 ms).
4. **Largest Contentful Paint image was lazily loaded** (est. LCP −1,050 ms). The first product card image has `loading="lazy"`.
5. **Avoid large layout shifts**: 1 layout shift found (CLS 0.196, the same in all 3 runs). The shift is reported on `body > main`, the product grid.

### Product (`/products/szhivets`)

LCP element: `img` "Живець" (main product image, `loading="lazy"`, 1254×1254). LCP breakdown: TTFB 18%, Load Delay 76%, Load Time 3%, Render Delay 3%.

1. **Use HTTP/2**: 1 request not served via HTTP/2 (est. LCP −1,550 ms, FCP −1,000 ms).
2. **Document request latency**: Est savings of 1,560 ms. Lighthouse lists "Had redirects (1 redirects, +1004 ms)" and "Server responded slowly (observed 654 ms)". The response was `x-vercel-cache: MISS` at the time of testing.
3. **Largest Contentful Paint image was lazily loaded** (est. LCP −900 ms). The main product image has `loading="lazy"`.
4. **Avoid multiple page redirects**: Est savings of 800 ms (est. LCP/FCP −800 ms).
5. **Improve image delivery**: Est savings of 167 KiB (est. LCP −750 ms). "This image file is larger than it needs to be (1254x1254) for its displayed dimensions (314x314)."

### Other failing audits (all three pages unless noted)

- Accessibility: "Buttons do not have an accessible name": a sheet-trigger `button` in the header and a `combobox` select trigger labelled "Auto". "`[aria-*]` attributes do not match their roles": a sheet-trigger `div` in the header with `type="button"` and `aria-haspopup="dialog"`.
- Accessibility (product only): "Background and foreground colors do not have a sufficient contrast ratio." The failing element is the "ЗАЛИШИЛОСЯ 5 ЕКЗЕМПЛЯРІВ" text.
- Accessibility (home only): "Image elements have `[alt]` attributes that are redundant text."
- Best Practices: "Browser errors were logged to the console": 404 for `/favicon.svg` and `/favicon.ico`.
- SEO: "Page is blocked from indexing" on all pages. "Document does not have a meta description" on home and in 1 of 3 product runs.
- Performance (product only): "Page prevented back/forward cache restoration": 2 failure reasons, both `Cache-Control: no-store`.

## Notes and caveats

- **The URLs are a Vercel preview (`git-main`) deployment, not a production domain.** All three pages respond with `x-robots-tag: noindex`, which Vercel adds to preview deployments. That header is what fails "Page is blocked from indexing" and costs a large share of the SEO score. A production domain will likely score higher on SEO without any code change.
- The redirect and HTTP/1.1 findings both concern the first hop of the document request, which redirects to the same URL. This may be a preview-deployment behaviour rather than an app issue. The cause was **not** verified, so re-check it on the production domain before acting on it.
- Simulated throttling adds noise (see the variation above). Compare future runs against these medians with the same Lighthouse major version and the same settings.
- How to reproduce: `npx --yes lighthouse@12 "<url>" --output=json --output-path=lighthouse-reports/<page>-run<N>.json --chrome-flags="--headless=new" --quiet`

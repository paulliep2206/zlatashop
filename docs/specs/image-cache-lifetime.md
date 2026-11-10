# Spec: Image cache lifetime

**Status:** Approved (2026-11-10)
**Source:** `docs/performance/baseline.md` (Home #1, Category #1) and the PR #8 reports in `lighthouse-reports/2026-11-09-pr-8-*.json`.
**Decision:** option 2, a 1-day lifetime with background refresh (see Approach).

## Problem and evidence

- "Use efficient cache lifetimes" still fails after PR #8: Home 345 KiB, Category 349 KiB, Product 114 KiB. The baseline estimate was LCP −2,700 ms on Home and −1,900 ms on Category.
- Lighthouse reports `cacheLifetimeMs: 60000` for every `/_next/image` URL.
- Manual check on the `git-main` preview (2026-11-10):
  - `/_next/image?url=%2Fapi%2Fmedia%2Ffile%2Fszhivets.png&w=750&q=90`: `cache-control: public, max-age=60`, `x-vercel-cache: HIT`
  - `/api/media/file/szhivets.png` (the source): `cache-control: public, max-age=0, must-revalidate`
- `minimumCacheTTL: 2678400` is in `next.config.ts` on `origin/main` (added in `833f21e`). The deployment includes it: it already serves the PR #8 widths (`w=640` / `w=750`), and PR #8 is newer than `833f21e`. So the setting is deployed but not applied.

## Root cause (working hypothesis)

Vercel's image optimizer takes the browser-facing lifetime from the source image's `Cache-Control`, not from `minimumCacheTTL`. The source says `max-age=0`, so Vercel falls back to a 60 s default. `HIT` shows that Vercel caches the image on its own servers. Only the header sent to the browser is short. This fits all the evidence but is not proven until Approach step 1 and the preview check.

## Approach

Option 2 was chosen over a 31-day lifetime. Media filenames are not content-hashed, so a file re-uploaded under the same name must reach visitors within about a day.

Target header on media file responses:

```
Cache-Control: public, max-age=86400, stale-while-revalidate=604800
```

## Change

1. **Verify first (no code):** confirm that `upload.modifyResponseHeaders` in `src/collections/Media.ts` runs for `/api/media/file/*` while `@payloadcms/storage-uploadthing` is active (`src/plugins/index.ts`). If the adapter's static handler bypasses the hook, stop and report back before changing anything else.
2. `src/collections/Media.ts`: in the existing `modifyResponseHeaders`, set the header above. Keep the current `content-length: 0` handling unchanged.

## Out of scope

- `next.config.ts` (`minimumCacheTTL`, `qualities`, `formats`), `sizes`, image quality, the storage adapter config, HTTP/2 and redirects, CLS.
- Any file other than `src/collections/Media.ts`. No new files without approval.
- No new dependencies and no schema change, so no `generate:types` run.

## Acceptance criteria

- AC1: `/api/media/file/<name>` returns `cache-control: public, max-age=86400, stale-while-revalidate=604800`.
- AC2: `/_next/image?url=…` returns `max-age` ≥ 86400. Vercel may not pass `stale-while-revalidate` through; record what it returns.
- AC3: in the Lighthouse report, `cache-insight` shows `cacheLifetimeMs` ≥ 86400000 for `/_next/image` URLs. The audit may still be flagged, because 1 day is shorter than Lighthouse prefers. That is accepted under option 2.
- AC4: on a normal reload (Disable cache unticked), images show "(disk cache)" or "(memory cache)" in the Network Size column.
- AC5: images still render in the storefront and the admin (thumbnails, upload preview).
- AC6: typecheck and lint pass (0 errors, no new warnings), and the DB-free tests pass.
- AC7: no layout shift added. CLS is no worse than the PR #8 medians (Home 0.176, Category 0, Product 0).

## How to verify

1. **Code:** typecheck, lint and the DB-free tests (see CLAUDE.md).
2. **Preview:** the user pushes the branch to get a Vercel preview URL. Claude does not deploy or push.
3. **Headers on the preview:** check the source and resized image headers.
   - DevTools: Network → Img → click a row → Response Headers → `cache-control`.
   - Or curl (use GET; HEAD returns 404 on `/api/media/file/*`):
     ```bash
     curl -s -o /dev/null -D - "<preview>/api/media/file/szhivets.png" | grep -i cache-control
     curl -s -o /dev/null -D - "<preview>/_next/image?url=%2Fapi%2Fmedia%2Ffile%2Fszhivets.png&w=750&q=90" | grep -i cache-control
     ```
4. **Repeat view:** reload the page with Disable cache unticked and check the Size column (AC4).
5. **Lighthouse:** `pnpm perf -- <preview url> --label "<PR>"` on Home, Category and Product (mobile, median of 3), not localhost. Record the results in `docs/performance/results.md`.

## Risks

- A file re-uploaded under the same name can be served stale for up to 1 day, plus up to 7 days of background refresh, which serves the old copy once while fetching the new one.
- If the hypothesis is wrong (the source header changes but `/_next/image` stays at 60 s), the fix is elsewhere, for example Vercel image settings. That needs a new decision. Don't widen this spec.

## Rollback

Revert the "image cache lifetime" commit. It touches only `src/collections/Media.ts`, with no schema, config or data changes, so the revert is clean.

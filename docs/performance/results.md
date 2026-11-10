# Performance results

Running log of Lighthouse measurements. Add new rows at the bottom; don't create a new file per run.

**Method (keep it the same so rows stay comparable):** Lighthouse CLI 12.8.2 (`npx --yes lighthouse@12`), mobile (default: emulated Moto G Power, simulated throttling), headless Chrome, 3 sequential runs per page. Each value is the median of the 3 runs, taken per metric. Full method and the baseline's issue list are in [baseline.md](baseline.md).

URLs (Vercel `git-main` preview deployment):

- Home: https://zlatasoloveywriter-git-main-paulliep2206-gmailcoms-projects.vercel.app/
- Category: https://zlatasoloveywriter-git-main-paulliep2206-gmailcoms-projects.vercel.app/category/books
- Product: https://zlatasoloveywriter-git-main-paulliep2206-gmailcoms-projects.vercel.app/products/szhivets

## Core results

| Date       | Spec / PR                                                                            | Page      | Perf score | LCP   | CLS   | TBT     | Notes                                                                                         |
| ---------- |--------------------------------------------------------------------------------------|-----------|------------| ----- |-------|---------|-----------------------------------------------------------------------------------------------|
| 2026-11-09 | Baseline                                                                             | Home      | 65         | 8.3 s | 0     | 8 ms    | CLS 0.176 in 1 of 3 runs (hero img without explicit size)                                     |
| 2026-11-09 | Baseline                                                                             | Category  | 67         | 7.0 s | 0.196 | 15 ms   | LCP image lazy-loaded; CLS 0.196 in all runs                                                  |
| 2026-11-09 | Baseline                                                                             | Product   | 71         | 5.9 s | 0     | 25 ms   | LCP image lazy-loaded                                                                         |
| 2026-11-09 | [PR #6](https://github.com/paulliep2206/zlatashop/pull/6) (LCP image priority)       | Home      | 72         | 7.8 s | 0     | 5 ms    | Perf 67–76, LCP 6.3–8.5 s across runs; no layout shift in any run                             |
| 2026-11-09 | [PR #6](https://github.com/paulliep2206/zlatashop/pull/6) (LCP image priority)       | Category  | 73         | 7.8 s | 0     | 17 ms   | LCP image no longer lazy-loaded (audit passes); LCP 7.7–8.8 s; CLS 0.196 still in 1 of 3 runs |
| 2026-11-09 | [PR #6](https://github.com/paulliep2206/zlatashop/pull/6) (LCP image priority)       | Product   | 76         | 5.9 s | 0     | 12 ms   | LCP image no longer lazy-loaded (audit passes); Perf 76 in all runs; SEO 54 in run 1          |
| 2026-11-09 | [PR #8](https://github.com/paulliep2206/zlatashop/pull/8) (Image sizing)             | Home      | 70         | 6.7 s | 0.176 | 5 ms    | Perf 67–76, LCP 5.9 s–6.7 s across runs; CLS > 0 in 2 of 3 runs                               |
| 2026-11-09 | [PR #8](https://github.com/paulliep2206/zlatashop/pull/8) (Image sizing)             | Category  | 75         | 6.5 s | 0     | 16 ms   | Perf 68–77, LCP 6.1 s–6.8 s across runs; CLS > 0 in 1 of 3 runs                               |
| 2026-11-09 | [PR #8](https://github.com/paulliep2206/zlatashop/pull/8) (Image sizing)             | Product   | 77         | 5.4 s | 0     | 6 ms    | Perf 76–78, LCP 5.3 s–5.4 s across runs                                                       |
| 2026-11-10 | [PR #10](https://github.com/paulliep2206/zlatashop/pull/10) (Image cache lifetime)   | Home      | 68         | 6.7 s | 0.176 | 4 ms    | Perf 68–70, LCP 6.1 s–7.3 s across runs; CLS > 0 in 2 of 3 runs                               |
| 2026-11-10 | [PR #10](https://github.com/paulliep2206/zlatashop/pull/10) (Image cache lifetime)   | Category  | 68         | 6.3 s | 0.196 | 11 ms   | Perf 68–75, LCP 6.2 s–7.3 s across runs; CLS > 0 in 2 of 3 runs                               |
| 2026-11-10 | [PR #10](https://github.com/paulliep2206/zlatashop/pull/10) (Image cache lifetime)   | Product   | 77         | 5.5 s | 0     | 16 ms   | Perf 76–77, LCP 5.4 s–5.6 s across runs                                                       |

## Other category scores (medians)

| Date       | Spec / PR | Page      | Accessibility | Best Practices | SEO  |
| ---------- |-----------|-----------|---------------|----------------|------|
| 2026-11-09 | Baseline  | Home      | 88            | 96             | 54   |
| 2026-11-09 | Baseline  | Category  | 89            | 96             | 63   |
| 2026-11-09 | Baseline  | Product   | 85            | 96             | 63   |
| 2026-11-09 | PR #6     | Home      | 88            | 96             | 54   |
| 2026-11-09 | PR #6     | Category  | 89            | 96             | 63   |
| 2026-11-09 | PR #6     | Product   | 85            | 96             | 63   |
| 2026-11-09 | PR #8     | Home      | 88            | 96             | 54   |
| 2026-11-09 | PR #8     | Category  | 89            | 96             | 63   |
| 2026-11-09 | PR #8     | Product   | 85            | 96             | 63   |
| 2026-11-10 | PR #10    | Home      | 88            | 96             | 54   |
| 2026-11-10 | PR #10    | Category  | 89            | 96             | 63   |
| 2026-11-10 | PR #10    | Product   | 85            | 96             | 63   |

## Notes

- **PR #6 run (2026-11-09):** all 9 runs completed with no runtime errors or run warnings. Raw reports are in `lighthouse-reports/after-pr6/<page>-run<N>.json` (git-ignored, local only).
- SEO is capped on all pages by "Page is blocked from indexing" (`x-robots-tag: noindex` on Vercel preview deployments), not by the app. Expect higher SEO on a production domain.
- Simulated throttling is noisy: single-run Perf varies by up to ~9 points on the same page. Treat differences of a few points or a few hundred ms of LCP as noise.

# Regression test suite

Two layers, both gated on every build via `.github/workflows/regression.yml`.

## Unit (Vitest, happy-dom)

`bun run test:unit`

Covers pure logic that is most likely to silently regress:

- `src/lib/format.ts` — number, percent, price, market-cap, currency symbol
- `src/lib/scores.ts` — value/momentum/quality/risk/confidence scoring
- `src/lib/backtest.ts` — historical-return windows

Add a unit test whenever you touch a pure helper in `src/lib/`.

## E2E (Playwright, headless Chromium)

`bun run test:e2e` (auto-starts `vite preview` on port 4173).

Suites:

- `public-routes.spec.ts` — `/`, `/app`, `/compare`, `/watchlist`, `/events`,
  `/data-quality`, `/sources`, `/changelog`, `/settings` render with the
  expected H1 and zero console errors.
- `terminal.spec.ts` — `/terminal/AAPL` deep-link mounts and surfaces the
  ticker; unknown tickers do not blank the screen (validates the v1.3.5 fix).
- `auth-gating.spec.ts` — `/portfolio` and `/alerts` redirect or gate
  unauthenticated users; `/auth` shows the email input.
- `screener-watchlist.spec.ts` — `/app` loads rows and accepts a search
  filter; `/watchlist` renders with controls.

Auth-gated user flows (alerts CRUD, portfolio writes) are intentionally
covered as **gating checks** here. Full authenticated E2E requires a mocked
Supabase session and is tracked as future work — see CHANGELOG v1.4.0.

## Running everything

`bun run test:regression`

## Local quickstart

```bash
bun install
bun run test:e2e:install   # one-time browser download
bun run test:regression
```

# Global Equity Terminal

> **v1.8.0 — "Delivery"** · A keyboard-driven, AI-augmented research terminal for global equities.

Global Equity Terminal blends terminal-style data density with an AI co-pilot
layer. It's built for retail and prosumer investors who want fast research,
transparent scoring, and live monitoring across **US, India, Europe, Japan,
Hong Kong, Korea, Taiwan, Singapore, and Australia**.

## What's inside

- **Screener & Heatmap** — filter the global universe by region, sector,
  valuation (P/E, P/B, dividend yield), momentum (RSI, ROC, MA cross), and
  proximity to 52-week range. Visualize as table, cards, or sector heatmap.
- **Terminal page** — per-ticker deep dive: price chart, technicals,
  fundamentals, transparent **Value / Momentum / Quality / Risk / Confidence**
  scores, AI narrative, **Ask the Terminal** chat, news catalysts with cited
  sources, and **diff mode** to compare snapshots over time.
- **Ask the Terminal** *(v1.6)* — conversational Q&A docked to every
  ticker page, grounded strictly in the metrics already on screen.
- **AI Morning Brief** *(v1.6)* — one-paragraph digest of overnight
  moves across your watchlist, with chips for the biggest movers.
- **Scheduled Morning Brief** *(v1.7, email delivery in v1.8)* — opt-in daily generation:
  pick a UTC hour and an hourly `pg_cron` job produces a fresh brief over
  your watchlist, stored in your brief history. v1.8 adds optional email delivery
  from `notify.rankaisolutions.tech` (per-user opt-in, with override address).
- **Thesis Tracker** *(v1.6)* — write a one-paragraph thesis per
  ticker; the terminal re-evaluates it against live metrics and flags when
  it's `intact` / `monitor` / `breaking` / `broken`.
- **Thesis-break alerts** *(new in v1.7)* — when a thesis flips into
  `breaking` or `broken`, the system auto-fires an alert event so the bell
  badge lights up — no manual rule needed.
- **Compare & Watchlists** — side-by-side ticker comparison and persistent
  watchlists synced to your account.
- **Portfolio** — holdings with live valuation, unrealized P&L, and allocation
  breakdown by sector and region. Auth-gated and protected by row-level
  security.
- **Alerts** — rule-based alerts on price, RSI, 52-week range proximity, and
  5-day momentum, plus thesis-break notifications. Evaluated server-side with
  in-app notifications and a 12h cooldown per rule.
- **Research toolkit** — events calendar, data quality view, sources panel,
  PDF export, currency toggle, command palette, keyboard shortcuts, and a full
  in-app glossary covering every metric.

## Tech stack

- **Frontend**: TanStack Start v1 + React 19, Vite 7, Tailwind CSS v4
- **Backend**: Lovable Cloud (Postgres + Auth + RLS) via server functions
- **Auth transport**: protected server calls attach the active session token explicitly and degrade to empty states on transient auth failures.
- **AI**: Lovable AI Gateway (Gemini / GPT models) for narrative & catalysts
- **Deploy**: Cloudflare Workers (edge SSR)

## Routes

- `/` — public marketing landing. Seven-section flow: Hero, Proof Strip
  (live region coverage + top movers), About, How it works, Capabilities,
  Personas, and final CTA. Signed-in users are auto-redirected to `/app`.
- `/app` — the workspace: screener, filters, presets, table / cards / heatmap.
  All URL search state is preserved, so deep links still work.
- `/terminal/$symbol`, `/compare`, `/watchlist`, `/portfolio`, `/theses`, `/alerts`,
  `/events`, `/data-quality`, `/sources`, `/settings`, `/changelog`, `/auth`, `/legal`.

## Getting around

The top nav is grouped into 4 dropdown menus:

- **Research** — Screener · Analysis · Compare
- **Workspace** — Watchlists · Portfolio · Theses · Alerts
- **Market** — Events
- **System** — Data Quality · Sources · Settings

| Shortcut | Action               |
| -------- | -------------------- |
| `?`      | Shortcuts & glossary |
| `⌘/Ctrl K` | Command palette    |
| `e`      | Export current view  |
| `g` then `p` | Go to Portfolio  |
| `g` then `w` | Go to Watchlist  |

## Documentation

- **In-app glossary** — press `?` and open the Glossary tab. Every metric,
  score, and feature is defined and tooltipped throughout the UI.
- **Changelog** — see [`CHANGELOG.md`](./CHANGELOG.md) or visit `/changelog`
  in the app.
- **Version** — single source of truth in [`src/lib/version.ts`](./src/lib/version.ts).

## Project conventions

- All documentation (this README, PRD, in-app glossary, tooltips, and
  CHANGELOG) is updated on every version bump. Features ship together with
  their docs — never separately.
- Semantic design tokens live in `src/styles.css`; never hard-code colors in
  components.
- Server-side logic lives under `src/server/` (`*.functions.ts` for typed RPC,
  `*.server.ts` for server-only helpers).

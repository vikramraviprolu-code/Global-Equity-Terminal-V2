# Changelog

All notable changes to **Global Equity Terminal** are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [SemVer](https://semver.org/).

## [1.0.0] — 2026-04-29 — "Atlas"

First stable release. The terminal now covers research, monitoring, and personal portfolio tracking end-to-end.

### Added
- **Portfolio mode** — holdings, live valuation, unrealized P&L, allocation by sector and region. Backed by Lovable Cloud with row-level security.
- **Alerts engine** — rule-based alerts on price, RSI, 52-week range proximity, and 5-day momentum. Server-side evaluation with 12h cooldown per rule.
- **In-app notifications** — `AlertBell` with unread badge and toast delivery; `/alerts` page to manage rules and view event history.
- **Authentication** — Email/password + Google OAuth via Lovable Cloud. `AuthProvider` wraps the app; `/auth` route handles sign-in / sign-up.
- **News & Catalysts** — AI-curated catalysts per ticker with cited sources, integrated into the terminal page.
- **Landing page refresh** — Intelligence Layer grid expanded to 6 capabilities (Portfolio, Alerts, News, Co-pilot, Narrative, Diff Mode); added Portfolio CTA in the hero.
- **Versioning** — `src/lib/version.ts` as single source of truth, `CHANGELOG.md`, footer build tag, semver in `package.json`.

### Infrastructure
- Enabled Lovable Cloud (Supabase) with migrations for `holdings`, `alerts`, `alert_events` tables and RLS policies.
- New server functions: `portfolio.functions.ts`, `alerts.functions.ts`, `news.functions.ts`.

## [0.x] — Pre-release

Pre-1.0 work: screener, terminal analysis page, compare, watchlists, events calendar, AI narrative, diff mode, sector heatmap, data quality view, sources panel, currency toggle, keyboard shortcuts, command palette, PDF export.

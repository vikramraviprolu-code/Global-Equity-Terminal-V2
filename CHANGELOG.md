# Changelog

All notable changes to **Global Equity Terminal** are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [SemVer](https://semver.org/).

## [1.6.0] — 2026-04-30 — "Differentiator" (minor)

USP release — three AI-native features competitors don't bundle today.

### Added
- **Ask the Terminal** (`src/components/ask-terminal.tsx`, `src/server/v16.functions.ts → askTerminal`) — conversational Q&A docked to every ticker page. The chat is grounded in the same `facts` block used by the AI Narrative (price, valuation, momentum, recommendation), so the model never invents numbers. 4 starter prompts, 500-char input cap, 20-turn history window. Non-streaming for parity with existing AI helpers.
- **AI Morning Brief** (`src/components/morning-brief.tsx`, `generateBrief`) — one-paragraph digest of overnight moves over the active watchlist (up to 30 tickers). Highlights the 5 largest |5D %| movers as colored chips. Persists each run to `brief_runs` (RLS-scoped) for history. On-demand generation only — no auto-burn of AI credits.
- **Thesis Tracker** (`src/routes/theses.tsx`, `upsertThesis` / `listTheses` / `evaluateThesis` / `deleteThesis`) — write a one-paragraph thesis per ticker; AI re-evaluates against live metrics on demand and tags it `intact` / `monitor` / `breaking` / `broken` with 2–4 sentence rationale. Tool-calling enforces structured verdicts. Unique per `(user_id, symbol)`.
- **Schema** — new `theses` and `brief_runs` tables. Both RLS-scoped to `auth.uid()`. `theses.updated_at` is auto-maintained by the existing `set_updated_at()` trigger.
- **Nav** — `/theses` added to the Workspace group.

### Notes
- All three features go through the existing `chat()` helper → Lovable AI Gateway. No new secrets, no new providers, no new redistribution risk.
- Prompts inherit the v1.5.2 hardening: never quote articles verbatim, never name publishers, never invent numbers.

## [1.5.2] — 2026-04-30 — "Console" (patch)

Data-rights hygiene — tighten news prompt, attribute upstream sources, propagate disclaimer to PDF exports.

### Changed
- **News prompt (`src/server/news.functions.ts`)**: explicitly forbids verbatim quoting of source articles, drops named publishers (Bloomberg/FT/WSJ/Reuters/CNBC) from the system prompt, requires paraphrase only. Reduces risk of re-publishing copyrighted text.
- **`/sources` page**: removed unused Stooq entry; added Perplexity (News) and Lovable AI Gateway entries to accurately reflect what is actually called. Each source card now carries a per-source `rights` line. New "Data rights & attribution" panel + cross-link to `/legal`.
- **PDF report footer (`src/lib/pdf-report.ts`)**: expanded the single-line disclaimer into a full attribution block — third-party data ownership, AI-content caveat, trademark notice — so exported PDFs remain compliant when shared outside the app.

## [1.5.1] — 2026-04-30 — "Console" (patch)

IP & disclaimer hygiene — reduce trademark/legal risk surface.

### Added
- **`/legal` route** — formal "not investment advice" disclaimer, data-source attribution language, AI-content caveat, third-party trademark notice, copyright statement, and limitation-of-liability boilerplate. Linked from the landing-page footer.

### Changed
- README: replaced "Bloomberg-style data density" with "terminal-style data density" to avoid implying affiliation with the Bloomberg trademark.

## [1.5.0] — 2026-04-30 — "Console" (minor)

Production hardening — error visibility, query defaults, mobile pass.

### Added
- **Error logging pipeline** — new `error_logs` table + `reportError` server function + `logClientError` client helper. Captures errors from `AppErrorBoundary`, router `defaultErrorComponent`, and global `unhandledrejection`/`error` listeners. Server attributes to `auth.uid()` via verified bearer token; never trusts client-supplied `user_id`. Dedupes identical messages within 60s, swallows its own failures, truncates payloads.
- **Centralised React Query defaults** in `src/router.tsx` — `staleTime` 60s, `gcTime` 5min, `refetchOnWindowFocus` off, `refetchOnReconnect` on, `networkMode` online, smart retry that skips 4xx (auth/validation) and retries transient once. Mutations never auto-retry.
- **Mobile defense-in-depth** — `body { overflow-x: hidden }` to prevent stray elements from breaking layout on <768px.

### Audited (no changes needed)
- Wide tables on Screener, Watchlist, Compare, Portfolio, Alerts, Events already wrap in `overflow-x-auto`. Verified at 375×812: hero, screener, terminal, compare, data-quality, landing all render cleanly.

## [1.4.4] — 2026-04-30 — "Console" (patch)

UX polish — skeleton loaders and friendlier empty states across data-heavy panels.

### Added
- **Shared feedback primitives** in `src/components/feedback-states.tsx` — `EmptyState`, `EmptyStateLink`, `TableSkeleton`, `StatGridSkeleton`, `ParagraphSkeleton`. Single source of truth for loading and zero-data UX.
- **Skeleton loaders** replacing plain `LOADING…` placeholders on Screener, Watchlist, Compare, Portfolio, Alerts, Events, Data Quality, AI Narrative and News & Catalysts. Shimmering rows preserve layout and reduce perceived wait, especially after the retry/timeout behaviour added in v1.4.2.
- **Friendlier empty states** with explanatory copy and a clear next action (e.g. "Open Screener", "Add your first holding"). Replaces terse one-liners like "No holdings yet." or "is empty.".

### Changed
- Screener, Watchlist, Compare, Events, Data Quality now render a layout-preserving skeleton table on first load instead of a single centered `LOADING UNIVERSE…` line.
- Portfolio "No holdings" empty state now shows an icon, descriptive copy, and a primary "Add your first holding" CTA.
- Events "Watchlist is empty" and "No events in this window" use shared empty-state styling for consistency.

## [1.4.3] — 2026-04-29 — "Console" (patch)

Accessibility pass and server-input audit.

### Added
- **Skip-to-main-content link** in `__root.tsx` — visible on keyboard focus,
  jumps past the nav. Lets screen-reader and keyboard-only users bypass the
  header on every route.
- **Global `:focus-visible`** ring in `src/styles.css` — every keyboard-focused
  element now shows a 2px ring in the amber accent color. Mouse users
  unaffected (focus-visible suppresses on click).

### Audited (no changes needed)
- All `createServerFn` mutations (`addAlert`, `toggleAlert`, `deleteAlert`,
  `addHolding`, `deleteHolding`, `searchTickers`, `analyzeTicker`,
  `aiParseQuery`, `aiTickerNarrative`, `aiNewsCatalysts`, `fetchEvents`,
  `fetchUniverse`, `markAlertEventsRead`, `evaluateMyAlerts`) already use
  Zod `.inputValidator()` with min/max/regex/uuid where appropriate. No
  unvalidated server entry points.
- Icon-only buttons (alert bell, currency toggle, ⌘K, "?", AI co-pilot)
  already carry `aria-label`, `aria-pressed`, or `role="dialog"` +
  `aria-modal`. `<main>` landmark present on every route.

## [1.4.2] — 2026-04-29 — "Console" (patch)

Hardened all outbound HTTP calls with retry + per-attempt timeout.

### Added
- `src/server/http.server.ts` exposes `fetchWithRetry`: shared helper with
  exponential backoff (250ms → 1s → 4s, 3 attempts), 12s default per-attempt
  timeout (30s for AI/news), and an explicit retry whitelist (network errors,
  408, 425, 429, 5xx). 4xx responses bypass retry — they're deterministic.

### Changed
- Finimpulse client (`finimpulse.server.ts`, `analyze.ts`) now uses
  `fetchWithRetry`. Transient 502/503/504s no longer surface as failed
  analysis; the universe + ticker analyze pipelines self-heal.
- Lovable AI gateway (`ai.server.ts`) wrapped with retry. AI narrative and
  ⌘K co-pilot survive transient gateway blips.
- Perplexity news (`news.functions.ts`) wrapped with retry. Recovers from
  upstream rate limits (429) and transient 5xx without user-visible errors.

### Notes
- Logs every retry with status/error so transient upstream issues are
  observable without surfacing to the user.

## [1.4.1] — 2026-04-29 — "Console" (patch)

App-wide error boundary so render errors never produce a blank screen.

### Added
- `<AppErrorBoundary>` wraps `<Outlet />` in `__root.tsx`. Catches any uncaught
  render error in any route or descendant component and shows a recoverable
  card (error message + Try again / Home) instead of the white screen of death.
- Errors are logged to console with component stack for ops visibility
  (Sentry-ready hook point in `componentDidCatch`).

### Notes
- Router-level `defaultErrorComponent` already covered loader throws; this
  closes the gap for render-time and hook-time errors (e.g. unexpected
  `useQuery` data shapes, missing fields, third-party widget failures).

## [1.4.0] — 2026-04-29 — "Console" (minor)

Automated regression test suite, gated on every build.

### Added
- **Vitest** unit suite covering `lib/format`, `lib/scores`, and `lib/backtest`
  (13 tests). Run with `bun run test:unit`.
- **Playwright** headless E2E suite covering:
  - Public route render + console-error budget for `/`, `/app`, `/compare`,
    `/watchlist`, `/events`, `/data-quality`, `/sources`, `/changelog`,
    `/settings`.
  - `/terminal/AAPL` deep-link mounts and surfaces ticker (validates v1.3.5).
  - `/portfolio` and `/alerts` auth-gating; `/auth` form presence.
  - `/app` screener row render + filter; `/watchlist` controls visible.
- **GitHub Actions workflow** (`.github/workflows/regression.yml`) runs unit
  then E2E on every push and pull request, blocking deploys on failure.
- `bun run test:regression` runs the full suite locally.
- `tests/README.md` documents structure, how to add tests, and the auth-mock
  follow-up.

### Notes
- Authenticated user CRUD flows (alerts/portfolio writes) are covered as
  gating checks; full-session E2E with a mocked Supabase token is the next
  iteration.

## [1.3.5] — 2026-04-29 — "Console" (patch)

Deep-link reliability for `/terminal/$symbol`.

### Fixed
- `/terminal/AAPL` and other ticker deep-links no longer return a hard 404 when
  the server-side analyze call fails or rate-limits. The route now skips the
  blocking loader and lets the client-side terminal handle the analysis,
  surfacing analyzer errors inline instead of breaking navigation.

### Changed
- Route metadata for `/terminal/$symbol` is derived from the URL ticker so
  share previews work even before analysis completes.

## [1.3.4] — 2026-04-29 — "Console" (minor)

First-class account menu for signed-in users.

### Added
- **Account menu** in the top nav for signed-in users — replaces the lone
  "Sign out" button with a dropdown that exposes:
  - **Switch user…** — signs the current user out and immediately opens the
    auth popup so a different user can sign in without losing the tab.
  - **Sign out** — ends the session and shows a confirmation toast.
- The trigger shows the user's email (md+) plus a one-letter avatar bubble
  for narrow widths, keeping the header single-row.

## [1.3.3] — 2026-04-29 — "Console" (patch)

Authenticated alert and portfolio server calls now attach the active session token explicitly, preventing raw 401 `Response` errors from surfacing as blank-screen runtime crashes.

### Fixed
- `AlertBell` now waits for a valid auth token before listing, evaluating, or marking alert events, and falls back to empty notification state on transient auth errors.
- `/alerts` and `/portfolio` now pass auth headers to their protected server functions and return safe empty states instead of letting unauthorised responses reach the router error boundary.

## [1.3.2] — 2026-04-29 — "Console" (patch)

Popup-blocker resilience for the new-tab auth flow.

### Added
- When the browser blocks the new auth tab, we now save the user's current
  URL to `sessionStorage` (`auth:return-to`) and navigate `/auth` in the same
  tab as a fallback. After successful sign-in, the auth page shows a
  dedicated success screen with two clear actions:
  - **← Back to where you were** — returns to the original screen with the
    session intact (no data loss).
  - **Continue to the terminal** — goes to `/app`.
- The popup tab itself now has an explicit **Cancel and close this tab**
  affordance so users can abort sign-in without affecting the opener tab's
  session.

### Changed
- `openAuthPopup()` now detects blocked popups (null / immediately closed
  window handle) and triggers the same-tab fallback automatically.
- Auth page no longer auto-redirects to `/app` in the same-tab fallback flow
  — the user explicitly chooses where to go next.

## [1.3.1] — 2026-04-29 — "Console" (patch)

Auth flow polish: signed-in users can now return to the landing page, and
the Sign-in / Sign-up flow opens in a separate tab that auto-closes on
success — keeping the original tab in place.

### Added
- **Home link** in the top nav for signed-in users — clear path back to the
  landing page (the brand logo also continues to link home).
- **Pop-up auth tab** — Sign-in / Sign-up CTAs now open `/auth?popup=1` in a
  new browser tab. After successful auth, the tab posts an
  `get-auth-success` message to the opener and closes itself; the original
  tab refreshes its session in place.
- New helper `src/lib/auth-popup.ts` to centralise the popup + opener
  message handshake (with graceful fallback if popups are blocked).

### Changed
- `/auth` accepts a `popup` search param. When set, the page hides the
  "← Back to home" link, shows a "Close this tab" affordance, and skips the
  in-tab redirect to `/app` after success.
- Removed the previous forced auto-redirect from `/` to `/app` for signed-in
  users — the landing page is now reachable at any time.
- Hardened Portfolio totals reads against `undefined` (`data?.totals?.cost`)
  to prevent the router-level crash that blocked navigation back to the
  landing page after sign-in.

## [1.3.0] — 2026-04-29 — "Console"

Top navigation restructured from a flat 10-link bar into 4 grouped dropdowns,
modelled on Koyfin / Bloomberg Terminal patterns. Same destinations, faster
to scan, no more wrapping at narrow widths.

### Changed
- **`SiteNav`** — replaced flat link row with 4 grouped menus:
  **Research** (Screener · Analysis · Compare),
  **Workspace** (Watchlists · Portfolio · Alerts),
  **Market** (Events),
  **System** (Data Quality · Sources · Settings).
- Active group highlights in primary color when any child route is active.
- Brand collapses to "GET" abbreviation on small screens; version tag hidden
  below `md` to keep the header single-row.

### Docs
- README, in-app glossary (new "Nav Groups" entry), and nav tooltips updated
  alongside changelog for v1.3.0 "Console".

## [1.2.0] — 2026-04-29 — "Compass"

Landing page restructured into a tight 7-section flow modelled on the patterns
used by leading equity-research platforms (Koyfin, Atom Finance, TIKR,
Simply Wall St): lead with proof and product, then narrative, then conversion.

### Changed
- **Landing flow** — new section order: Hero → Proof Strip (region coverage +
  top movers) → About → How it works → Capabilities → Personas → Final CTA.
- **Hero** — slimmed to headline, single CTA (Launch Screener), AI shortcut,
  and Network Status panel. Live data band and "How it works" extracted to
  dedicated sections so the hero stays scannable.
- **About story** — condensed to two paragraphs to fit higher up the flow
  without crowding the proof signals above it.

### Added
- **`LandingProofStrip`** — region coverage grid + top-movers tape, now its own
  section between Hero and About so visitors see live product data first.
- **`LandingHowItWorks`** — 3-step Screen → Analyze → Track explainer with
  preset shortcuts.
- **`LandingPersonas`** — "One terminal, three workflows" section for value
  investors, momentum traders and portfolio trackers, each linking to a
  matching screener preset.

### Docs
- README and changelog updated to reflect the new landing structure and
  v1.2.0 "Compass" release.

## [1.1.0] — 2026-04-29 — "Beacon"

Landing page is now separate from the workspace. The marketing site greets new
visitors at `/`; the screener and all in-app routes live under `/app`. Signed-in
users are auto-redirected from `/` into the workspace.

### Changed
- **Routes** — `/` is now a pure marketing landing (hero + about + CTA).
  The screener moved to `/app` (deep-link + URL-state preserved). All in-app
  links, the command palette, and "Back to screener" CTAs now target `/app`.
- **Auth-aware redirect** — authenticated users hitting `/` are sent straight
  to `/app` (with `replace`), so the landing is shown to logged-out visitors only.
- **SiteNav** — the "Screener" nav item points to `/app`. Logo still goes to `/`.
- **SEO** — distinct titles, descriptions, and canonical URLs for `/` (landing)
  and `/app` (screener).

### Docs
- README, in-app About section, and changelog updated to reflect the
  landing/app split.

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

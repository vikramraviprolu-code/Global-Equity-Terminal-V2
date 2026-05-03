# Changelog

All notable changes to **Global Equity Terminal** are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [SemVer](https://semver.org/).

## [1.11.1] — 2026-05-03 — "Inbox" (patch)

Hardens screener data resilience, fixes a runtime crash on the screener header, and tightens CI security gating.

### Fixed
- **Screener fundamentals fallback** (`src/server/finimpulse.server.ts`, `src/server/analyze.ts`) — when Yahoo's `quoteSummary` endpoint is blocked, Sector / Industry / Market Cap / P/E / P/B / dividend yield are now backfilled from FMP (when configured) and finally from the static universe metadata, so rows no longer show `—` for covered tickers.
- **Universe meta crash** (`src/routes/app.tsx`) — safe optional chaining on `data?.meta?.mockCount` / `liveCount` prevents a "Cannot read properties of undefined" crash when the universe query is loading or returns 401.

### Security / CI
- **Hardened CI security gate** (`.github/workflows/regression.yml`) — `bun pm audit --audit-level high` is no longer masked with `|| true`; added Trivy filesystem scan (CRITICAL/HIGH fails the build); Gitleaks and Trivy now upload SARIF results to GitHub Code Scanning; daily scheduled run (06:00 UTC) catches newly-disclosed advisories.

## [1.11.0] — 2026-05-03 — "Inbox" (minor)

Ships the full email surface end-to-end: every auth message and the morning brief now render with a single branded **Insight Investor** template, route through a durable retry queue, and are observable from a new admin dashboard. Also locks down database function privileges flagged by the security scan.

### Added
- **Branded auth emails** (`src/lib/email-templates/{signup,magic-link,recovery,invite,email-change,reauthentication}.tsx`, `src/lib/email-templates/brand.ts`) — signup confirmations, magic links, password recovery, invitations, email-change, and reauthentication all share a single white-bodied amber-accent template that matches the in-app terminal aesthetic.
- **Morning brief delivery** (`src/lib/email-templates/morning-brief.tsx`, `src/routes/api/public/hooks/run-scheduled-briefs.ts`) — scheduled morning briefs now render the same branded template and flow through the queue, with end-to-end verification from `pending` → `sent` in `email_send_log`.
- **Admin email monitoring** (`src/routes/admin.emails.tsx`, `src/server/admin-emails.functions.ts`) — new `/admin/emails` route surfaces failure rate, queue latency (p50/p95/max), retry counts, and DLQ depth. Includes deliverability alerts (≥3 failures in 24h, p95 latency >30s) and one-click test triggers for each auth template + morning brief.
- **Roles infrastructure** (`public.user_roles` table + `has_role()` helper) — admin gating for the email dashboard. Roles live in their own table per security guidance; first user seeded as admin.
- **Insight Investor sender identity** — all outbound mail (auth + transactional + scheduled) uses `Insight Investor <noreply@rankaisolutions.tech>` for a consistent inbox brand.

### Security
- **Locked down `SECURITY DEFINER` functions** — `REVOKE EXECUTE` on `enqueue_email`, `delete_email`, `read_email_batch`, `move_to_dlq`, and `bump_shared_watchlist_view` from `public` / `anon` / `authenticated`; restricted to `service_role`. `has_role` retains `authenticated` execute (required for RLS evaluation).

### Notes
- Email templates render server-side via `@react-email/components`; no runtime fetches.
- Queue dispatcher (`process-email-queue`) handles retries, rate-limit backoff, and DLQ routing automatically.

## [1.10.0] — 2026-05-02 — "Resilience" (minor)

Hardens the data layer so the terminal stays useful even when any single upstream provider is rate-limited, geo-blocked, or simply down. Adds a comprehensive in-app User Guide.

### Added
- **Multi-provider data fallbacks** (`src/server/yahoo.server.ts`, `src/server/fmp.server.ts`, `src/server/stooq.server.ts`, `src/server/indicators.server.ts`) — screener and terminal rows resolve through a chain: Finimpulse → Yahoo Finance → Financial Modeling Prep (free tier) → Stooq. All four are free, key-less, edge-runtime compatible. Indicators (RSI, ROC, MA cross, 5D %) are recomputed locally from whichever provider returned price history, so rows stay populated even when fundamentals are partial.
- **Provider badges** (`src/components/provider-badge.tsx`) — every screener row and sourced metric shows a small badge (FIM / YHO / FMP / STQ) indicating which free upstream supplied the data. Hover reveals the full provider name.
- **User Guide** (`src/routes/system.guide.tsx`) — 8-section in-app manual: Screener basics, Terminal page, Scoring vectors, Data fallback hierarchy, Watchlists & sharing, Alerts & theses, Keyboard shortcuts, FAQs. Linked from the **System** nav dropdown.
- **Data attribution disclaimer** — footer + screener disclaimer now explicitly attributes Finimpulse, Yahoo Finance, Financial Modeling Prep, and Stooq, and clarifies the "individual research only, no redistribution, may be 15+ minutes delayed" terms-of-service stance.

### Fixed
- **Terminal analysis hang** (`src/components/terminal/terminal-page.tsx`) — `/terminal/$symbol` would stay stuck on "Analyzing..." on direct navigation due to a `useRef` boolean swallowing the second StrictMode mount. The auto-run guard now keys off the `initialTicker` value, so re-mounts and symbol switches both re-trigger analysis correctly.
- **Landing page hydration mismatch** (`src/routes/index.tsx`) — universe stats flickered between "—" and the real ticker count on first load. Loader now `await`s the `prefetchQuery` so SSR and client hydrate with the same value.

### Notes
- All four data providers are free, but each has its own terms of service. The terminal displays data for individual research only; redistribution is not permitted. Quotes may be delayed 15+ minutes.
- No API keys required from users — all upstream calls are server-side, key-less, and rate-limited gracefully via the existing in-memory cache (`src/server/cache.server.ts`).

## [1.9.1] — 2026-05-01 — "Share" (patch)

Security hardening following a GDPR / EU AI Act / vulnerability audit. No user-facing changes.

### Security
- **Authenticated the scheduled-brief cron endpoint** (`src/routes/api/public/hooks/run-scheduled-briefs.ts`) — endpoint now requires `CRON_SECRET` via `x-cron-secret` or `Authorization: Bearer`. Unauthenticated calls return `401`. Closes the denial-of-wallet vector on a previously open POST endpoint that triggered AI-gateway spend.
- **Vault-stored cron secret** — pg_cron job rewritten to fetch `CRON_SECRET` from `vault.secrets` and inject it into the `http_post` headers, so the secret is never embedded in scheduler config.
- **Sanitized error responses** — the cron endpoint no longer echoes raw database error messages to clients (`{ error: "Internal error" }` instead of `error.message`); full details remain in server logs only.

## [1.9.0] — 2026-05-01 — "Share" (minor)

First outward-facing feature: turn any watchlist into a read-only public link. Each share is a fixed snapshot of tickers, rendered with live metrics on a public `/w/<token>` route — no sign-in required for viewers. Sets up a viral acquisition loop and gives the landing page a concrete public demo.

### Added
- **Shared watchlists** (`src/server/share.functions.ts`, `src/routes/w.$token.tsx`, `src/components/share-watchlist-dialog.tsx`) — `createShare` / `listShares` / `revokeShare` / `getSharedWatchlist`. Owners click **Share** on the watchlist page, optionally set an expiry (1/7/30/90 days or never), and copy a link. Recipients land on a branded read-only page with the full screener row data (price, mcap, P/E, RSI, 5D %, value/momentum/risk/confidence scores) and per-ticker drill-through to `/terminal/<symbol>`.
- **Schema** — new `shared_watchlists` table with `token` (22-char base64url, ~132 bits entropy), `symbols[]` snapshot, `view_count`, `expires_at`, `revoked_at`. RLS scopes owner CRUD to `auth.uid()` and grants public read for active rows (non-revoked, non-expired). Token is the access gate.
- **View counter** — `bump_shared_watchlist_view(token)` is `SECURITY DEFINER` with `EXECUTE` revoked from `anon` / `authenticated` / `public`. Only the SSR loader (service role) increments the counter, preventing client-side spam.
- **SEO** — public route emits per-share `og:title` / `og:description` / `twitter:card` based on the watchlist name and ticker count, plus a canonical URL. Every shared link is its own indexable page.

### Notes
- Shares are **snapshots, not live mirrors** — adding/removing tickers from a watchlist after sharing does not affect existing links. Create a new share to publish an updated list.
- Watchlists themselves remain client-side (localStorage); only the shared snapshot is persisted server-side. This keeps the no-account-required UX for read-only browsing.
- A revoked or expired share returns the `notFoundComponent` ("Share unavailable") rather than leaking the existence of the link.
## [1.8.1] — 2026-05-01 — "Delivery" (patch)

Security hardening for the email queue infrastructure shipped in 1.8.0. No user-facing changes.

### Security
- **Locked down email queue RPC functions** — pinned `search_path` on `enqueue_email`, `delete_email`, `read_email_batch`, and `move_to_dlq` to prevent search-path hijacking on these `SECURITY DEFINER` wrappers.
- **Revoked execute access** from `anon` and `authenticated` roles on the same four functions; only the `service_role` (used by trusted server code) can invoke the email queue. Closes the three Supabase linter findings (`function_search_path_mutable`, `anon_security_definer_function_executable`, `authenticated_security_definer_function_executable`).

## [1.8.0] — 2026-05-01 — "Delivery" (minor)

Take the v1.7 scheduled brief out of the app and into the user's inbox. Wires up Lovable Emails on a verified sender subdomain and reuses the existing per-user schedule + cron pipeline.

### Added
- **Email delivery for the Scheduled Morning Brief** — `brief_schedules` gains `email_enabled` and optional `email_to` columns. When enabled, the hourly cron at `src/routes/api/public/hooks/run-scheduled-briefs.ts` renders the brief through the React Email template `morning-brief` and POSTs it to the local `send-transactional-email` route, authenticating with the service-role key. Recipients default to the user's auth email; an override is supported.
- **Lovable Emails infrastructure** — verified sender subdomain `notify.rankaisolutions.tech` (DNS delegated to Lovable nameservers). Adds the standard email queue (`email_send_log`, `email_send_state`, `suppressed_emails`, `email_unsubscribe_tokens` + pgmq queues) and the queue dispatcher (`/lovable/email/queue/process`) running every 5s via pg_cron. Includes the public `/email/unsubscribe` page and `handle-email-suppression` hook.
- **Morning Brief email template** (`src/lib/email-templates/morning-brief.tsx`) — branded React Email layout with date, ticker list, AI summary, top 5 moves with 5D % and RSI, and the standard system-managed unsubscribe footer (auto-appended).
- **Schedule UI** (`src/components/schedule-brief.tsx`) — adds an "Also email it to me" toggle and an optional override address field next to the existing UTC hour picker.

### Changed
- **`send-transactional-email` route** — accepts the service-role key as an internal bearer for server-to-server calls in addition to the user JWT, so the cron can dispatch emails without forging a user session.
- **`upsertBriefSchedule` / `getBriefSchedule`** (`src/server/v17.functions.ts`) — schema now includes `emailEnabled` and `emailTo`.

### Notes
- Sends activate as soon as DNS verification for `notify.rankaisolutions.tech` completes (visible in **Cloud → Emails**). Until then briefs continue to land in-app only.
- New sender domain — deliverability improves over the first 2–4 weeks as inbox providers warm up. Add the sender to contacts to keep auth + brief mail in the inbox.
- Marketing-style emails are intentionally NOT supported — this stream is transactional only.

## [1.7.0] — 2026-04-30 — "Compounding" (minor)

Compounds the v1.6 USP — make the differentiator features work for the user even when they're not looking.

### Added
- **Alerts × Theses integration** (`src/server/v16.functions.ts → evaluateThesis`) — when a thesis evaluation flips from a non-broken state into `breaking` or `broken`, the system auto-inserts an `alert_event` (type `thesis_break`) so the bell badge lights up and the in-app toast surfaces it. Only fires on transition; re-evaluating a still-broken thesis does NOT spam. Re-uses the existing alert event pipeline — no new UI surface.
- **Scheduled Morning Brief** (`src/components/schedule-brief.tsx`, `src/server/v17.functions.ts`, `src/routes/api/public/hooks/run-scheduled-briefs.ts`) — opt-in daily AI-generated brief over the active watchlist. User picks a UTC hour; an hourly `pg_cron` job hits the public hook route, which finds due users (matching hour, not yet processed today) and generates briefs via the AI Gateway, persisting each to `brief_runs` for in-app reading. Idempotent per-user-per-day via `last_run_at`.
- **Schema** — new `brief_schedules` table (RLS-scoped to `auth.uid()`, one row per user, `hour_utc` 0–23). New enum value `thesis_break` on `alert_type`.
- **Extensions** — `pg_cron` and `pg_net` enabled; `run-scheduled-briefs-hourly` cron job scheduled at minute 5 of every hour.

### Notes
- In-app delivery only for v1.7. Email delivery deferred to a future minor.
- Thesis-break alerts can't be created manually — they're auto-generated and surface alongside regular alerts in the bell.

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

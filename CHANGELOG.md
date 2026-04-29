# Changelog

All notable changes to **Global Equity Terminal** are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [SemVer](https://semver.org/).

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

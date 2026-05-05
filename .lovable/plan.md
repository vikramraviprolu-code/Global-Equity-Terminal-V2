## Goal

Produce a single, structured Markdown "master prompt" that fully describes the **Global Equity Terminal v1.12.0** build — comprehensive enough that another AI agent (or a new Lovable project) could recreate the application from scratch. Saved as a downloadable artifact, not added to the repo.

## Deliverable

- **File**: `/mnt/documents/Global_Equity_Terminal_Master_Prompt_v1.12.0.md`
- **Format**: Markdown, ~1,500–2,500 lines, organized for an LLM to consume top-to-bottom.
- **Source of truth**: `src/lib/version.ts` (v1.12.0 "Tasks"), `README.md`, `CHANGELOG.md` (all 1.0 → 1.12 entries), `src/lib/glossary.ts`, route files in `src/routes/`, server functions in `src/server/`, and the latest PRD (`PRD_v4.3.docx`).

## Document Structure

1. **Preamble & Role** — instruct the consuming agent to act as a senior full-stack engineer building on TanStack Start v1 + Lovable Cloud.
2. **Product Vision** — one-paragraph elevator pitch + target personas (retail / prosumer global equity researchers).
3. **Tech Stack & Constraints** — TanStack Start v1, React 19, Vite 7, Tailwind v4, Lovable Cloud (Postgres + Auth + RLS), Lovable AI Gateway (Gemini/GPT), Cloudflare Workers SSR, no client-side secrets.
4. **Information Architecture** — full route map (Research / Workspace / Market / System nav groups) with one-liner per route.
5. **Feature Specifications** — one subsection per feature, each containing: purpose, UX, data dependencies, server functions, RLS posture. Covers: Screener & Heatmap, Terminal page, Ask the Terminal, Morning Brief, Scheduled Brief + Email Delivery, Thesis Tracker, Thesis-break Alerts, Compare, Watchlists, Shared Watchlists, Portfolio, Alerts, **Tasks (kanban)**, Multi-provider Fallbacks, Provider Badges, User Guide, Glossary, Command Palette, Keyboard Shortcuts, PDF Export, Currency Toggle, Diff Mode.
6. **Data Layer** — provider chain (Finimpulse → Yahoo → FMP → Stooq), caching, indicators recomputed locally, ToS notes.
7. **Database Schema** — every table with columns, enums, RLS policies, triggers (profiles, watchlists, portfolio_holdings, theses, alert_rules, alert_events, brief_history, brief_schedules, shared_watchlists, tasks + task_status enum, user_roles + app_role enum, email_send_log + queue tables).
8. **Server Functions** — list each `*.functions.ts` module with its exported RPCs and Zod input shapes.
9. **AI Layer** — Lovable AI Gateway usage patterns, supported models, prompt templates for narrative / catalysts / brief / ask-terminal / thesis evaluation.
10. **Auth & Security** — email + Google OAuth, no anon signups, RLS everywhere, `user_roles` table for admin gating, `has_role()` security-definer helper, vault-stored cron secret, signature-verified public webhooks.
11. **Email System** — branded "Insight Investor" templates, queue + DLQ, admin dashboard, unsubscribe page, sender domain `notify.rankaisolutions.tech`.
12. **Design System** — semantic tokens in `src/styles.css`, dark terminal aesthetic, amber accent, no hardcoded colors in components.
13. **Conventions & Guardrails** — version bump checklist, pre-publish script, PRD versioning rule, no edits to `client.ts` / `types.ts` / `routeTree.gen.ts`.
14. **Acceptance Criteria** — checklist per feature so the consuming agent can self-verify.
15. **Build Order** — recommended sequence (auth → screener → terminal → workspace features → AI layer → email → tasks).
16. **Appendix** — keyboard shortcuts table, glossary snapshot, full version history (1.0 → 1.12 condensed from CHANGELOG).

## Implementation Steps (in build mode)

1. Read full `CHANGELOG.md` (459 lines), `src/lib/glossary.ts`, `src/components/site-nav.tsx`, and a representative server function to capture exact patterns.
2. Generate the markdown file directly via `code--write` to `/mnt/documents/...`.
3. Emit a `<lov-artifact>` tag so you can download it.

## Out of Scope

- No code changes to the app.
- No PRD/.docx regeneration (markdown only, as requested).
- No version bump (this is a doc export, not a release).

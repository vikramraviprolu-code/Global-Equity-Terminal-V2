# GitHub Cost Control Policy

Applies to every human, CLI, and AI agent (Devin, Codex, Claude, Copilot, Gemini,
Hermes, Lovable, and any sub-agent they spawn) working in a repository owned by
`vikramraviprolu-code`.

## Hard rules

1. **Additional GitHub Actions spending stays at $0.** The Actions budget is
   capped at $0 beyond the included allowance. Never enable paid overages,
   upgrade plans, or provision billable runners, Codespaces, storage, AI usage,
   or marketplace services.
2. **Never raise the budget cap** or remove a hard stop without explicit owner
   approval that names the service, the maximum amount, and the duration.
3. **If the cap blocks CI, stop and report.** Do not retry, re-run, or re-push
   to get a check to run. Continue safe local work, and report which checks or
   deployments are blocked. Never claim remote success that did not happen.
4. **No `schedule:` / cron workflows** without an approved purpose, frequency,
   owner, and cost limit. Do not add or re-enable one. Prefer relevant-change
   (`push` / `pull_request` with path filters) or manual (`workflow_dispatch`)
   triggers.

## Working discipline

- **Verify locally before pushing.** Run the repo's lint, type-check, build,
  and test commands on your machine. Remote CI is confirmation, not a
  trial-and-error loop.
- **Batch commits.** Work locally and push one coherent batch per reviewable
  milestone instead of a stream of small pushes that each start a CI run.
- **Investigate failures before retrying.** Read the first meaningful failure.
  Re-run only the affected failed jobs, and only after a relevant fix or clear
  evidence the failure was transient. Stop on repeated unchanged failures or
  timeouts.
- **Avoid duplicate push + PR triggers.** A branch push and its pull request
  should not each run the full suite for the same commit. Keep required `main`
  and release validation.
- **Use `concurrency:` with `cancel-in-progress: true`** on non-deployment
  workflows so a superseded run on the same branch is cancelled. Never cancel
  deployments, migrations, or another person's runs.
- **Scope heavy jobs by path.** Component, Docker, database, E2E, and matrix
  jobs run only when the files they cover change (`paths:` filters). Heavy
  matrices and cross-browser or release jobs need a justified trigger.
- Keep finite `timeout-minutes`, existing caches, and proportionate artifact
  retention.

## Preserve

- **Security scans and gates** (secret scanning, dependency advisories,
  provider-key leak checks, auth checks) stay as they are. Never bypass
  required checks, use skip-CI markers, suppress failures, or remove a
  security gate to save money.
- **`release.yml` and other tag-triggered release workflows** keep running on
  tags. Do not convert them to manual-only or remove them.
- Never make private code public or move untrusted jobs onto production hosts
  to evade charges. Self-hosted runners require separate approval.

## Delegation

Pass this policy, verbatim or by reference to this file, to every sub-agent,
child session, or delegated task you spawn. At handoff, distinguish clearly
between local checks, remote CI, merge, and deployment status. Owner-approved
exceptions must state their scope and spending limit.

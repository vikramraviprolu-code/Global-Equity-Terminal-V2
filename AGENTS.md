# Agent instructions

Rules for any AI agent (Lovable, Devin, Codex, Copilot, …) working in this repo.
`main` is two-way synced with Lovable, so a change made in Lovable lands here and
vice versa — these rules exist so the CI pipeline stays green in both directions.

## Package manager

npm only. `package-lock.json` is the single lockfile of record and is what CI
installs (`npm ci`) *and* what the security scanner reads, so the scanned tree is
the installed tree.

- Do **not** add `bun.lockb`, `bun.lock`, `bunfig.toml`, `yarn.lock` or
  `pnpm-lock.yaml`. A second lockfile makes the scan report a dependency tree
  that nothing actually installs.
- Change dependencies via `npm install` / `npm update` and commit the resulting
  `package-lock.json`.

## Dependencies and security advisories

- `overrides` in `package.json` pin patched versions of vulnerable transitive
  dependencies. Keep them as **caret ranges** (`"^8.5.18"`), never exact pins —
  an exact pin becomes the vulnerable version as soon as the next CVE lands.
- Do not override `brace-expansion` to 5.x: it breaks `eslint`'s bundled
  `minimatch@3` (`TypeError: expand is not a function`). npm already resolves a
  patched 1.1.x for that path.
- Dependabot opens grouped weekly PRs for npm and GitHub Actions. Prefer merging
  those over hand-editing the lockfile.

## CI (`.github/workflows/regression.yml`)

Only these things may fail the pipeline, because only these are things a commit
can actually control:

- `Security checks` — `scripts/security-check.mjs` (every `src/server/*.functions.ts`
  export must use `requireSupabaseAuth`/`optionalSupabaseAuth` or be explicitly
  allow-listed as public) and gitleaks.
- `Docs consistency` — `scripts/pre-publish-check.mjs`: version bumps must update
  `src/lib/version.ts`, the README header, `CHANGELOG.md` and the glossary together.
- `Unit (Vitest)` and `E2E (Playwright)`.

`Dependency advisories` is deliberately **not** a hard gate for HIGH findings: it
publishes SARIF to Code Scanning, writes a job summary and keeps one rolling
issue, and fails only on a CRITICAL advisory that has a published fix. Newly
disclosed upstream CVEs must not be able to red the build or skip the test jobs.
Do not reintroduce a blanket `--exit-code 1 --severity CRITICAL,HIGH` gate, and
do not make the test jobs `needs:` the advisory job.

Suppress a finding only in `.trivyignore`, and always with an expiry:

```
CVE-2026-12345 exp:2026-12-31
```

## Before pushing

```bash
npm ci
npm run build
npm run test:unit
CI=1 npm run test:e2e
node scripts/security-check.mjs
```

`npm run lint` currently reports thousands of pre-existing prettier and
`no-explicit-any` errors. Don't bulk-reformat the repo to clear them — fix lint
only in files you are already changing.

## GitHub cost control

Additional GitHub Actions spend for this repo is capped at $0. Follow
[`GITHUB_COST_POLICY.md`](./GITHUB_COST_POLICY.md): never raise the cap without
explicit owner approval, run the "Before pushing" commands above locally and batch
commits instead of using CI as a retry loop, and if the cap blocks CI stop and report
rather than re-running or re-pushing. Do not add `schedule:`/cron workflows.

This does **not** weaken `regression.yml`: the `Security checks`, `Docs consistency`,
`Unit (Vitest)` and `E2E (Playwright)` gates stay exactly as described in the CI
section, and `Dependency advisories` keeps its current behaviour. Pass this policy to
any sub-agent you delegate to.

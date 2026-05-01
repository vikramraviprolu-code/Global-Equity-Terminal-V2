#!/usr/bin/env node
/**
 * Pre-publish documentation consistency checklist.
 *
 * Verifies that every documentation surface is in sync with the release version
 * declared in `src/lib/version.ts`. Run this BEFORE every publish.
 *
 *   node scripts/pre-publish-check.mjs
 *
 * Checks:
 *   1. version.ts          — APP_VERSION is the source of truth
 *   2. README.md           — header includes "v{VERSION}"
 *   3. CHANGELOG.md        — has a "## [{VERSION}]" entry, dated, with codename
 *   4. PRD .docx           — newest /mnt/documents/Global_Equity_Terminal_PRD_v*.docx
 *                            cover/version markers reference current APP_VERSION
 *                            and PRD filename version is monotonically newest
 *   5. Glossary            — src/lib/glossary.ts parses and is non-empty
 *   6. Tooltips / help     — no stale version strings (e.g. "v1.7.0") in src/
 *
 * Exit code 0 = ready to publish. Non-zero = fix issues first.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = process.cwd()
const DOCS_DIR = '/mnt/documents'

const results = []
const pass = (name, detail = '') => results.push({ ok: true, name, detail })
const fail = (name, detail) => results.push({ ok: false, name, detail })
const warn = (name, detail) => results.push({ ok: null, name, detail })

// ── 1. version.ts ────────────────────────────────────────────────────────────
const versionFile = join(ROOT, 'src/lib/version.ts')
const versionSrc = readFileSync(versionFile, 'utf8')
const VERSION = versionSrc.match(/APP_VERSION\s*=\s*"([^"]+)"/)?.[1]
const RELEASE_DATE = versionSrc.match(/APP_RELEASE_DATE\s*=\s*"([^"]+)"/)?.[1]
const CODENAME = versionSrc.match(/APP_CODENAME\s*=\s*"([^"]+)"/)?.[1]

if (!VERSION || !RELEASE_DATE || !CODENAME) {
  fail('version.ts', 'missing APP_VERSION / APP_RELEASE_DATE / APP_CODENAME')
  printAndExit()
}
pass('version.ts', `v${VERSION} "${CODENAME}" (${RELEASE_DATE})`)

// ── 2. README.md ─────────────────────────────────────────────────────────────
const readme = readFileSync(join(ROOT, 'README.md'), 'utf8')
const readmeHeader = readme.split('\n').slice(0, 5).join('\n')
if (readmeHeader.includes(`v${VERSION}`)) {
  if (readmeHeader.includes(`"${CODENAME}"`)) {
    pass('README.md header', `mentions v${VERSION} "${CODENAME}"`)
  } else {
    fail('README.md header', `has v${VERSION} but missing codename "${CODENAME}"`)
  }
} else {
  fail('README.md header', `does not mention v${VERSION} in first 5 lines`)
}

// ── 3. CHANGELOG.md ──────────────────────────────────────────────────────────
const changelog = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8')
const entryRe = new RegExp(`^## \\[${escapeRe(VERSION)}\\][^\\n]*$`, 'm')
const entryLine = changelog.match(entryRe)?.[0]
if (!entryLine) {
  fail('CHANGELOG.md', `no "## [${VERSION}]" entry`)
} else {
  const okDate = entryLine.includes(RELEASE_DATE)
  const okName = entryLine.includes(`"${CODENAME}"`)
  if (okDate && okName) pass('CHANGELOG.md', entryLine.trim())
  else
    fail(
      'CHANGELOG.md',
      `entry "${entryLine.trim()}" missing ${[
        !okDate && `date ${RELEASE_DATE}`,
        !okName && `codename "${CODENAME}"`,
      ]
        .filter(Boolean)
        .join(' and ')}`,
    )
}

// ── 4. PRD .docx ─────────────────────────────────────────────────────────────
if (!existsSync(DOCS_DIR)) {
  warn('PRD', `${DOCS_DIR} not mounted — skipping PRD check`)
} else {
  const prds = readdirSync(DOCS_DIR)
    .filter((f) => /^Global_Equity_Terminal_PRD_v[\d.]+\.docx$/.test(f))
    .map((f) => ({
      file: f,
      ver: f.match(/v([\d.]+)\.docx$/)[1],
      mtime: statSync(join(DOCS_DIR, f)).mtimeMs,
    }))
    .sort(
      (a, b) =>
        cmpSemver(b.ver, a.ver) || b.mtime - a.mtime, // newest version first
    )

  if (!prds.length) {
    fail('PRD', `no Global_Equity_Terminal_PRD_v*.docx found in ${DOCS_DIR}`)
  } else {
    const latest = prds[0]
    pass('PRD newest file', `${latest.file}`)

    // Extract text from the docx (cover page + first ~2 pages worth of XML)
    let text = ''
    try {
      const xml = execSync(`unzip -p "${join(DOCS_DIR, latest.file)}" word/document.xml`, {
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
      })
      text = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    } catch (e) {
      fail('PRD content', `could not unzip word/document.xml: ${e.message}`)
    }

    if (text) {
      const checks = [
        {
          label: `cover references v${VERSION}`,
          re: new RegExp(`v${escapeRe(VERSION)}\\b|Version:?\\s*${escapeRe(VERSION)}`, 'i'),
        },
        {
          label: `cover references codename "${CODENAME}"`,
          re: new RegExp(`"?${escapeRe(CODENAME)}"?`),
        },
      ]
      for (const c of checks) {
        if (c.re.test(text)) pass(`PRD — ${c.label}`)
        else fail(`PRD — ${c.label}`, `not found in ${latest.file}`)
      }

      // Stale prior versions on the cover (look at first 1500 chars only)
      const cover = text.slice(0, 1500)
      const staleVersions = [...cover.matchAll(/\bv?(\d+\.\d+(?:\.\d+)?)\b/g)]
        .map((m) => m[1])
        .filter((v) => v !== VERSION && cmpSemver(v, '1.0.0') >= 0)
      if (staleVersions.length) {
        warn(
          'PRD — cover stale versions',
          `found ${[...new Set(staleVersions)].join(', ')} alongside v${VERSION}`,
        )
      } else {
        pass('PRD — cover has no stale versions')
      }
    }
  }
}

// ── 5. Glossary ──────────────────────────────────────────────────────────────
const glossary = readFileSync(join(ROOT, 'src/lib/glossary.ts'), 'utf8')
const entryCount = (glossary.match(/term:\s*"/g) || []).length
if (entryCount > 10) pass('Glossary', `${entryCount} entries`)
else fail('Glossary', `only ${entryCount} entries — looks broken`)

// ── 6. Stale version strings in src/ ─────────────────────────────────────────
try {
  const out = execSync(
    `rg -n --no-heading "v[0-9]+\\.[0-9]+\\.[0-9]+" src/ -g '!src/lib/version.ts' -g '!src/routeTree.gen.ts' || true`,
    { encoding: 'utf8' },
  )
  const lines = out
    .split('\n')
    .filter(Boolean)
    .filter((l) => {
      const m = l.match(/v(\d+\.\d+\.\d+)/)
      return m && m[1] !== VERSION
    })
    // Allow CHANGELOG-style historical references in changelog.tsx
    .filter((l) => !l.startsWith('src/routes/changelog.tsx'))

  if (lines.length === 0) {
    pass('No stale version strings in src/')
  } else {
    warn('Stale version strings in src/', `\n  ${lines.slice(0, 10).join('\n  ')}`)
  }
} catch (e) {
  warn('Stale version scan', e.message)
}

printAndExit()

// ── helpers ──────────────────────────────────────────────────────────────────
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
function cmpSemver(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d) return d
  }
  return 0
}
function printAndExit() {
  const ICON = { true: '✓', false: '✗', null: '⚠' }
  const COLOR = { true: '\x1b[32m', false: '\x1b[31m', null: '\x1b[33m' }
  const RESET = '\x1b[0m'
  console.log(`\nPre-publish checklist — v${VERSION || '?'} "${CODENAME || '?'}"\n`)
  for (const r of results) {
    const c = COLOR[String(r.ok)]
    const i = ICON[String(r.ok)]
    console.log(`  ${c}${i}${RESET} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
  }
  const failed = results.filter((r) => r.ok === false).length
  const warned = results.filter((r) => r.ok === null).length
  console.log(
    `\n${failed === 0 ? '\x1b[32mREADY TO PUBLISH' : '\x1b[31mNOT READY'}${RESET} — ${
      results.filter((r) => r.ok === true).length
    } passed, ${warned} warnings, ${failed} failed.\n`,
  )
  process.exit(failed === 0 ? 0 : 1)
}

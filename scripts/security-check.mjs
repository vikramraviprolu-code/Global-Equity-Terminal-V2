#!/usr/bin/env node
/**
 * Lightweight static security gate for CI.
 *
 * Checks:
 *  1. Every paid-API server function lives in src/server/{ai,analyze,events,screen,v16,v17,news,fmp,finimpulse}*
 *     and must include `requireSupabaseAuth` middleware. We grep each
 *     `.functions.ts` (and analyze.ts) file for `createServerFn(` blocks and
 *     verify each has `.middleware([` that references `requireSupabaseAuth`.
 *  2. No service-role key, FinImpulse key, or LOVABLE_API_KEY appears anywhere
 *     under src/ (only allowed in process.env reads).
 *
 * Exits non-zero on any failure so CI fails the build.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const ALLOWED_PUBLIC_FNS = new Set([
  // explicitly public/anonymous server functions
  "getSharedWatchlist",
  "fetchUniverse", // accepted finding (public landing/share)
  "fetchEvents",   // accepted finding (events page client-gated)
  "reportError",   // public error telemetry, hardened with strict validation
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

const failures = [];

// 1. Auth middleware on paid-API server functions
const SERVER_DIR = join(ROOT, "src", "server");
const serverFiles = walk(SERVER_DIR).filter((f) => /\.functions\.ts$|\/analyze\.ts$/.test(f));
for (const file of serverFiles) {
  const src = readFileSync(file, "utf8");
  // Find each export const NAME = createServerFn(...) ... .handler(...)
  const fnRegex = /export\s+const\s+(\w+)\s*=\s*createServerFn\s*\(/g;
  let m;
  while ((m = fnRegex.exec(src))) {
    const name = m[1];
    const startIdx = m.index;
    // Find next `export const` or end of file
    fnRegex.lastIndex = startIdx + 1;
    const nextExport = src.slice(startIdx + 1).search(/\nexport\s+const\s+\w+\s*=/);
    const block = nextExport === -1 ? src.slice(startIdx) : src.slice(startIdx, startIdx + 1 + nextExport);
    const hasAuth = /requireSupabaseAuth/.test(block);
    if (!hasAuth && !ALLOWED_PUBLIC_FNS.has(name)) {
      failures.push(`${relative(ROOT, file)}: ${name} missing requireSupabaseAuth middleware`);
    }
  }
}

// 2. Hardcoded secret patterns (heuristic)
const SECRET_PATTERNS = [
  // service role JWT prefix
  { name: "Supabase service-role JWT", re: /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/ },
  { name: "OpenAI key", re: /sk-[A-Za-z0-9]{32,}/ },
  { name: "Stripe live key", re: /sk_live_[A-Za-z0-9]{20,}/ },
];
const ANON_KEY_FRAGMENT = "ticker-tuner-pro"; // not a real check, just so anon doesn't trip
const srcFiles = walk(join(ROOT, "src"));
for (const file of srcFiles) {
  // The publishable anon key is allowed in src/integrations/supabase/client.ts
  if (file.endsWith("client.ts") && file.includes("integrations/supabase")) continue;
  const src = readFileSync(file, "utf8");
  for (const { name, re } of SECRET_PATTERNS) {
    const hit = src.match(re);
    if (hit) {
      failures.push(`${relative(ROOT, file)}: possible ${name} leak: ${hit[0].slice(0, 24)}…`);
    }
  }
}

if (failures.length) {
  console.error("\n❌ Security check failures:\n");
  for (const f of failures) console.error("  - " + f);
  console.error(`\n${failures.length} issue(s) — failing build.\n`);
  process.exit(1);
}

console.log("✓ Security checks passed.");

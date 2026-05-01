/**
 * Parses CHANGELOG.md (Keep a Changelog format) into structured entries.
 *
 * Single source of truth: CHANGELOG.md. The /changelog route renders from
 * the parsed result, so we never have to update both places.
 *
 * Expected entry header format:
 *   ## [1.8.1] — 2026-05-01 — "Delivery" (patch)
 *
 * Sections start with `### Title`. List items start with `- `.
 * Plain paragraphs between the header and the first section become the summary.
 */
import changelogRaw from "../../CHANGELOG.md?raw";

export type ChangelogSection = { title: string; items: string[] };
export type ChangelogEntry = {
  version: string;
  date: string;
  codename?: string;
  kind?: string; // "patch" | "minor" | "major"
  summary?: string;
  sections: ChangelogSection[];
};

// Match: ## [1.8.1] — 2026-05-01 — "Delivery" (patch)
// Em-dash, en-dash, or hyphen separators all accepted.
// Match header in two steps for reliability across dash variants:
//   1) "## [VERSION] — REST"
//   2) parse REST as: DATE [— "CODENAME"] [(KIND)]
const HEADER_RE = /^##\s*\[([\d.x]+)\]\s*[—–-]\s*(\S.*)$/;
const HEADER_REST_RE =
  /^(\S+)(?:\s*[—–-]\s*"([^"]+)")?(?:\s*\(([^)]+)\))?\s*$/;

const SECTION_RE = /^###\s+(.+?)\s*$/;
const LIST_ITEM_RE = /^[-*]\s+(.+)$/;

function parseChangelog(md: string): ChangelogEntry[] {
  const lines = md.split(/\r?\n/);
  const entries: ChangelogEntry[] = [];
  let current: ChangelogEntry | null = null;
  let currentSection: ChangelogSection | null = null;
  let summaryParts: string[] = [];
  let inSummaryMode = false;

  const flushSummary = () => {
    if (current && summaryParts.length) {
      current.summary = summaryParts.join(" ").trim();
    }
    summaryParts = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    const headerMatch = line.match(HEADER_RE);
    if (headerMatch) {
      if (current) {
        flushSummary();
        entries.push(current);
      }
      const restMatch = headerMatch[2].match(HEADER_REST_RE);
      current = {
        version: headerMatch[1],
        date: restMatch?.[1].trim() ?? headerMatch[2].trim(),
        codename: restMatch?.[2]?.trim(),
        kind: restMatch?.[3]?.trim(),
        sections: [],
      };
      currentSection = null;
      summaryParts = [];
      inSummaryMode = true;
      continue;
    }

    if (!current) continue; // skip preamble

    const sectionMatch = line.match(SECTION_RE);
    if (sectionMatch) {
      flushSummary();
      inSummaryMode = false;
      currentSection = { title: sectionMatch[1].trim(), items: [] };
      current.sections.push(currentSection);
      continue;
    }

    const itemMatch = line.match(LIST_ITEM_RE);
    if (itemMatch && currentSection) {
      currentSection.items.push(itemMatch[1].trim());
      continue;
    }

    // Continuation of a previous bullet (indented line)
    if (currentSection && /^\s+\S/.test(raw) && currentSection.items.length) {
      currentSection.items[currentSection.items.length - 1] += " " + line.trim();
      continue;
    }

    // Plain paragraph between header and first section → summary
    if (inSummaryMode && line.trim()) {
      summaryParts.push(line.trim());
    }
  }

  if (current) {
    flushSummary();
    entries.push(current);
  }

  return entries;
}

export const CHANGELOG_ENTRIES: ChangelogEntry[] = parseChangelog(changelogRaw);

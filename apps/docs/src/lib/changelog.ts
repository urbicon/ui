/**
 * The changelog page's reading of `CHANGELOG.md`, which git-cliff writes
 * (`cliff.toml`): a `## [version](compare-url) - date` heading per release,
 * `### Group` headings, and `- **scope**: message` items whose message carries
 * inline code spans and the `[#N](url)` links the postprocessor writes for
 * issue references. The page renders nothing it does not parse here — a
 * `> **BREAKING:** …` note is not an item and is skipped.
 */

export interface ChangelogItem {
  scope?: string;
  message: string;
}

export interface ChangelogGroup {
  name: string;
  items: ChangelogItem[];
}

export interface ChangelogEntry {
  version: string;
  date: string;
  groups: ChangelogGroup[];
}

export type InlineToken =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string };

const INLINE = /(`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

/**
 * Split an item message into text, `code` spans and `[label](href)` links, in
 * source order. Anything the two forms do not cover stays text, so an
 * unbalanced backtick or bracket renders as written rather than vanishing.
 */
export function tokenizeInline(message: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let last = 0;
  for (const match of message.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > last) tokens.push({ kind: 'text', text: message.slice(last, index) });
    const raw = match[0];
    if (raw.startsWith('`')) {
      tokens.push({ kind: 'code', text: raw.slice(1, -1) });
    } else {
      const close = raw.indexOf('](');
      tokens.push({ kind: 'link', text: raw.slice(1, close), href: raw.slice(close + 2, -1) });
    }
    last = index + raw.length;
  }
  if (last < message.length) tokens.push({ kind: 'text', text: message.slice(last) });
  return tokens;
}

export function parseChangelog(md: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  const lines = md.split('\n');
  let currentEntry: ChangelogEntry | null = null;
  let currentGroup: ChangelogGroup | null = null;

  for (const line of lines) {
    const versionMatch = line.match(/^## \[(.+?)\](?:\([^)]*\))?\s*-?\s*([\d-]*)/);
    if (versionMatch) {
      currentEntry = {
        version: versionMatch[1],
        date: versionMatch[2] || '',
        groups: []
      };
      entries.push(currentEntry);
      currentGroup = null;
      continue;
    }

    const groupMatch = line.match(/^### (.+)/);
    if (groupMatch && currentEntry) {
      currentGroup = { name: groupMatch[1], items: [] };
      currentEntry.groups.push(currentGroup);
      continue;
    }

    const itemMatch = line.match(/^- (?:\*\*(.+?)\*\*: )?(.+)/);
    if (itemMatch && currentGroup) {
      currentGroup.items.push({
        scope: itemMatch[1] || undefined,
        message: itemMatch[2]
      });
    }
  }

  return entries;
}

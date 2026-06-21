/**
 * Parse and edit a `design.manifest.md`. Deliberately dependency-free (no YAML
 * lib — consistent with the zero-dep ethos): frontmatter is flat `key: value`,
 * and edits are surgical (replace one marked block / insert one ADR) so any
 * hand-written prose, ordering, and formatting survive a round-trip.
 */

import type { DesignDecision, DesignManifest, PatternUsage } from './types.js';

const USAGES_HEADING = '## Pattern Usages';
const DECISIONS_HEADING = '## Design Decisions';
/**
 * Stable detection prefix for the auto-generated usages block. The human-readable
 * tail of the marker (below) may change without breaking `upsertUsagesSection` or
 * stranding manifests written by an older version — detection keys off this prefix,
 * not the full string.
 */
const USAGES_MARKER_PREFIX = '<!-- AUTO-GENERATED pattern usages';
const USAGES_START = `${USAGES_MARKER_PREFIX} — regenerated from data-design-pattern markers; do not edit by hand -->`;
const USAGES_END = '<!-- END pattern usages -->';

/** Split leading `--- … ---` frontmatter from the body. Returns flat key→value pairs. */
export function parseFrontmatter(content: string): { data: Record<string, string>; body: string } {
  const data: Record<string, string> = {};
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { data, body: content };

  for (const line of match[1]!.split(/\r?\n/)) {
    const kv = line.match(/^([a-zA-Z][\w-]*)\s*:\s*(.*)$/);
    if (kv) {
      const value = kv[2]!.trim().replace(/^["']|["']$/g, '');
      if (value) data[kv[1]!] = value;
    }
  }
  return { data, body: content.slice(match[0].length) };
}

/** Extract the `## …` section body for a given heading (until the next `## ` or EOF). */
function extractSection(body: string, heading: string): string | null {
  const lines = body.split('\n');
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^## /.test(lines[i]!)) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join('\n');
}

function parseUsages(body: string): PatternUsage[] {
  const section = extractSection(body, USAGES_HEADING);
  if (!section) return [];
  const usages: PatternUsage[] = [];
  for (const m of section.matchAll(/^- `([a-z0-9-]+)`\s+—\s+(.+)$/gm)) {
    usages.push({ pattern: m[1]!, file: m[2]!.trim() });
  }
  return usages;
}

function parseDecisions(body: string): DesignDecision[] {
  const section = extractSection(body, DECISIONS_HEADING);
  if (!section) return [];
  const decisions: DesignDecision[] = [];
  // Each decision is a `### <date> — <title>` block.
  const blocks = section.split(/^### /m).slice(1);
  for (const block of blocks) {
    const headerLine = block.split('\n', 1)[0]!;
    const header = headerLine.match(/^(\d{4}-\d{2}-\d{2})\s+—\s+(.+)$/);
    if (!header) continue;
    const field = (name: string): string | undefined =>
      block.match(new RegExp(`\\*\\*${name}:\\*\\*\\s*(.+)`))?.[1]?.trim();
    decisions.push({
      date: header[1]!,
      title: header[2]!.trim(),
      status: field('Status') ?? 'accepted',
      decision: field('Decision') ?? '',
      rationale: field('Rationale')
    });
  }
  return decisions;
}

/** Parse a manifest file into structured form. */
export function parseManifest(content: string, exists = true): DesignManifest {
  const { data, body } = parseFrontmatter(content);
  return {
    frontmatter: data,
    usages: parseUsages(body),
    decisions: parseDecisions(body),
    exists
  };
}

/** The empty-manifest sentinel returned when no file exists. */
export function emptyManifest(): DesignManifest {
  return { frontmatter: {}, usages: [], decisions: [], exists: false };
}

function renderUsagesBlock(usages: PatternUsage[]): string {
  const lines = [USAGES_START];
  if (usages.length === 0) {
    lines.push('', '_No `data-design-pattern` markers found yet._', '');
  } else {
    lines.push('');
    const sorted = [...usages].sort(
      (a, b) => a.pattern.localeCompare(b.pattern) || a.file.localeCompare(b.file)
    );
    for (const u of sorted) lines.push(`- \`${u.pattern}\` — ${u.file}`);
    lines.push('');
  }
  lines.push(USAGES_END);
  return lines.join('\n');
}

/** Replace the auto-generated usages block (or insert the section) — everything else is untouched. */
export function upsertUsagesSection(content: string, usages: PatternUsage[]): string {
  const block = renderUsagesBlock(usages);
  // Detect by the stable prefix, not the full marker, so a manifest written by an
  // older version (different marker tail) is still found and replaced, not doubled.
  const startIdx = content.indexOf(USAGES_MARKER_PREFIX);
  if (startIdx !== -1) {
    const endIdx = content.indexOf(USAGES_END, startIdx);
    if (endIdx !== -1) {
      const after = endIdx + USAGES_END.length;
      return content.slice(0, startIdx) + block + content.slice(after);
    }
    // Start marker present but end marker lost (hand-edit / merge): replace from the
    // start marker to the next section heading so no orphaned block is left to double-count.
    const nextSection = content.indexOf('\n## ', startIdx);
    const truncateAt = nextSection !== -1 ? nextSection : content.length;
    return content.slice(0, startIdx) + block + content.slice(truncateAt);
  }
  // No marker block yet — insert after the heading, or append a fresh section.
  // NB: a function replacer, not a string, so `$`-sequences in a file path can't
  // be interpreted as replacement patterns (`$'`, `$&`, …).
  if (content.includes(`\n${USAGES_HEADING}`) || content.startsWith(USAGES_HEADING)) {
    return content.replace(
      new RegExp(`(${USAGES_HEADING}\\n)`),
      (_m, heading: string) => `${heading}\n${block}\n`
    );
  }
  const sep = content.endsWith('\n') ? '\n' : '\n\n';
  return `${content}${sep}${USAGES_HEADING}\n\n${block}\n`;
}

/** Collapse newlines to spaces — every ADR field is single-line in the Markdown format. */
function oneLine(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').trim();
}

/** Render one ADR block. */
export function renderDecision(d: DesignDecision): string {
  const lines = [
    `### ${d.date} — ${oneLine(d.title)}`,
    '',
    `**Status:** ${oneLine(d.status)}`,
    '',
    `**Decision:** ${oneLine(d.decision)}`
  ];
  if (d.rationale) lines.push('', `**Rationale:** ${oneLine(d.rationale)}`);
  return `${lines.join('\n')}\n`;
}

/** Insert a new ADR at the top of the Design Decisions section (newest first). Creates the section if absent. */
export function appendDecision(content: string, decision: DesignDecision): string {
  const block = renderDecision(decision);
  const m = content.match(/(?:^|\n)## Design Decisions[^\n]*\n/);
  if (m && m.index !== undefined) {
    let pos = m.index + m[0].length; // just past the heading line's newline
    let prefix = '';
    if (content[pos] === '\n')
      pos += 1; // keep an existing blank line, insert after it
    else prefix = '\n'; // no blank line below the heading — add one
    return `${content.slice(0, pos) + prefix + block}\n${content.slice(pos)}`;
  }
  const sep = content.endsWith('\n') ? '\n' : '\n\n';
  return `${content}${sep}${DECISIONS_HEADING}\n\n${block}`;
}

/** A starter manifest for a project that has none. */
export function createManifestTemplate(opts: {
  paradigm?: string;
  theme?: string;
  density?: string;
  projectName?: string;
}): string {
  const fm = [
    '---',
    `paradigm: ${opts.paradigm ?? 'minimal'}`,
    `theme: ${opts.theme ?? 'default'}`,
    `density: ${opts.density ?? 'comfortable'}`,
    '---'
  ].join('\n');
  return [
    fm,
    '',
    `# Design Manifest${opts.projectName ? ` — ${opts.projectName}` : ''}`,
    '',
    'The persistent design intent for this project. Frontmatter records the enforced intake',
    'decisions (paradigm, theme, density). `## Pattern Usages` is regenerated from',
    '`data-design-pattern` markers by `urbicon sync-manifest`. `## Design Decisions` is an',
    'append-only ADR log written by `urbicon record-decision`.',
    '',
    USAGES_HEADING,
    '',
    renderUsagesBlock([]),
    '',
    DECISIONS_HEADING,
    ''
  ].join('\n');
}

/** Human-readable context summary for `urbicon context`. */
export function formatContext(manifest: DesignManifest): string {
  let md = '# Design Context\n\n';

  const fm = manifest.frontmatter;
  const keys = Object.keys(fm);
  if (keys.length > 0) {
    md += '## Intake\n\n';
    for (const k of keys) md += `- **${k}:** ${fm[k]}\n`;
    md += '\n';
    if (fm.paradigm) {
      md += `> Stay within the **${fm.paradigm}** paradigm. Call \`get_design_principles(topic="theming")\` for its token profile.\n\n`;
    }
  }

  md += '## Pattern Usages\n\n';
  if (manifest.usages.length === 0) {
    md +=
      '_None recorded._ Add `data-design-pattern="<name>"` to page roots, then run `urbicon sync-manifest`.\n\n';
  } else {
    const byPattern = new Map<string, string[]>();
    for (const u of manifest.usages) {
      (byPattern.get(u.pattern) ?? byPattern.set(u.pattern, []).get(u.pattern)!).push(u.file);
    }
    for (const [pattern, files] of [...byPattern].sort((a, b) => a[0].localeCompare(b[0]))) {
      md += `- \`${pattern}\` (${files.length}): ${files.join(', ')}\n`;
    }
    md += '\n> To change a pattern across the app, migrate every file listed under it.\n\n';
  }

  md += '## Design Decisions\n\n';
  if (manifest.decisions.length === 0) {
    md +=
      '_None recorded._ Use `urbicon record-decision` when you deviate from a pattern or principle.\n';
  } else {
    for (const d of manifest.decisions) {
      md += `- **${d.date} — ${d.title}** (${d.status}): ${d.decision}\n`;
    }
  }
  return md;
}

export { DECISIONS_HEADING, USAGES_END, USAGES_HEADING, USAGES_START };

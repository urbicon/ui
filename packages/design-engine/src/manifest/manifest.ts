/**
 * Parse and edit a `design.manifest.md`. Deliberately dependency-free (no YAML
 * lib — consistent with the zero-dep ethos): frontmatter is flat `key: value`,
 * and edits are surgical (replace one marked block / insert one ADR) so any
 * hand-written prose, ordering, and formatting survive a round-trip.
 */

import type {
  DesignDecision,
  DesignManifest,
  PatternUsage,
  ProductIntent,
  ValidationHistoryEntry
} from './types.js';

const INTENT_HEADING = '## Product Intent';
const TOKEN_OVERRIDES_HEADING = '## Token Overrides';
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

/** The empty product-intent shape (arrays never undefined). */
function emptyIntent(): ProductIntent {
  return { voice: [], references: [], antiReferences: [] };
}

/**
 * Parse the `## Product Intent` section. Two field grammars coexist (tolerantly):
 * an inline `**Label:** value` (audience, voice) and a labelled list — `**Label:**`
 * followed by `- bullets` and/or an inline comma value (references, anti-references).
 */
function parseIntent(body: string): ProductIntent {
  const section = extractSection(body, INTENT_HEADING);
  if (section === null) return emptyIntent();
  const lines = section.split('\n');

  // A line that opens a different labelled field, or a heading — either terminates
  // the value currently being gathered.
  const isFieldOrHeading = (l: string): boolean => /^\*\*[^*]+:\*\*/.test(l) || /^#{1,6}\s/.test(l);

  // `**Label:** value`, joining soft-wrapped continuation lines into one value —
  // a Markdown line-wrap inside the value (common for a sentence-long Audience) is
  // a continuation, not a truncation point. Stops at the first blank line, the next
  // labelled field, or a heading.
  const inlineField = (label: string): string | undefined => {
    const labelRe = new RegExp(`^\\*\\*${label}:\\*\\*\\s*(.*)$`);
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i]!.match(labelRe);
      if (!m) continue;
      const parts = m[1]!.trim() ? [m[1]!.trim()] : [];
      for (let j = i + 1; j < lines.length; j++) {
        const l = lines[j]!;
        if (l.trim() === '' || isFieldOrHeading(l)) break;
        parts.push(l.trim());
      }
      const value = parts.join(' ').trim();
      return value === '' ? undefined : value;
    }
    return undefined;
  };

  // Items under a `**Label:**`: an inline comma list on the label line (and its
  // soft-wrapped continuation lines) and/or the bullet lines that follow it, up to
  // the next labelled field. Blank/prose lines are skipped, not terminators.
  const listField = (label: string): string[] => {
    const items: string[] = [];
    const labelRe = new RegExp(`^\\*\\*${label}:\\*\\*\\s*(.*)$`);
    let capturing = false;
    let inInlineRun = false; // still gathering the soft-wrapped inline comma value
    for (const l of lines) {
      if (!capturing) {
        const m = l.match(labelRe);
        if (m) {
          capturing = true;
          inInlineRun = true;
          const inline = m[1]!.trim();
          if (inline) items.push(...splitList(inline));
        }
        continue;
      }
      if (isFieldOrHeading(l)) break; // next labelled field / heading ends this one
      const bullet = l.match(/^\s*[-*]\s+(.+)$/);
      if (bullet) {
        items.push(bullet[1]!.trim());
        inInlineRun = false; // bullets started — later loose lines aren't inline-list continuation
        continue;
      }
      if (l.trim() === '') {
        inInlineRun = false; // blank closes the inline run (bullets may still follow)
        continue;
      }
      if (inInlineRun) items.push(...splitList(l.trim())); // soft-wrapped continuation of the inline list
    }
    return items;
  };

  // Voice shares the list grammar (inline comma list and/or bullets) — a user who
  // mirrors the bullet style of the reference lists still gets parsed, not silently dropped.
  return {
    audience: inlineField('Audience'),
    voice: listField('Voice'),
    references: listField('References'),
    antiReferences: listField('Anti-references')
  };
}

/** Split a comma-separated inline value into trimmed, non-empty parts. */
function splitList(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Parse the `## Token Overrides` section: the backtick-quoted cores in its bullet
 * list (a trailing `— note` is ignored). Deduplicated, order preserved. Cores only
 * (`surface-brand`); a full utility like `bg-surface-brand` parses but is inert at
 * the linter (matching the `extraTokens` contract), so we keep it verbatim.
 */
function parseTokenOverrides(body: string): string[] {
  const section = extractSection(body, TOKEN_OVERRIDES_HEADING);
  if (!section) return [];
  const cores: string[] = [];
  const seen = new Set<string>();
  for (const m of section.matchAll(/^\s*[-*]\s+`([a-z][a-z0-9-]*)`/gm)) {
    const core = m[1]!;
    if (!seen.has(core)) {
      seen.add(core);
      cores.push(core);
    }
  }
  return cores;
}

/** Parse a manifest file into structured form. */
export function parseManifest(content: string, exists = true): DesignManifest {
  const { data, body } = parseFrontmatter(content);
  return {
    frontmatter: data,
    intent: parseIntent(body),
    tokenOverrides: parseTokenOverrides(body),
    usages: parseUsages(body),
    decisions: parseDecisions(body),
    exists
  };
}

/** The empty-manifest sentinel returned when no file exists. */
export function emptyManifest(): DesignManifest {
  return {
    frontmatter: {},
    intent: emptyIntent(),
    tokenOverrides: [],
    usages: [],
    decisions: [],
    exists: false
  };
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
    'decisions (paradigm, theme, density). `## Product Intent` is the target identity.',
    '`## Token Overrides` lists project-specific tokens `urbicon validate` should accept.',
    '`## Pattern Usages` is regenerated from `data-design-pattern` markers by',
    '`urbicon sync-manifest`. `## Design Decisions` is an append-only ADR log written by',
    '`urbicon record-decision`.',
    '',
    INTENT_HEADING,
    '',
    '<!-- The identity this project designs toward — read at the start of every design task.',
    '     Fill each field; an empty field is simply "not set yet". Voice = a few adjectives. -->',
    '',
    '**Audience:**',
    '',
    '**Voice:**',
    '',
    '**References:**',
    '',
    '**Anti-references:**',
    '',
    TOKEN_OVERRIDES_HEADING,
    '',
    '<!-- Project-specific semantic token cores defined on top of Urbicon’s. Listed here as a',
    '     bullet of `core` (the part after the utility prefix — `surface-brand`, not',
    '     `bg-surface-brand`), they are treated as valid by `urbicon validate`. -->',
    '',
    '_None yet._',
    '',
    USAGES_HEADING,
    '',
    renderUsagesBlock([]),
    '',
    DECISIONS_HEADING,
    ''
  ].join('\n');
}

/** Whether a product intent carries any content at all. */
function intentIsEmpty(intent: ProductIntent): boolean {
  return (
    !intent.audience &&
    intent.voice.length === 0 &&
    intent.references.length === 0 &&
    intent.antiReferences.length === 0
  );
}

/** Render the recent-validation drift block from the sidecar history (newest entries). */
function formatDrift(history: ValidationHistoryEntry[]): string {
  const recent = history.slice(-5);
  const last = recent[recent.length - 1]!;
  let md = '## Validation Drift\n\n';
  md +=
    `Last run (${last.date}): correctness ${last.correctness}/100 · slop ${last.slop}/100 — ` +
    `${last.files} file(s), ${last.errors} error(s), ${last.warnings} warning(s).\n`;
  if (recent.length > 1) {
    md += `\nRecent correctness: ${recent.map((e) => e.correctness).join(' → ')}\n`;
    md += `Recent slop-floor:  ${recent.map((e) => e.slop).join(' → ')}\n`;
  }
  return md;
}

/**
 * Human-readable context summary for `urbicon context`. Pass the sidecar
 * validation history (when present) to append a drift block; omit it for the
 * pure-manifest summary.
 */
export function formatContext(
  manifest: DesignManifest,
  history: ValidationHistoryEntry[] = []
): string {
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

  md += '## Product Intent\n\n';
  const intent = manifest.intent;
  if (intentIsEmpty(intent)) {
    md +=
      '_Not set._ Define audience, voice, references and anti-references so design stays consistent with a target identity, not merely generic.\n\n';
  } else {
    if (intent.audience) md += `- **Audience:** ${intent.audience}\n`;
    if (intent.voice.length > 0) md += `- **Voice:** ${intent.voice.join(', ')}\n`;
    if (intent.references.length > 0) md += `- **References:** ${intent.references.join('; ')}\n`;
    if (intent.antiReferences.length > 0)
      md += `- **Anti-references:** ${intent.antiReferences.join('; ')}\n`;
    md += '\n';
  }

  if (manifest.tokenOverrides.length > 0) {
    md += '## Token Overrides\n\n';
    md += `${manifest.tokenOverrides.map((c) => `\`${c}\``).join(', ')}\n\n`;
    md += '> Treated as valid by `urbicon validate` (passed as extra tokens for this project).\n\n';
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

  if (history.length > 0) md += `\n${formatDrift(history)}`;
  return md;
}

export { DECISIONS_HEADING, USAGES_END, USAGES_HEADING, USAGES_START };

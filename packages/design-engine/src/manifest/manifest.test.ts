import { describe, expect, it } from 'vitest';
import {
  appendDecision,
  createManifestTemplate,
  formatContext,
  parseFrontmatter,
  parseManifest,
  upsertUsagesSection
} from './manifest.js';
import type { DesignDecision, ValidationHistoryEntry } from './types.js';

describe('parseFrontmatter', () => {
  it('reads flat key:value pairs and strips the block from the body', () => {
    const { data, body } = parseFrontmatter(
      '---\nparadigm: corporate\ntheme: "ocean"\n---\n# Title\nrest'
    );
    expect(data).toEqual({ paradigm: 'corporate', theme: 'ocean' });
    expect(body).toBe('# Title\nrest');
  });
  it('returns empty data when there is no frontmatter', () => {
    const { data, body } = parseFrontmatter('# No frontmatter');
    expect(data).toEqual({});
    expect(body).toBe('# No frontmatter');
  });
});

describe('manifest template + parse round-trip', () => {
  const template = createManifestTemplate({
    paradigm: 'corporate',
    theme: 'ocean',
    projectName: 'Acme'
  });

  it('parses its own scaffold', () => {
    const m = parseManifest(template);
    expect(m.frontmatter.paradigm).toBe('corporate');
    expect(m.frontmatter.theme).toBe('ocean');
    expect(m.usages).toEqual([]);
    expect(m.decisions).toEqual([]);
    expect(m.exists).toBe(true);
  });
});

describe('upsertUsagesSection', () => {
  const template = createManifestTemplate({});
  const usages = [
    { pattern: 'dashboard', file: 'src/routes/dashboard/+page.svelte' },
    { pattern: 'form-page', file: 'src/routes/signup/+page.svelte' }
  ];

  it('fills the generated block and is re-parseable', () => {
    const updated = upsertUsagesSection(template, usages);
    const m = parseManifest(updated);
    expect(m.usages).toHaveLength(2);
    expect(m.usages).toContainEqual({
      pattern: 'dashboard',
      file: 'src/routes/dashboard/+page.svelte'
    });
  });

  it('is idempotent — replacing the block, not appending', () => {
    const once = upsertUsagesSection(template, usages);
    const twice = upsertUsagesSection(once, usages);
    expect(twice).toBe(once);
  });

  it('removes stale usages on the next sync', () => {
    const withTwo = upsertUsagesSection(template, usages);
    const withOne = upsertUsagesSection(withTwo, [usages[0]!]);
    expect(parseManifest(withOne).usages).toHaveLength(1);
  });

  it('appends a Pattern Usages section when none exists', () => {
    const bare = '# Bare manifest\n\nsome prose\n';
    const updated = upsertUsagesSection(bare, usages);
    expect(updated).toContain('## Pattern Usages');
    expect(parseManifest(updated).usages).toHaveLength(2);
    expect(updated).toContain('some prose'); // original content preserved
  });
});

describe('appendDecision', () => {
  const dec = (title: string, date: string): DesignDecision => ({
    date,
    title,
    status: 'accepted',
    decision: `do ${title}`,
    rationale: `because ${title}`
  });

  it('adds a decision into the existing section, newest first', () => {
    const t = createManifestTemplate({});
    const one = appendDecision(t, dec('first', '2026-06-01'));
    const two = appendDecision(one, dec('second', '2026-06-02'));
    const m = parseManifest(two);
    expect(m.decisions.map((d) => d.title)).toEqual(['second', 'first']);
    expect(m.decisions[0]!.rationale).toBe('because second');
  });

  it('creates the section when absent and preserves frontmatter + usages', () => {
    const withUsage = upsertUsagesSection(createManifestTemplate({ paradigm: 'brutalist' }), [
      { pattern: 'dashboard', file: 'a.svelte' }
    ]);
    const updated = appendDecision(withUsage, dec('x', '2026-06-13'));
    const m = parseManifest(updated);
    expect(m.frontmatter.paradigm).toBe('brutalist');
    expect(m.usages).toHaveLength(1);
    expect(m.decisions).toHaveLength(1);
  });
});

describe('formatContext', () => {
  it('summarises intake, usages and decisions', () => {
    let content = createManifestTemplate({ paradigm: 'corporate', theme: 'ocean' });
    content = upsertUsagesSection(content, [{ pattern: 'dashboard', file: 'a.svelte' }]);
    content = appendDecision(content, {
      date: '2026-06-13',
      title: 'Tabs for settings',
      status: 'accepted',
      decision: 'use tabs'
    });
    const out = formatContext(parseManifest(content));
    expect(out).toContain('corporate');
    expect(out).toContain('`dashboard`');
    expect(out).toContain('Tabs for settings');
  });

  it('guides the user when the manifest is empty', () => {
    const out = formatContext(parseManifest(createManifestTemplate({})));
    expect(out).toContain('data-design-pattern');
    expect(out).toContain('urbicon record-decision');
  });
});

describe('parseManifest — product intent', () => {
  it('parses audience, voice, and bulleted references / anti-references', () => {
    const md = [
      '## Product Intent',
      '',
      '**Audience:** Municipal ops staff — non-technical, time-pressured.',
      '',
      '**Voice:** calm, precise, trustworthy',
      '',
      '**References:**',
      '- Linear — focused density',
      '- Stripe Dashboard',
      '',
      '**Anti-references:**',
      '- Bootstrap admin',
      '- rainbow SaaS'
    ].join('\n');
    const { intent } = parseManifest(md);
    expect(intent.audience).toBe('Municipal ops staff — non-technical, time-pressured.');
    expect(intent.voice).toEqual(['calm', 'precise', 'trustworthy']);
    expect(intent.references).toEqual(['Linear — focused density', 'Stripe Dashboard']);
    expect(intent.antiReferences).toEqual(['Bootstrap admin', 'rainbow SaaS']);
  });

  it('tolerates an inline comma list for references (not only bullets)', () => {
    const md = '## Product Intent\n\n**References:** Linear, Stripe, Vercel\n';
    expect(parseManifest(md).intent.references).toEqual(['Linear', 'Stripe', 'Vercel']);
  });

  it('also parses voice written as bullets, not only the inline comma form', () => {
    const md = '## Product Intent\n\n**Voice:**\n- calm\n- precise\n- trustworthy\n';
    expect(parseManifest(md).intent.voice).toEqual(['calm', 'precise', 'trustworthy']);
  });

  it('parses bullet lists that put a blank line between the label and the bullets', () => {
    // The Markdown-idiomatic form (and what `prettier` produces) — must parse too.
    const md = '## Product Intent\n\n**References:**\n\n- Linear\n- Stripe\n';
    expect(parseManifest(md).intent.references).toEqual(['Linear', 'Stripe']);
  });

  it('joins a soft-wrapped Audience value instead of truncating at the first line', () => {
    const md =
      '## Product Intent\n\n**Audience:** Homeowners with rooftop solar and a battery — non-experts who glance\nat production, consumption and savings.\n';
    expect(parseManifest(md).intent.audience).toBe(
      'Homeowners with rooftop solar and a battery — non-experts who glance at production, consumption and savings.'
    );
  });

  it('keeps the continuation items of a soft-wrapped inline reference list', () => {
    const md = '## Product Intent\n\n**References:** Linear, Stripe, Notion,\nFigma, Things\n';
    expect(parseManifest(md).intent.references).toEqual([
      'Linear',
      'Stripe',
      'Notion',
      'Figma',
      'Things'
    ]);
  });

  it('returns an empty intent when the section is absent', () => {
    const intent = parseManifest('# Bare\n\nsome prose\n').intent;
    expect(intent).toEqual({ voice: [], references: [], antiReferences: [] });
  });

  it('does not parse the scaffold’s bare-label placeholders as values', () => {
    // Regression: empty `**Audience:**` etc. in the template must read as "not set".
    const intent = parseManifest(createManifestTemplate({})).intent;
    expect(intent.audience).toBeUndefined();
    expect(intent.voice).toEqual([]);
    expect(intent.references).toEqual([]);
    expect(intent.antiReferences).toEqual([]);
  });
});

describe('parseManifest — token overrides', () => {
  it('parses backtick cores from the bullet list and ignores trailing notes', () => {
    const md = [
      '## Token Overrides',
      '',
      '- `surface-brand` — the marketing accent surface',
      '- `text-brand`'
    ].join('\n');
    expect(parseManifest(md).tokenOverrides).toEqual(['surface-brand', 'text-brand']);
  });

  it('deduplicates and preserves first-seen order', () => {
    const md = '## Token Overrides\n\n- `a-one`\n- `b-two`\n- `a-one`\n';
    expect(parseManifest(md).tokenOverrides).toEqual(['a-one', 'b-two']);
  });

  it('returns [] for an absent section and for the scaffold placeholder', () => {
    expect(parseManifest('# Bare\n').tokenOverrides).toEqual([]);
    // The template's explanatory comment mentions `surface-brand` / `bg-surface-brand`
    // but never as a bullet, so nothing is parsed out of the scaffold.
    expect(parseManifest(createManifestTemplate({})).tokenOverrides).toEqual([]);
  });
});

describe('parseManifest — exempt entries', () => {
  it('parses path, rule ids, and the optional reason', () => {
    const md = [
      '## Exempt',
      '',
      '- `src/routes/+page.svelte` — `raw-tailwind-color`, `focus-not-visible` — landing renders linter output as prose',
      '- `src/routes/marketing/` — `magic-dimension`'
    ].join('\n');
    expect(parseManifest(md).exempts).toEqual([
      {
        path: 'src/routes/+page.svelte',
        rules: ['raw-tailwind-color', 'focus-not-visible'],
        note: 'landing renders linter output as prose'
      },
      { path: 'src/routes/marketing/', rules: ['magic-dimension'] }
    ]);
  });

  it('drops a bullet without rule ids (no blanket exempt) and non-bullet prose', () => {
    const md = [
      '## Exempt',
      '',
      '- `src/routes/+page.svelte` — everything, please',
      'Some explanatory prose with `backticks` in it.'
    ].join('\n');
    expect(parseManifest(md).exempts).toEqual([]);
  });

  it('returns [] for an absent section and for the scaffold placeholder', () => {
    expect(parseManifest('# Bare\n').exempts).toEqual([]);
    expect(parseManifest(createManifestTemplate({})).exempts).toEqual([]);
  });

  it('formatContext lists exemptions so the intent stays visible', () => {
    const md = ['## Exempt', '', '- `src/routes/+page.svelte` — `inline-style` — poster'].join(
      '\n'
    );
    expect(formatContext(parseManifest(md))).toContain(
      '- `src/routes/+page.svelte` — `inline-style` — poster'
    );
  });
});

describe('template scaffolds the new sections without breaking the round-trip', () => {
  it('still parses frontmatter, usages and decisions; adds empty intent + overrides', () => {
    const m = parseManifest(createManifestTemplate({ paradigm: 'editorial', theme: 'slate' }));
    expect(m.frontmatter.paradigm).toBe('editorial');
    expect(m.usages).toEqual([]);
    expect(m.decisions).toEqual([]);
    expect(m.tokenOverrides).toEqual([]);
    expect(m.intent.voice).toEqual([]);
    expect(m.exists).toBe(true);
  });

  it('contains all five section headings', () => {
    const t = createManifestTemplate({});
    for (const h of [
      '## Product Intent',
      '## Token Overrides',
      '## Pattern Usages',
      '## Design Decisions'
    ]) {
      expect(t).toContain(h);
    }
  });
});

describe('formatContext — intent, overrides, drift', () => {
  const history = (over: Partial<ValidationHistoryEntry> = {}): ValidationHistoryEntry => ({
    date: '2026-06-21T10:00:00.000Z',
    files: 4,
    errors: 0,
    warnings: 0,
    infos: 3,
    correctness: 100,
    slop: 70,
    ...over
  });

  it('renders the intent and token overrides when set', () => {
    let md = '## Product Intent\n\n**Audience:** Ops staff\n\n**Voice:** calm, precise\n';
    md += '\n## Token Overrides\n\n- `surface-brand`\n';
    const out = formatContext(parseManifest(md));
    expect(out).toContain('**Audience:** Ops staff');
    expect(out).toContain('**Voice:** calm, precise');
    expect(out).toContain('`surface-brand`');
    expect(out).toContain('passed as extra tokens');
  });

  it('nudges when the product intent is empty', () => {
    const out = formatContext(parseManifest(createManifestTemplate({})));
    expect(out).toContain('## Product Intent');
    expect(out).toContain('_Not set._');
  });

  it('appends a drift block with the score trend when history is supplied', () => {
    const out = formatContext(parseManifest(createManifestTemplate({})), [
      history({ date: '2026-06-19T00:00:00.000Z', slop: 50 }),
      history({ date: '2026-06-20T00:00:00.000Z', slop: 60 }),
      history({ date: '2026-06-21T00:00:00.000Z', slop: 70 })
    ]);
    expect(out).toContain('## Validation Drift');
    expect(out).toContain('correctness 100/100 · slop 70/100');
    expect(out).toContain('50 → 60 → 70'); // recent slop trend
  });

  it('omits the drift block when no history is supplied', () => {
    expect(formatContext(parseManifest(createManifestTemplate({})))).not.toContain(
      '## Validation Drift'
    );
  });
});

describe('review hardening', () => {
  it('does not interpret `$` sequences in a file path as replacement patterns', () => {
    // Heading present, no marker block yet → the String.replace fallback branch.
    const bare = '# M\n\n## Pattern Usages\n';
    const updated = upsertUsagesSection(bare, [
      { pattern: 'dashboard', file: "src/o'$&-$1/+page.svelte" }
    ]);
    expect(updated).toContain("src/o'$&-$1/+page.svelte");
    expect(parseManifest(updated).usages[0]?.file).toBe("src/o'$&-$1/+page.svelte");
  });

  it('replaces an orphaned start marker (lost end marker) without duplicating usages', () => {
    // Intentionally the OLD marker text ("managed by sync_design_manifest") — this
    // doubles as a backward-compat guard: prefix detection must still find a block
    // written by an earlier version whose marker tail differs.
    const orphaned =
      '## Pattern Usages\n\n<!-- AUTO-GENERATED pattern usages — managed by sync_design_manifest; do not edit by hand -->\n\n- `dashboard` — old.svelte\n\n## Design Decisions\n';
    const updated = upsertUsagesSection(orphaned, [{ pattern: 'form-page', file: 'new.svelte' }]);
    const usages = parseManifest(updated).usages;
    expect(usages).toHaveLength(1);
    expect(usages[0]).toEqual({ pattern: 'form-page', file: 'new.svelte' });
    expect(updated).toContain('## Design Decisions'); // following section preserved
  });

  it('replaces an intact old-tail usages block (both markers present) — backward-compat', () => {
    // A manifest written by an earlier version: old marker tail, BOTH markers intact.
    // Prefix detection must find and replace it, not append a second block.
    const oldStyle =
      '## Pattern Usages\n\n<!-- AUTO-GENERATED pattern usages — managed by sync_design_manifest; do not edit by hand -->\n\n- `dashboard` — old.svelte\n\n<!-- END pattern usages -->\n\n## Design Decisions\n';
    const updated = upsertUsagesSection(oldStyle, [{ pattern: 'form-page', file: 'new.svelte' }]);
    expect(parseManifest(updated).usages).toEqual([{ pattern: 'form-page', file: 'new.svelte' }]);
    expect(updated).not.toContain('old.svelte'); // stale entry replaced, not duplicated
    expect(updated).toContain('## Design Decisions'); // following section preserved
  });

  it('collapses multi-line decision/rationale text to a single line (no truncation on re-parse)', () => {
    const updated = appendDecision(createManifestTemplate({}), {
      date: '2026-06-13',
      title: 'Cache strategy',
      status: 'accepted',
      decision: 'Use SWR.\nFallback to stale for 30s.',
      rationale: 'Line one.\r\nLine two.'
    });
    const d = parseManifest(updated).decisions[0]!;
    expect(d.decision).toBe('Use SWR. Fallback to stale for 30s.');
    expect(d.rationale).toBe('Line one. Line two.');
  });

  it('tolerates CRLF frontmatter', () => {
    const { data } = parseFrontmatter(
      '---\r\nparadigm: brutalist\r\ntheme: forest\r\n---\r\n# Title'
    );
    expect(data).toEqual({ paradigm: 'brutalist', theme: 'forest' });
  });
});

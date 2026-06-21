import { describe, expect, it } from 'vitest';
import {
  appendDecision,
  createManifestTemplate,
  formatContext,
  parseFrontmatter,
  parseManifest,
  upsertUsagesSection
} from './manifest.js';
import type { DesignDecision } from './types.js';

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
    const orphaned =
      '## Pattern Usages\n\n<!-- AUTO-GENERATED pattern usages — managed by sync_design_manifest; do not edit by hand -->\n\n- `dashboard` — old.svelte\n\n## Design Decisions\n';
    const updated = upsertUsagesSection(orphaned, [{ pattern: 'form-page', file: 'new.svelte' }]);
    const usages = parseManifest(updated).usages;
    expect(usages).toHaveLength(1);
    expect(usages[0]).toEqual({ pattern: 'form-page', file: 'new.svelte' });
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

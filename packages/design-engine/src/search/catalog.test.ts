import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { matchComponents, scoreComponents, searchComponents } from './match.js';
import type { ComponentCatalog } from './types.js';

// Positive controls on the shipped catalog, not a fixture: the queries that were
// measured to go wrong (#444) and the ones that must keep their answer. The bundle
// is docs-gen output (`docs:gen:all`; CI's `build:ts` emits it before this suite),
// git-ignored, so a checkout without it skips — a skipped block here means the
// controls did not run, not that they passed.
const catalogPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../design-content/content/component-catalog.json'
);
const catalogAvailable = existsSync(catalogPath);
const catalog = (
  catalogAvailable ? JSON.parse(readFileSync(catalogPath, 'utf-8')) : { components: [] }
) as ComponentCatalog;

const names = (query: string): string[] =>
  matchComponents(catalog.components, query).map((c) => c.name);

describe.skipIf(!catalogAvailable)('matchComponents on the shipped catalog', () => {
  it('finds a component by its name', () => {
    expect(names('kbd')[0]).toBe('Kbd');
  });

  it('finds a component through a whole word in its text', () => {
    // "filter" is a whole word in Combobox's summary and prop docs; the description
    // only has "filterable" and "filtering".
    expect(names('filter')[0]).toBe('Combobox');
  });

  it('does not lead with a name the word is only a fragment of', () => {
    // "list" sits inside "Listener"; ChatMessageList has it as a word of its slug.
    expect(names('list')[0]).not.toBe('NotificationListener');
    expect(names('list')[0]).toBe('ChatMessageList');
  });

  it('reports no match for a word the catalog only has inside longer words', () => {
    // "rating" occurs once, inside "separating"; there is no Rating component.
    expect(names('rating')).toEqual([]);
    // "stat" sits inside "State", "states", "status", "static"; "metric" and "kpi"
    // occur nowhere. There is no Stat component.
    expect(names('stat metric kpi')).toEqual([]);
  });

  it('names the fragment hits as closest, not as matches', () => {
    const { matches, closest } = searchComponents(catalog.components, 'stat metric kpi');
    expect(matches).toEqual([]);
    expect(closest.map((c) => c.name)).toContain('EmptyState');
    expect(closest.length).toBeLessThanOrEqual(3);
  });

  it('reaches a component whose name the caller split into words', () => {
    // Every word of "tool tip" is a fragment of the one-word slug `tooltip`, so
    // before #446 the component the query names scored 37 and counted as a miss.
    expect(names('tool tip')[0]).toBe('Tooltip');
    expect(names('combo box')[0]).toBe('Combobox');
    expect(names('date picker')[0]).toBe('DatePicker');
    expect(names('datepicker')[0]).toBe('DatePicker');
  });

  it('does not let a word the whole catalog uses re-enable the best-of', () => {
    // "component" lands in the text of 34 of the 99 entries; "rating" lands on
    // none. Before #446 the pair returned ten confident matches led by A2UIView.
    expect(names('rating component')).toEqual([]);
    expect(names('a rating component')).toEqual([]);
    const { closest } = searchComponents(catalog.components, 'a rating component');
    expect(closest.length).toBeGreaterThan(0);
  });

  it('lands two common words where they meet on one component', () => {
    // Neither word discriminates alone — `dark` lands in the text of 46 of the 99
    // entries, `mode` 51 — but together they are ThemeSwitcher, which outranks the
    // preset-boilerplate entries carrying both at 10 to 6.
    expect(names('dark mode')[0]).toBe('ThemeSwitcher');
  });

  it('reads a prop name as a word, so a plural prop lands', () => {
    // `key` is common and lands on Kbd only in text; `binding` lands nowhere near
    // it, so the pair never forms. What carries Kbd is its `keys` prop — the same
    // regular plural the text scan has always accepted.
    expect(names('key binding')[0]).toBe('Kbd');
  });

  it('shows a weak entry that outscores the matches instead of hiding it', () => {
    // FormField scores 13 on `text` alone — `help` reaches it only as a prefix of
    // "helper", which is not a plural and stays out — so it is filed weak above
    // everything that landed. The closest block is what keeps it reachable.
    const { matches, closest } = searchComponents(catalog.components, 'help text');
    expect(matches[0]?.name).not.toBe('FormField');
    expect(closest.map((c) => c.name)).toContain('FormField');
  });

  it('keeps a query whose words are ordinary but not ubiquitous', () => {
    // Both words are distinctive on the count that decides the class: `login`
    // lands on 6 texts, `form` on 24 — under the 24.75 boundary, so `form` lands
    // alone and needs no help from FormField's slug word. (Counting every route,
    // `form` reaches 31 entries; that number classifies nothing.)
    expect(names('login form')[0]).toBe('LoginPage');
    expect(names('form')[0]).toBe('FormField');
  });

  it('pins the two scores that rule out a numeric floor', () => {
    // The doc comment on scoreComponents turns on these being equal: a threshold
    // that drops `stat` would drop `filter` with it.
    const at = (q: string, name: string) =>
      scoreComponents(catalog.components, q).find((s) => s.entry.name === name)?.score;
    expect(at('filter', 'Combobox')).toBe(6);
    expect(at('stat', 'Badge')).toBe(6);
  });

  it('keeps every component reachable by its own name and slug', () => {
    const misses: string[] = [];
    for (const c of catalog.components) {
      for (const q of [c.name, c.slug.replace(/-/g, ' ')]) {
        if (names(q)[0] !== c.name) misses.push(`${q} → ${names(q)[0]}`);
      }
    }
    expect(misses).toEqual([]);
  });
});

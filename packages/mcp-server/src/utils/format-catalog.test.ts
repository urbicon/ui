import { describe, expect, it } from 'vitest';
import type { ComponentCatalogEntry, RecipeEntry } from '../data/catalog-loader.js';
import { filterInternalComponents, formatCompactCatalog } from './format-catalog.js';

function makeEntry(
  overrides: Partial<ComponentCatalogEntry> & Pick<ComponentCatalogEntry, 'name' | 'slug'>
): ComponentCatalogEntry {
  return {
    package: '@urbicon-ui/blocks',
    group: 'primitives',
    description: 'desc',
    tags: [],
    import: `import { ${overrides.name} } from '@urbicon-ui/blocks';`,
    llmTxtPath: '',
    variants: [],
    keyProps: [],
    keyPropTypes: {},
    slots: [],
    hasExamples: false,
    relatedComponents: [],
    ...overrides
  };
}

/** A component of the docs package — the thing that must never be offered. */
function makeDocsEntry(name: string, slug: string): ComponentCatalogEntry {
  return makeEntry({
    name,
    slug,
    package: '@urbicon-ui/docs',
    group: 'components',
    import: `import { ${name} } from '@urbicon-ui/docs';`
  });
}

describe('filterInternalComponents', () => {
  it('removes docs-site-internal components from the list', () => {
    const entries = [
      makeEntry({ name: 'Button', slug: 'button' }),
      makeDocsEntry('ApiReference', 'api-reference'),
      makeDocsEntry('PlaygroundConfigurator', 'playground-configurator'),
      makeEntry({ name: 'Input', slug: 'input' })
    ];
    const result = filterInternalComponents(entries);
    expect(result.map((e) => e.name)).toEqual(['Button', 'Input']);
  });

  it('returns an empty list when all entries are internal', () => {
    const entries = [
      makeDocsEntry('DocsLayout', 'docs-layout'),
      makeDocsEntry('InfoCard', 'info-card')
    ];
    expect(filterInternalComponents(entries)).toEqual([]);
  });

  it('drops a docs component whose name nobody has ever listed', () => {
    // The failure this guards is not hypothetical: the filter used to be a
    // hand-kept set of names, it silently missed `CodePanel`, and adding
    // `NoteList` shipped a docs-only component into the public catalog. The
    // criterion is the package, so an unheard-of name must still be dropped.
    const entries = [
      makeEntry({ name: 'Button', slug: 'button' }),
      makeDocsEntry('SomeComponentAddedTomorrow', 'some-component-added-tomorrow')
    ];
    expect(filterInternalComponents(entries).map((e) => e.name)).toEqual(['Button']);
  });

  it('keeps a blocks component that happens to share a docs component name', () => {
    // The mirror image: `Section` exists in the docs package, but a
    // consumer-facing component of the same name must not be filtered out by
    // association.
    const entries = [makeEntry({ name: 'Section', slug: 'section' })];
    expect(filterInternalComponents(entries).map((e) => e.name)).toEqual(['Section']);
  });
});

describe('formatCompactCatalog', () => {
  const button = makeEntry({
    name: 'Button',
    slug: 'button',
    description: 'Click to do things',
    tags: ['action'],
    variants: [{ name: 'intent', values: ['primary', 'danger'] }]
  });
  const input = makeEntry({
    name: 'Input',
    slug: 'input',
    description: 'Text field',
    tags: ['form'],
    relatedComponents: ['Textarea']
  });
  const alert = makeEntry({
    name: 'Alert',
    slug: 'alert',
    description: 'Inline message',
    tags: ['feedback']
  });
  const orphan = makeEntry({
    name: 'Mystery',
    slug: 'mystery',
    description: 'No primary tag here',
    tags: ['unknown']
  });

  it('outputs a markdown document with the component count', () => {
    const md = formatCompactCatalog([button, input]);
    expect(md).toContain('# Urbicon UI Components');
    expect(md).toContain('> 2 components available.');
    expect(md).toContain('get_component');
  });

  it('groups components by their primary tag in the canonical order', () => {
    const md = formatCompactCatalog([alert, button, input]);
    const actionIdx = md.indexOf('## Actions');
    const formsIdx = md.indexOf('## Forms');
    const feedbackIdx = md.indexOf('## Feedback & Status');
    expect(actionIdx).toBeGreaterThan(-1);
    expect(formsIdx).toBeGreaterThan(actionIdx);
    expect(feedbackIdx).toBeGreaterThan(formsIdx);
  });

  it('puts components with unrecognised primary tags in the Other bucket', () => {
    const md = formatCompactCatalog([orphan]);
    expect(md).toContain('## Other');
    expect(md).toContain('Mystery');
  });

  it('renders variant details when a non-boolean variant is present', () => {
    const md = formatCompactCatalog([button]);
    expect(md).toContain('intent: primary/danger');
  });

  it('omits boolean-only variants from the rendered line', () => {
    const withBool = makeEntry({
      name: 'Toggle',
      slug: 'toggle',
      description: 'On/off',
      tags: ['form'],
      variants: [{ name: 'checked', values: ['true', 'false'] }]
    });
    const md = formatCompactCatalog([withBool]);
    expect(md).not.toContain('checked: true/false');
  });

  it('renders a Related hint when related components exist', () => {
    const md = formatCompactCatalog([input]);
    expect(md).toContain('Related: Textarea');
  });

  it('filters by the tags option', () => {
    const md = formatCompactCatalog([button, input, alert], { tags: ['form'] });
    // Matching the bold-component-bullet prefix avoids false positives from
    // the Quick-Setup section (which itself references `Button` in code).
    expect(md).toContain('- **Input**');
    expect(md).not.toContain('- **Button**');
    expect(md).not.toContain('- **Alert**');
  });

  it('appends a Recipes section when recipes are supplied', () => {
    const recipes: RecipeEntry[] = [
      {
        id: 'login-form',
        title: 'Login',
        description: 'Login screen',
        components: ['Input', 'Button'],
        code: '',
        features: []
      }
    ];
    const md = formatCompactCatalog([button, input], { recipes });
    expect(md).toContain('## Recipes');
    expect(md).toContain('**login-form**');
    expect(md).toContain('Input, Button');
  });
});

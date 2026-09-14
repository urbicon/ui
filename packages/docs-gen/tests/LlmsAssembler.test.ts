import * as fs from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LlmsAssemblerConfig } from '../src/generators/llm/LlmsAssembler';
import { LlmsAssembler } from '../src/generators/llm/LlmsAssembler';

vi.mock('fs/promises');
vi.mock('glob', () => ({
  glob: vi.fn()
}));

const { glob } = await import('glob');

const TEMPLATE = `# Urbicon UI

> Summary paragraph.

## Install

\`\`\`bash
bun add @urbicon-ui/blocks
\`\`\`

## Resources

{{RESOURCES}}

{{COMPONENTS}}
`;

const templatePath = '/repo/packages/docs-gen/templates/llms-template.md';
const catalogPath = '/repo/apps/docs/static/mcp/component-catalog.json';
const outputPath = '/repo/llms.txt';

/**
 * Table's single entry mirrors the real catalog anomaly this assembler is
 * built to survive: `MCPCatalogGenerator` defaults a missing `group` to
 * `'primitives'` for display, but the write loop never applied a group
 * segment for `table` on disk (`apps/docs/static/table/table/llm.txt`, not
 * `.../table/primitives/table/llm.txt`). The fixture's `group: 'primitives'`
 * is therefore deliberately wrong relative to the glob result below, so a
 * test can prove the href comes from the filesystem, not this field.
 */
const CATALOG = {
  components: [
    {
      name: 'Button',
      slug: 'button',
      package: '@urbicon-ui/blocks',
      group: 'primitives',
      description: 'Button description.',
      summary: 'Clicks things.',
      stability: 'stable'
    },
    {
      name: 'Accordion',
      slug: 'accordion',
      package: '@urbicon-ui/blocks',
      group: 'primitives',
      description: 'Accordion description.',
      summary: 'Collapses things.'
    },
    {
      name: 'Calendar',
      slug: 'calendar',
      package: '@urbicon-ui/blocks',
      group: 'components',
      description: 'Calendar description.',
      summary: 'Shows dates.',
      stability: 'beta'
    },
    {
      name: 'Table',
      slug: 'table',
      package: '@urbicon-ui/table',
      group: 'primitives',
      description: 'Table description.',
      summary: 'Shows rows.'
    }
  ]
};

function baseConfig(overrides: Partial<LlmsAssemblerConfig> = {}): LlmsAssemblerConfig {
  return {
    templatePath,
    catalogPath,
    siteUrl: 'https://ui.urbicon.de',
    outputPaths: [outputPath],
    scopes: [
      { label: 'Blocks', urlSegment: 'blocks' },
      { label: 'Table', urlSegment: 'table' },
      { label: 'Auth', urlSegment: 'auth' },
      { label: 'Docs', urlSegment: 'docs' }
    ],
    packages: [
      {
        label: 'Blocks',
        urlSegment: 'blocks',
        packageId: '@urbicon-ui/blocks',
        staticDir: '/repo/apps/docs/static/blocks'
      },
      {
        label: 'Table',
        urlSegment: 'table',
        packageId: '@urbicon-ui/table',
        staticDir: '/repo/apps/docs/static/table'
      }
    ],
    ...overrides
  };
}

function mockGlob(): void {
  vi.mocked(glob).mockImplementation(async (pattern: unknown) => {
    const p = String(pattern);
    if (p.includes('/apps/docs/static/blocks/')) {
      return [
        '/repo/apps/docs/static/blocks/primitives/button/llm.txt',
        '/repo/apps/docs/static/blocks/primitives/accordion/llm.txt',
        '/repo/apps/docs/static/blocks/components/calendar/llm.txt'
      ];
    }
    if (p.includes('/apps/docs/static/table/')) {
      // No group segment on disk — see the CATALOG comment above.
      return ['/repo/apps/docs/static/table/table/llm.txt'];
    }
    return [];
  });
}

function mockFs(catalog: unknown = CATALOG): void {
  vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
    const p = filePath.toString();
    if (p === templatePath) return TEMPLATE;
    if (p === catalogPath) return JSON.stringify(catalog);
    throw new Error(`Unexpected read: ${p}`);
  });
  vi.mocked(fs.mkdir).mockResolvedValue(undefined);
  vi.mocked(fs.writeFile).mockResolvedValue(undefined);
}

describe('LlmsAssembler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders one line per component, grouped by package and family, alphabetically within each group', async () => {
    mockFs();
    mockGlob();
    const assembler = new LlmsAssembler(baseConfig());

    const { content, count } = await assembler.render();

    expect(count).toBe(4);
    expect(content).toContain('## Blocks — Primitives');
    expect(content).toContain('## Blocks — Components');
    // Table has only one group among its entries — no "— Family" suffix.
    expect(content).toContain('## Table\n');
    expect(content).not.toContain('## Table — Primitives');

    expect(content).toContain(
      '- [Accordion](https://ui.urbicon.de/blocks/primitives/accordion/llm.txt): Collapses things.'
    );
    expect(content).toContain(
      '- [Button](https://ui.urbicon.de/blocks/primitives/button/llm.txt): Clicks things.'
    );
    // Alphabetical within the group: Accordion before Button.
    expect(content.indexOf('Accordion')).toBeLessThan(content.indexOf('[Button]'));
    // Non-stable entries carry their stability level.
    expect(content).toContain(
      '- [Calendar](https://ui.urbicon.de/blocks/components/calendar/llm.txt): Shows dates. (beta)'
    );
  });

  it("resolves the href from the static filesystem tree, not the catalog's own (possibly-defaulted) group field", async () => {
    mockFs();
    mockGlob();
    const assembler = new LlmsAssembler(baseConfig());

    const { content } = await assembler.render();

    // The fixture's Table entry says group: 'primitives', which would produce
    // `.../table/primitives/table/llm.txt` if trusted — but the glob result
    // (what's really on disk) has no group segment.
    expect(content).toContain('- [Table](https://ui.urbicon.de/table/table/llm.txt): Shows rows.');
    expect(content).not.toContain('table/primitives/table/llm.txt');
  });

  it('renders the Resources section from siteUrl and the configured scopes', async () => {
    mockFs();
    mockGlob();
    const assembler = new LlmsAssembler(baseConfig());

    const { content } = await assembler.render();

    expect(content).toContain('- [Documentation site](https://ui.urbicon.de):');
    expect(content).toContain('- [Full API Reference](https://ui.urbicon.de/llms-full.txt):');
    expect(content).toContain('- [AI-native tooling](https://ui.urbicon.de/ai):');
    expect(content).toContain('- [Blocks — llms.txt](https://ui.urbicon.de/blocks/llms.txt):');
    expect(content).toContain('- [Table — llms.txt](https://ui.urbicon.de/table/llms.txt):');
    expect(content).toContain('- [Auth — llms.txt](https://ui.urbicon.de/auth/llms.txt):');
    expect(content).toContain('- [Docs — llms.txt](https://ui.urbicon.de/docs/llms.txt):');
  });

  it('preserves the hand-written template preamble verbatim', async () => {
    mockFs();
    mockGlob();
    const assembler = new LlmsAssembler(baseConfig());

    const { content } = await assembler.render();

    expect(content).toMatch(/^# Urbicon UI/);
    expect(content).toContain('> Summary paragraph.');
    expect(content).toContain('bun add @urbicon-ui/blocks');
    expect(content).not.toContain('{{RESOURCES}}');
    expect(content).not.toContain('{{COMPONENTS}}');
  });

  it('renders identical content across repeated calls (stable ordering, no timestamps)', async () => {
    mockFs();
    mockGlob();
    const assembler = new LlmsAssembler(baseConfig());

    const first = await assembler.render();
    const second = await assembler.render();

    expect(second.content).toBe(first.content);
    expect(second.count).toBe(first.count);
  });

  it('assemble() writes the rendered content to every configured output path', async () => {
    mockFs();
    mockGlob();
    const assembler = new LlmsAssembler(
      baseConfig({ outputPaths: ['/repo/llms.txt', '/repo/apps/docs/static/llms.txt'] })
    );

    const result = await assembler.assemble();

    expect(result.componentCount).toBe(4);
    expect(fs.writeFile).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fs.writeFile).mock.calls[0][0]).toBe('/repo/llms.txt');
    expect(vi.mocked(fs.writeFile).mock.calls[1][0]).toBe('/repo/apps/docs/static/llms.txt');
    expect(vi.mocked(fs.writeFile).mock.calls[0][1]).toBe(vi.mocked(fs.writeFile).mock.calls[1][1]);
  });

  it('throws when a configured package has no catalog entries', async () => {
    mockFs({ components: [] });
    mockGlob();
    const assembler = new LlmsAssembler(baseConfig());

    await expect(assembler.render()).rejects.toThrow(
      'no catalog entries found for package "@urbicon-ui/blocks"'
    );
  });

  it('throws when a catalog entry has no matching llm.txt on disk', async () => {
    mockFs();
    vi.mocked(glob).mockResolvedValue([]); // nothing found for either package
    const assembler = new LlmsAssembler(baseConfig());

    await expect(assembler.render()).rejects.toThrow(/no llm\.txt on disk for "Accordion"/);
  });

  it('throws when a catalog entry has no @summary', async () => {
    mockFs({
      components: [
        {
          name: 'Button',
          slug: 'button',
          package: '@urbicon-ui/blocks',
          group: 'primitives',
          description: 'Button description.'
          // no summary
        },
        CATALOG.components[3] // Table, so the table package still has an entry
      ]
    });
    mockGlob();
    const assembler = new LlmsAssembler(baseConfig());

    await expect(assembler.render()).rejects.toThrow('"Button" has no @summary');
  });

  it('throws when the template is missing', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
    const assembler = new LlmsAssembler(baseConfig());

    await expect(assembler.render()).rejects.toThrow('Template not found');
  });

  it('throws when the component catalog is missing', async () => {
    vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
      const p = filePath.toString();
      if (p === templatePath) return TEMPLATE;
      throw new Error('ENOENT');
    });
    mockGlob();
    const assembler = new LlmsAssembler(baseConfig());

    await expect(assembler.render()).rejects.toThrow('Component catalog not found');
  });

  it('throws when the template lost the {{RESOURCES}} placeholder', async () => {
    vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
      const p = filePath.toString();
      if (p === templatePath) return TEMPLATE.replace('{{RESOURCES}}', '');
      if (p === catalogPath) return JSON.stringify(CATALOG);
      throw new Error(`Unexpected read: ${p}`);
    });
    mockGlob();
    const assembler = new LlmsAssembler(baseConfig());

    await expect(assembler.render()).rejects.toThrow('missing the {{RESOURCES}}');
  });

  it('throws when the template lost the {{COMPONENTS}} placeholder', async () => {
    vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
      const p = filePath.toString();
      if (p === templatePath) return TEMPLATE.replace('{{COMPONENTS}}', '');
      if (p === catalogPath) return JSON.stringify(CATALOG);
      throw new Error(`Unexpected read: ${p}`);
    });
    mockGlob();
    const assembler = new LlmsAssembler(baseConfig());

    await expect(assembler.render()).rejects.toThrow('missing the {{COMPONENTS}}');
  });
});

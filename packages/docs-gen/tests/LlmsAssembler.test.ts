import * as fs from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LlmsAssemblerConfig } from '../src/generators/llm/LlmsAssembler';
import { LlmsAssembler } from '../src/generators/llm/LlmsAssembler';

vi.mock('fs/promises');

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
 * Table's entry has no group segment in `llmTxtPath` even though its `group`
 * display field says `'primitives'` — the real shape `MCPCatalogGenerator`
 * emits once `llmTxtPath` is derived from the raw, undefaulted `group`
 * (matching where `LLMDocumentationGenerator`'s write loop actually put the
 * file: `apps/docs/static/table/table/llm.txt`, not `.../table/primitives/
 * table/llm.txt`). Kept as a fixture so this case stays covered through the
 * catalog path now that the assembler no longer touches the filesystem.
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
      stability: 'stable',
      llmTxtPath: 'primitives/button/llm.txt'
    },
    {
      name: 'Accordion',
      slug: 'accordion',
      package: '@urbicon-ui/blocks',
      group: 'primitives',
      description: 'Accordion description.',
      summary: 'Collapses things.',
      llmTxtPath: 'primitives/accordion/llm.txt'
    },
    {
      name: 'Calendar',
      slug: 'calendar',
      package: '@urbicon-ui/blocks',
      group: 'components',
      description: 'Calendar description.',
      summary: 'Shows dates.',
      stability: 'beta',
      llmTxtPath: 'components/calendar/llm.txt'
    },
    {
      name: 'Table',
      slug: 'table',
      package: '@urbicon-ui/table',
      group: 'primitives',
      description: 'Table description.',
      summary: 'Shows rows.',
      llmTxtPath: 'table/llm.txt'
    },
    {
      name: 'LoginPage',
      slug: 'login-page',
      package: '@urbicon-ui/auth',
      group: 'components',
      description: 'LoginPage description.',
      summary: 'Signs a user in.',
      llmTxtPath: 'components/login-page/llm.txt'
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
    // Same order as CLI.ts's LLMS_PACKAGES — the package-order assertions below
    // pin that a config reordering here would be a content change.
    packages: [
      { label: 'Blocks', urlSegment: 'blocks', packageId: '@urbicon-ui/blocks' },
      { label: 'Table', urlSegment: 'table', packageId: '@urbicon-ui/table' },
      { label: 'Auth', urlSegment: 'auth', packageId: '@urbicon-ui/auth' }
    ],
    ...overrides
  };
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

  it('renders one line per component, grouped by package and family, in a fixed order', async () => {
    mockFs();
    const assembler = new LlmsAssembler(baseConfig());

    const { content, count } = await assembler.render();

    expect(count).toBe(5);
    expect(content).toContain('## Blocks — Primitives');
    expect(content).toContain('## Blocks — Components');
    // Table and Auth each have only one group among their entries — no
    // "— Family" suffix.
    expect(content).toContain('## Table\n');
    expect(content).toContain('## Auth\n');
    expect(content).not.toContain('## Table — Primitives');
    expect(content).not.toContain('## Auth — Components');

    expect(content).toContain(
      '- [Accordion](https://ui.urbicon.de/blocks/primitives/accordion/llm.txt): Collapses things.'
    );
    expect(content).toContain(
      '- [Button](https://ui.urbicon.de/blocks/primitives/button/llm.txt): Clicks things.'
    );
    // Alphabetical (plain, not locale-aware) within the group: Accordion before Button.
    expect(content.indexOf('Accordion')).toBeLessThan(content.indexOf('[Button]'));
    // Non-stable entries carry their stability level.
    expect(content).toContain(
      '- [Calendar](https://ui.urbicon.de/blocks/components/calendar/llm.txt): Shows dates. (beta)'
    );

    // Group order within a package: primitives before components.
    expect(content.indexOf('## Blocks — Primitives')).toBeLessThan(
      content.indexOf('## Blocks — Components')
    );
    // Package order: Blocks, then Table, then Auth (config order, not catalog order).
    const blocksIndex = content.indexOf('## Blocks — Primitives');
    const tableIndex = content.indexOf('## Table');
    const authIndex = content.indexOf('## Auth');
    expect(blocksIndex).toBeLessThan(tableIndex);
    expect(tableIndex).toBeLessThan(authIndex);
  });

  it("builds each href from the catalog's llmTxtPath, including an entry with no group segment", async () => {
    mockFs();
    const assembler = new LlmsAssembler(baseConfig());

    const { content } = await assembler.render();

    // Table's llmTxtPath ('table/llm.txt') carries no group segment even
    // though its display `group` field says 'primitives' — see the CATALOG
    // comment above. The href must follow llmTxtPath exactly.
    expect(content).toContain('- [Table](https://ui.urbicon.de/table/table/llm.txt): Shows rows.');
    expect(content).not.toContain('table/primitives/table/llm.txt');
    expect(content).toContain(
      '- [LoginPage](https://ui.urbicon.de/auth/components/login-page/llm.txt): Signs a user in.'
    );
  });

  it('renders the Resources section from siteUrl and the configured scopes', async () => {
    mockFs();
    const assembler = new LlmsAssembler(baseConfig());

    const { content } = await assembler.render();

    expect(content).toContain('- [Documentation site](https://ui.urbicon.de):');
    expect(content).toContain('- [Full API Reference](https://ui.urbicon.de/llms-full.txt):');
    expect(content).toContain('- [AI-native tooling](https://ui.urbicon.de/ai):');
    expect(content).toContain('- [Customization](https://ui.urbicon.de/customization):');
    expect(content).toContain('- [Blocks — llms.txt](https://ui.urbicon.de/blocks/llms.txt):');
    expect(content).toContain('- [Table — llms.txt](https://ui.urbicon.de/table/llms.txt):');
    expect(content).toContain('- [Auth — llms.txt](https://ui.urbicon.de/auth/llms.txt):');
    expect(content).toContain('- [Docs — llms.txt](https://ui.urbicon.de/docs/llms.txt):');
  });

  it('preserves the hand-written template preamble verbatim', async () => {
    mockFs();
    const assembler = new LlmsAssembler(baseConfig());

    const { content } = await assembler.render();

    expect(content).toMatch(/^# Urbicon UI/);
    expect(content).toContain('> Summary paragraph.');
    expect(content).toContain('bun add @urbicon-ui/blocks');
    expect(content).not.toContain('{{RESOURCES}}');
    expect(content).not.toContain('{{COMPONENTS}}');
  });

  it('renders identical content across repeated calls from the same catalog (stable ordering, no timestamps)', async () => {
    mockFs();
    const assembler = new LlmsAssembler(baseConfig());

    const first = await assembler.render();
    const second = await assembler.render();

    expect(second.content).toBe(first.content);
    expect(second.count).toBe(first.count);
  });

  it('assemble() writes the rendered content to every configured output path', async () => {
    mockFs();
    const assembler = new LlmsAssembler(
      baseConfig({ outputPaths: ['/repo/llms.txt', '/repo/apps/docs/static/llms.txt'] })
    );

    const result = await assembler.assemble();

    expect(result.componentCount).toBe(5);
    expect(fs.writeFile).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fs.writeFile).mock.calls[0][0]).toBe('/repo/llms.txt');
    expect(vi.mocked(fs.writeFile).mock.calls[1][0]).toBe('/repo/apps/docs/static/llms.txt');
    expect(vi.mocked(fs.writeFile).mock.calls[0][1]).toBe(vi.mocked(fs.writeFile).mock.calls[1][1]);
  });

  it('throws when a configured package has no catalog entries', async () => {
    mockFs({ components: [] });
    const assembler = new LlmsAssembler(baseConfig());

    await expect(assembler.render()).rejects.toThrow(
      'no catalog entries found for package "@urbicon-ui/blocks"'
    );
  });

  it('throws when a catalog entry has no llmTxtPath', async () => {
    mockFs({
      components: [
        {
          name: 'Button',
          slug: 'button',
          package: '@urbicon-ui/blocks',
          group: 'primitives',
          description: 'Button description.',
          summary: 'Clicks things.'
          // no llmTxtPath
        },
        CATALOG.components.find((c) => c.name === 'Table'),
        CATALOG.components.find((c) => c.name === 'LoginPage')
      ]
    });
    const assembler = new LlmsAssembler(baseConfig());

    await expect(assembler.render()).rejects.toThrow('"Button" has no llmTxtPath');
  });

  it('throws when a catalog entry has no @summary', async () => {
    mockFs({
      components: [
        {
          name: 'Button',
          slug: 'button',
          package: '@urbicon-ui/blocks',
          group: 'primitives',
          description: 'Button description.',
          llmTxtPath: 'primitives/button/llm.txt'
          // no summary
        },
        CATALOG.components.find((c) => c.name === 'Table'),
        CATALOG.components.find((c) => c.name === 'LoginPage')
      ]
    });
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
    const assembler = new LlmsAssembler(baseConfig());

    await expect(assembler.render()).rejects.toThrow('missing the {{COMPONENTS}}');
  });
});

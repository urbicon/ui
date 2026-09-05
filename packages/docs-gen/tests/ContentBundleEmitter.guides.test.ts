import * as fs from 'node:fs/promises';
import { OVERRIDE_CASCADE } from '@urbicon-ui/design-engine/reference';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentBundleEmitter } from '../src/generators/content/ContentBundleEmitter';
import { TEMPLATE_PLACEHOLDER_PATTERN } from '../src/generators/llm/guide-injection';

vi.mock('fs/promises');
vi.mock('glob', () => ({
  glob: vi.fn()
}));

const { glob } = await import('glob');

const TEMPLATE = `# Reference

## Components

{{COMPONENTS}}

## Auth Reference

{{GUIDE:auth}}

## Customization

{{OVERRIDE_CASCADE}}
`;

const ICON_REGISTRY = `
export const DEFAULT_ICONS = {
} as const;

export const ICON_METADATA = {
} as const;
`;

describe('ContentBundleEmitter package guides', () => {
  const config = {
    staticDir: '/repo/apps/docs/static',
    designSystemDir: '/repo/design-system',
    templatePath: '/repo/packages/docs-gen/templates/llms-full-template.md',
    iconRegistryPath: '/repo/packages/blocks/src/lib/icons/icon-registry.ts',
    verbsDir: '/repo/packages/design/skill/verbs',
    outputDir: '/repo/packages/design-content/content'
  };

  const guide = {
    slug: 'auth',
    title: 'Auth Reference',
    description: 'The auth reference',
    sourcePath: '/repo/packages/auth/docs/AUTH.md'
  };

  /** Wire the happy-path fs mocks; individual tests override single paths. */
  function mockFs(overrides: Record<string, string | Error> = {}): void {
    const files: Record<string, string> = {
      '/repo/apps/docs/static/mcp/component-catalog.json': '{"components":[]}',
      [config.templatePath]: TEMPLATE,
      '/repo/design-system/principles.md': '# Principles',
      [config.iconRegistryPath]: ICON_REGISTRY,
      '/repo/packages/auth/docs/AUTH.md':
        '# @urbicon-ui/auth\n\n## Architecture\n\nprose\n\n<!-- typecheck -->\n```ts\nexport const a = 1;\n```\n',
      '/repo/packages/design-content/package.json': '{"version":"6.28.0"}'
    };
    vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
      const p = filePath.toString();
      const override = overrides[p];
      if (override instanceof Error) throw override;
      if (typeof override === 'string') return override;
      if (files[p] !== undefined) return files[p];
      throw new Error(`ENOENT: ${p}`);
    });
    vi.mocked(fs.readdir).mockImplementation(async (dir) => {
      const d = dir.toString();
      if (d.endsWith('verbs')) return ['compose.md'] as never;
      if (d.endsWith('patterns')) return [] as never;
      return [] as never;
    });
    vi.mocked(fs.rm).mockResolvedValue(undefined);
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.copyFile).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(glob).mockResolvedValue([]);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function writtenFile(suffix: string): string | undefined {
    const call = vi.mocked(fs.writeFile).mock.calls.find(([p]) => p.toString().endsWith(suffix));
    return call?.[1] as string | undefined;
  }

  it('copies each guide to guides/<slug>.md and writes the index', async () => {
    mockFs();
    const emitter = new ContentBundleEmitter({ ...config, packageGuides: [guide] });

    const result = await emitter.emit();

    expect(result.guideCount).toBe(1);
    // verbatim source (title, hierarchy) minus the lint's typecheck marker lines
    expect(writtenFile('guides/auth.md')).toBe(
      '# @urbicon-ui/auth\n\n## Architecture\n\nprose\n\n```ts\nexport const a = 1;\n```\n'
    );
    const index = JSON.parse(writtenFile('guides/index.json') ?? '[]');
    expect(index).toEqual([
      { slug: 'auth', title: 'Auth Reference', description: 'The auth reference' }
    ]);
  });

  it('replaces the template placeholder with a pointer to the bundled guide', async () => {
    mockFs();
    const emitter = new ContentBundleEmitter({ ...config, packageGuides: [guide] });

    await emitter.emit();

    const template = writtenFile('guides/llms-full-template.md');
    expect(template).not.toContain('{{GUIDE:auth}}');
    expect(template).toContain('guides/auth.md');
  });

  it('fails loud when a guide source is missing', async () => {
    mockFs({ '/repo/packages/auth/docs/AUTH.md': new Error('ENOENT') });
    const emitter = new ContentBundleEmitter({ ...config, packageGuides: [guide] });

    await expect(emitter.emit()).rejects.toThrow('package guide "Auth Reference"');
  });

  it('fails loud when the template references an unconfigured guide', async () => {
    mockFs();
    const emitter = new ContentBundleEmitter({ ...config, packageGuides: [] });

    await expect(emitter.emit()).rejects.toThrow('unconfigured guide "auth"');
  });

  it('substitutes the cascade sentence into the bundled template copy', async () => {
    mockFs();
    const emitter = new ContentBundleEmitter({ ...config, packageGuides: [guide] });

    await emitter.emit();

    // The MCP guide resources slice this copy, so it has to carry the sentence
    // itself — the engine's constant, not a paraphrase — and no placeholder shape
    // but `{{COMPONENTS}}`, which the bundle copy keeps by design.
    const template = writtenFile('guides/llms-full-template.md') ?? '';
    expect(template).toContain(OVERRIDE_CASCADE);
    expect(template).toContain('{{COMPONENTS}}');
    expect(template.replace('{{COMPONENTS}}', '')).not.toMatch(TEMPLATE_PLACEHOLDER_PATTERN);
  });

  it('fails on a misspelled placeholder instead of shipping it literally', async () => {
    mockFs({ [config.templatePath]: `${TEMPLATE}\n{{OVERRIDE_CASCADES}}\n` });
    const emitter = new ContentBundleEmitter({ ...config, packageGuides: [guide] });

    await expect(emitter.emit()).rejects.toThrow('{{OVERRIDE_CASCADES}}');
  });

  it('fails loud when the template lost the cascade placeholder', async () => {
    mockFs({ [config.templatePath]: TEMPLATE.replace('{{OVERRIDE_CASCADE}}', '') });
    const emitter = new ContentBundleEmitter({ ...config, packageGuides: [guide] });

    await expect(emitter.emit()).rejects.toThrow('missing the {{OVERRIDE_CASCADE}}');
  });

  it('rejects an invalid guide slug', async () => {
    // Guide-placeholder-free template so the slug check is what trips, not the
    // unconfigured-placeholder sweep.
    mockFs({ [config.templatePath]: '# Reference\n\n{{OVERRIDE_CASCADE}}\n' });
    const emitter = new ContentBundleEmitter({
      ...config,
      packageGuides: [{ ...guide, slug: '../escape' }]
    });

    await expect(emitter.emit()).rejects.toThrow('invalid');
  });
});

import * as fs from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentBundleEmitter } from '../src/generators/content/ContentBundleEmitter';

vi.mock('fs/promises');
vi.mock('glob', () => ({ glob: vi.fn() }));

const { glob } = await import('glob');

const ICON_REGISTRY = `
export const DEFAULT_ICONS = {
} as const;

export const ICON_METADATA = {
} as const;
`;

const config = {
  staticDir: '/repo/apps/docs/static',
  designSystemDir: '/repo/design-system',
  templatePath: '/repo/packages/docs-gen/templates/llms-full-template.md',
  iconRegistryPath: '/repo/packages/blocks/src/lib/icons/icon-registry.ts',
  verbsDir: '/repo/packages/design/skill/verbs',
  outputDir: '/repo/packages/design-content/content',
  packageGuides: []
};

/**
 * A virtual bundle directory: writes and copies are recorded, and the fingerprint
 * pass reads them back — which is the only way this gate can see what actually
 * reaches the bundle rather than what the emitter meant to put there.
 */
function mockFs(files: Record<string, string>): Map<string, string> {
  const written = new Map<string, string>();

  vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
    const p = filePath.toString();
    if (written.has(p)) return written.get(p) as string;
    if (files[p] !== undefined) return files[p];
    throw new Error(`ENOENT: ${p}`);
  });
  vi.mocked(fs.readdir).mockImplementation(async (dir) => {
    const d = dir.toString();
    if (d.endsWith('verbs')) return ['compose.md'] as never;
    if (d.endsWith('patterns')) return ['zoned-list.md'] as never;
    return [] as never;
  });
  vi.mocked(fs.rm).mockResolvedValue(undefined);
  vi.mocked(fs.mkdir).mockResolvedValue(undefined);
  vi.mocked(fs.writeFile).mockImplementation(async (filePath, data) => {
    written.set(filePath.toString(), String(data));
  });
  vi.mocked(fs.copyFile).mockImplementation(async (src, dest) => {
    written.set(dest.toString(), files[src.toString()] ?? '');
  });
  vi.mocked(glob).mockImplementation((async (_pattern: string, options: { cwd?: string }) => {
    if (options?.cwd !== config.outputDir) return [];
    return [...written.keys()].map((p) => p.slice(config.outputDir.length + 1));
  }) as never);

  return written;
}

function sources(pattern: string, generated = '2026-01-01T00:00:00.000Z') {
  return {
    '/repo/apps/docs/static/mcp/component-catalog.json': `{"generated":"${generated}","components":[]}`,
    [config.templatePath]:
      '# Reference\n\n## Components\n\n{{COMPONENTS}}\n\n## Tokens\n\n{{SEMANTIC_TOKENS}}\n\n## Customization\n\n{{OVERRIDE_CASCADE}}\n',
    '/repo/design-system/principles.md': '# Principles',
    '/repo/design-system/patterns/zoned-list.md': pattern,
    '/repo/packages/design/skill/verbs/compose.md': '# compose',
    [config.iconRegistryPath]: ICON_REGISTRY,
    '/repo/packages/design-content/package.json': '{"version":"8.20.0"}'
  };
}

async function hashOf(tree: Record<string, string>): Promise<string> {
  mockFs(tree);
  return (await new ContentBundleEmitter(config).emit()).contentHash;
}

describe('ContentBundleEmitter fingerprint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('moves when a pattern changes — not only when the catalog does', async () => {
    const before = await hashOf(sources('# Zoned List\n\nA screen of labelled zones.\n'));
    const after = await hashOf(
      sources('# Zoned List\n\nA screen of labelled zones, each a list.\n')
    );

    expect(after).not.toBe(before);
  });

  it('is reproducible across runs of an unchanged tree', async () => {
    const first = await hashOf(sources('# Zoned List\n'));
    const second = await hashOf(sources('# Zoned List\n'));

    expect(second).toBe(first);
  });

  it("ignores the catalog's wall-clock stamp", async () => {
    const early = await hashOf(sources('# Zoned List\n', '2026-01-01T00:00:00.000Z'));
    const late = await hashOf(sources('# Zoned List\n', '2026-09-09T12:00:00.000Z'));

    expect(late).toBe(early);
  });
});

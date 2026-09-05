import * as fs from 'node:fs/promises';
import { OVERRIDE_CASCADE, SEMANTIC_TOKENS } from '@urbicon-ui/design-engine/reference';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TEMPLATE_PLACEHOLDER_PATTERN } from '../src/generators/llm/guide-injection';
import { LlmsFullAssembler } from '../src/generators/llm/LlmsFullAssembler';

vi.mock('fs/promises');
vi.mock('glob', () => ({
  glob: vi.fn()
}));

const { glob } = await import('glob');

const TEMPLATE = `# Urbicon UI – Full API Reference

## Components

{{COMPONENTS}}

---

## Design Tokens
Semantic tokens only.

{{SEMANTIC_TOKENS}}

## Customization
Merge order: {{OVERRIDE_CASCADE}}
`;

const COMPONENT_A = `---

## Alert
Alert component

**Import:** \`import { Alert } from '@urbicon-ui/blocks';\`

### Api
| Prop | Type |
|------|------|
| intent | string |`;

const COMPONENT_B = `---

## Button
Button component

**Import:** \`import { Button } from '@urbicon-ui/blocks';\`

### Api
| Prop | Type |
|------|------|
| variant | string |`;

describe('LlmsFullAssembler', () => {
  const templatePath = '/repo/packages/docs-gen/templates/llms-full-template.md';
  const staticDirs = ['/repo/apps/docs/static/blocks'];
  const outputPaths = ['/repo/llms-full.txt', '/repo/apps/docs/static/llms-full.txt'];

  let assembler: LlmsFullAssembler;

  beforeEach(() => {
    vi.clearAllMocks();
    assembler = new LlmsFullAssembler({ templatePath, staticDirs, outputPaths });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('replaces {{COMPONENTS}} placeholder with component content', async () => {
    vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
      const p = filePath.toString();
      if (p === templatePath) return TEMPLATE;
      if (p.includes('Alert')) return COMPONENT_A;
      if (p.includes('Button')) return COMPONENT_B;
      throw new Error(`Unexpected read: ${p}`);
    });

    vi.mocked(glob).mockResolvedValue([
      '/repo/apps/docs/static/blocks/Alert/llm.txt',
      '/repo/apps/docs/static/blocks/Button/llm.txt'
    ]);

    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const result = await assembler.assemble();

    expect(result.componentCount).toBe(2);
    expect(result.outputPaths).toEqual(outputPaths);

    const writtenContent = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
    expect(writtenContent).toContain('## Alert');
    expect(writtenContent).toContain('## Button');
    expect(writtenContent).not.toContain('{{COMPONENTS}}');
    expect(writtenContent).toContain('## Design Tokens');
  });

  it('writes to all configured output paths', async () => {
    vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
      const p = filePath.toString();
      if (p === templatePath) return TEMPLATE;
      if (p.includes('llm.txt')) return COMPONENT_A;
      throw new Error(`Unexpected read: ${p}`);
    });

    vi.mocked(glob).mockResolvedValue(['/repo/apps/docs/static/blocks/Alert/llm.txt']);
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    await assembler.assemble();

    expect(fs.writeFile).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fs.writeFile).mock.calls[0][0]).toBe(outputPaths[0]);
    expect(vi.mocked(fs.writeFile).mock.calls[1][0]).toBe(outputPaths[1]);
  });

  it('sorts components alphabetically by directory name', async () => {
    vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
      const p = filePath.toString();
      if (p === templatePath) return TEMPLATE;
      if (p.includes('Button')) return COMPONENT_B;
      if (p.includes('Alert')) return COMPONENT_A;
      throw new Error(`Unexpected read: ${p}`);
    });

    vi.mocked(glob).mockResolvedValue([
      '/repo/apps/docs/static/blocks/Button/llm.txt',
      '/repo/apps/docs/static/blocks/Alert/llm.txt'
    ]);

    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    await assembler.assemble();

    const writtenContent = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
    const alertPos = writtenContent.indexOf('## Alert');
    const buttonPos = writtenContent.indexOf('## Button');
    expect(alertPos).toBeLessThan(buttonPos);
  });

  it('throws if template is missing', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

    await expect(assembler.assemble()).rejects.toThrow('Template not found');
  });

  it('handles empty static directories gracefully', async () => {
    vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
      if (filePath.toString() === templatePath) return TEMPLATE;
      throw new Error(`Unexpected read: ${filePath}`);
    });

    vi.mocked(glob).mockResolvedValue([]);
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const result = await assembler.assemble();

    expect(result.componentCount).toBe(0);
    const writtenContent = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
    expect(writtenContent).not.toContain('{{COMPONENTS}}');
    expect(writtenContent).toContain('## Design Tokens');
  });

  it('preserves template preamble and epilogue verbatim', async () => {
    vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
      if (filePath.toString() === templatePath) return TEMPLATE;
      if (filePath.toString().includes('llm.txt')) return COMPONENT_A;
      throw new Error(`Unexpected read`);
    });

    vi.mocked(glob).mockResolvedValue(['/repo/apps/docs/static/blocks/Alert/llm.txt']);
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    await assembler.assemble();

    const writtenContent = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
    expect(writtenContent).toMatch(/^# Urbicon UI – Full API Reference/);
    expect(writtenContent).toContain('Semantic tokens only.');
  });

  describe('guide injection', () => {
    const GUIDE_TEMPLATE = `# Reference

## Components

{{COMPONENTS}}

---

## Auth Reference

{{GUIDE:auth}}

{{OVERRIDE_CASCADE}}
{{SEMANTIC_TOKENS}}
`;
    const guideSourcePath = '/repo/packages/auth/docs/AUTH.md';
    // The $-before-backtick would corrupt output if replace() used a string
    // replacement ($\` substitutes the preceding text) — pin the replacer fn.
    const GUIDE_SOURCE =
      '# @urbicon-ui/auth\n\n## Architecture\n\ndetects the `$2b$` prefix\n\n### Runtime\n\nNode 20+\n\n<!-- typecheck -->\n```ts\nexport const a = 1;\n```';

    function mockFs(template: string, withGuideSource = true): void {
      vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
        const p = filePath.toString();
        if (p === templatePath) return template;
        if (p === guideSourcePath) {
          if (!withGuideSource) throw new Error('ENOENT');
          return GUIDE_SOURCE;
        }
        if (p.includes('llm.txt')) return COMPONENT_A;
        throw new Error(`Unexpected read: ${p}`);
      });
      vi.mocked(glob).mockResolvedValue(['/repo/apps/docs/static/blocks/Alert/llm.txt']);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    }

    const guides = [
      {
        slug: 'auth',
        title: 'Auth Reference',
        description: 'The auth reference',
        sourcePath: guideSourcePath
      }
    ];

    it('replaces {{GUIDE:slug}} with the demoted, title-stripped source', async () => {
      mockFs(GUIDE_TEMPLATE);
      const guideAssembler = new LlmsFullAssembler({
        templatePath,
        staticDirs,
        outputPaths,
        guides
      });

      await guideAssembler.assemble();

      const written = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
      expect(written).not.toContain('{{GUIDE:auth}}');
      expect(written).toContain('### Architecture');
      expect(written).toContain('#### Runtime');
      // Title dropped, hierarchy demoted under the template's `## Auth Reference`.
      expect(written).not.toContain('## @urbicon-ui/auth');
      // `$`-pattern content survives verbatim (no replace() substitution).
      expect(written).toContain('detects the `$2b$` prefix');
      // the lint's marker is a source-side instruction, not guide content
      expect(written).not.toContain('typecheck');
      expect(written).toContain('```ts\nexport const a = 1;\n```');
      expect(written.indexOf('## Components')).toBeLessThan(written.indexOf('### Architecture'));
    });

    it('throws when a configured guide has no placeholder in the template', async () => {
      mockFs(TEMPLATE); // template without {{GUIDE:auth}}
      const guideAssembler = new LlmsFullAssembler({
        templatePath,
        staticDirs,
        outputPaths,
        guides
      });

      await expect(guideAssembler.assemble()).rejects.toThrow('missing the {{GUIDE:auth}}');
    });

    it('throws when the guide source file is missing', async () => {
      mockFs(GUIDE_TEMPLATE, false);
      const guideAssembler = new LlmsFullAssembler({
        templatePath,
        staticDirs,
        outputPaths,
        guides
      });

      await expect(guideAssembler.assemble()).rejects.toThrow('Guide source not found');
    });

    it('throws when the template references an unconfigured guide', async () => {
      mockFs(GUIDE_TEMPLATE);
      const guideAssembler = new LlmsFullAssembler({ templatePath, staticDirs, outputPaths });

      await expect(guideAssembler.assemble()).rejects.toThrow('unconfigured guide "auth"');
    });
  });

  describe('override cascade', () => {
    function mockFs(template: string): void {
      vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
        const p = filePath.toString();
        if (p === templatePath) return template;
        if (p.includes('llm.txt')) return COMPONENT_A;
        throw new Error(`Unexpected read: ${p}`);
      });
      vi.mocked(glob).mockResolvedValue(['/repo/apps/docs/static/blocks/Alert/llm.txt']);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    }

    it('substitutes the engine sentence and leaves no placeholder-shaped token behind', async () => {
      mockFs(TEMPLATE);

      await assembler.assemble();

      const written = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
      // The sentence is the engine's constant — a paraphrase here would be the
      // hand copy this placeholder replaced.
      expect(written).toContain(`Merge order: ${OVERRIDE_CASCADE}`);
      expect(written).not.toMatch(TEMPLATE_PLACEHOLDER_PATTERN);
    });

    it('throws when the template lost the placeholder, rather than dropping the line', async () => {
      mockFs(TEMPLATE.replace('{{OVERRIDE_CASCADE}}', ''));

      await expect(assembler.assemble()).rejects.toThrow('missing the {{OVERRIDE_CASCADE}}');
    });

    it('fails on a misspelled placeholder instead of shipping it literally', async () => {
      mockFs(`${TEMPLATE}\n{{OVERRIDE_CASCADES}}\n`);

      await expect(assembler.assemble()).rejects.toThrow('{{OVERRIDE_CASCADES}}');
    });
  });

  describe('semantic tokens', () => {
    function mockFs(template: string): void {
      vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
        const p = filePath.toString();
        if (p === templatePath) return template;
        if (p.includes('llm.txt')) return COMPONENT_A;
        throw new Error(`Unexpected read: ${p}`);
      });
      vi.mocked(glob).mockResolvedValue(['/repo/apps/docs/static/blocks/Alert/llm.txt']);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    }

    it('renders the surface and text utilities from the engine data', async () => {
      mockFs(TEMPLATE);

      await assembler.assemble();

      const written = vi.mocked(fs.writeFile).mock.calls[0][1] as string;
      // Every token the data carries, with the role the CSS states — the hand
      // list this placeholder replaced omitted two and misdescribed a third.
      for (const token of SEMANTIC_TOKENS.families.surface) {
        expect(written).toContain(`bg-${token.name}`);
        expect(written).toContain(`/* ${token.role} */`);
      }
      for (const token of SEMANTIC_TOKENS.families.text) {
        expect(written).toContain(`text-${token.name}`);
      }
      expect(written).not.toMatch(TEMPLATE_PLACEHOLDER_PATTERN);
    });

    it('throws when the template lost the placeholder, rather than dropping the list', async () => {
      mockFs(TEMPLATE.replace('{{SEMANTIC_TOKENS}}', ''));

      await expect(assembler.assemble()).rejects.toThrow('missing the {{SEMANTIC_TOKENS}}');
    });
  });

  it('scans multiple static directories', async () => {
    const multiAssembler = new LlmsFullAssembler({
      templatePath,
      staticDirs: ['/repo/apps/docs/static/blocks', '/repo/apps/docs/static/table'],
      outputPaths
    });

    vi.mocked(fs.readFile).mockImplementation(async (filePath) => {
      const p = filePath.toString();
      if (p === templatePath) return TEMPLATE;
      if (p.includes('Alert')) return COMPONENT_A;
      if (p.includes('DataTable')) return '---\n\n## DataTable\nTable component';
      throw new Error(`Unexpected read: ${p}`);
    });

    vi.mocked(glob)
      .mockResolvedValueOnce(['/repo/apps/docs/static/blocks/Alert/llm.txt'])
      .mockResolvedValueOnce(['/repo/apps/docs/static/table/DataTable/llm.txt']);

    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    const result = await multiAssembler.assemble();

    expect(result.componentCount).toBe(2);
    expect(glob).toHaveBeenCalledTimes(2);
  });
});

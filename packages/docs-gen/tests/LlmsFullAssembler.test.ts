import * as fs from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

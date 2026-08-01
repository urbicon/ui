import { describe, expect, it } from 'vitest';
import { addBlocksImport, BLOCKS_IMPORT } from './stylesheet.js';

describe('addBlocksImport', () => {
  it('inserts directly after the tailwind import', () => {
    const out = addBlocksImport("@import 'tailwindcss';\n\nbody {\n\tcolor: red;\n}\n");
    expect(out.split('\n').slice(0, 2)).toEqual(["@import 'tailwindcss';", BLOCKS_IMPORT]);
    expect(out).toContain('body {');
  });

  it('handles double-quoted and subpath tailwind imports, after the LAST one', () => {
    const out = addBlocksImport('@import "tailwindcss/theme";\n@import "tailwindcss/utilities";\n');
    const lines = out.split('\n');
    expect(lines[2]).toBe(BLOCKS_IMPORT);
  });

  it('is idempotent — a present import is left alone, whatever its quoting', () => {
    const content = `@import 'tailwindcss';\n${BLOCKS_IMPORT}\n`;
    expect(addBlocksImport(content)).toBe(content);
    const doubleQuoted = '@import "tailwindcss";\n@import "@urbicon-ui/blocks/style/index.css";\n';
    expect(addBlocksImport(doubleQuoted)).toBe(doubleQuoted);
  });

  it('falls back to after the last @import of any kind', () => {
    const out = addBlocksImport("@import './fonts.css';\n\nh1 {\n\tfont-weight: 700;\n}\n");
    expect(out.split('\n')[1]).toBe(BLOCKS_IMPORT);
  });

  it('prepends when the stylesheet has no imports (CSS wants imports first)', () => {
    const out = addBlocksImport('body {\n\tmargin: 0;\n}\n');
    expect(out.startsWith(`${BLOCKS_IMPORT}\n`)).toBe(true);
    expect(out).toContain('margin: 0;');
  });

  it('handles a missing/empty stylesheet — sv.file creates it', () => {
    expect(addBlocksImport('')).toBe(`${BLOCKS_IMPORT}\n`);
  });

  it('never anchors on a tailwind import inside a comment', () => {
    // Single-line and multi-line comment forms: anchoring inside either would
    // insert a commented-out import — unstyled components with no error.
    const single = addBlocksImport("/* @import 'tailwindcss'; */\nbody {\n\tmargin: 0;\n}\n");
    expect(single.split('\n')[0]).toBe(BLOCKS_IMPORT);

    const multi = addBlocksImport("/*\n@import 'tailwindcss';\nnot real\n*/\nbody {\n}\n");
    expect(multi.split('\n')[0]).toBe(BLOCKS_IMPORT);
    // The comment body is untouched — nothing was inserted into it.
    expect(multi).toContain("/*\n@import 'tailwindcss';\nnot real\n*/");
  });

  it('anchors on the real import when a commented-out one precedes it', () => {
    const out = addBlocksImport(
      "/*\n@import 'tailwindcss';\n*/\n@import 'tailwindcss';\nbody {\n}\n"
    );
    const lines = out.split('\n');
    expect(lines[4]).toBe(BLOCKS_IMPORT); // after the real import on line index 3
  });

  it('a mere MENTION of the blocks path does not disable the add-on', () => {
    const out = addBlocksImport(
      "@import 'tailwindcss';\n/* uses @urbicon-ui/blocks/style/index.css */\n"
    );
    expect(out.split('\n')[1]).toBe(BLOCKS_IMPORT);
  });

  it('inserts after the terminating semicolon of a wrapped import statement', () => {
    const out = addBlocksImport("@import\n  'tailwindcss';\nbody {\n}\n");
    const lines = out.split('\n');
    expect(lines.slice(0, 3)).toEqual(['@import', "  'tailwindcss';", BLOCKS_IMPORT]);
  });

  it('matches the line endings of a CRLF file', () => {
    const out = addBlocksImport("@import 'tailwindcss';\r\nbody {\r\n}\r\n");
    expect(out).toContain(`\r\n${BLOCKS_IMPORT}\r\n`);
    expect(out.includes(`${BLOCKS_IMPORT}\n@`)).toBe(false);
  });

  it('keeps a leading @charset first', () => {
    const out = addBlocksImport('@charset "utf-8";\nbody {\n}\n');
    expect(out.split('\n').slice(0, 2)).toEqual(['@charset "utf-8";', BLOCKS_IMPORT]);
  });
});

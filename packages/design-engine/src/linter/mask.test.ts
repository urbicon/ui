import { describe, expect, it } from 'vitest';
import { lintDesign } from './linter.js';
import { blankRegion, maskBlockComments, maskHtmlComments, maskScriptAndStyle } from './mask.js';

/**
 * These cover the three things the masking contract promises and nothing else
 * pins: that an unclosed opener stops the scan, that a `<Scripted…>` component is
 * not a script block, and that `</script >` closes one. Each was a live behaviour
 * change when the maskers moved off non-greedy regexes; without a test they can
 * regress in silence, because every one of them shows up as a *missing* finding.
 */

describe('blankRegion', () => {
  it('keeps length and line breaks so offsets survive', () => {
    const src = 'ab\ncd\n\nef';
    const out = blankRegion(src);
    expect(out).toHaveLength(src.length);
    expect(out).toBe('  \n  \n\n  ');
  });
});

describe('maskHtmlComments', () => {
  it('blanks a comment, keeping its newlines', () => {
    expect(maskHtmlComments('a<!--\nx\n-->b')).toBe('a    \n \n   b');
  });

  it('leaves an unterminated opener — and everything after it — untouched', () => {
    const src = 'a<!--never closed\nfocus:ring-2';
    expect(maskHtmlComments(src)).toBe(src);
  });

  it('stays linear on many unterminated openers', () => {
    // The regex this replaced restarted at each opener and scanned to EOF: 50k of
    // them took ~4 s. A generous ceiling — the point is the shape, not the number.
    const src = '<!--'.repeat(50_000);
    const started = performance.now();
    expect(maskHtmlComments(src)).toBe(src);
    expect(performance.now() - started).toBeLessThan(500);
  });

  it('takes the first closer, so a second opener inside a comment is part of it', () => {
    expect(maskHtmlComments('<!--a<!--b-->c')).toBe('             c');
  });

  it('does not treat `<!-->` as a complete comment', () => {
    expect(maskHtmlComments('<!-->')).toBe('<!-->');
  });

  it('closes on `--!>`, which HTML accepts as a comment end', () => {
    expect(maskHtmlComments('<!--x--!>tail')).toBe(`${' '.repeat(9)}tail`);
  });

  it('treats `<!---->` as an empty one', () => {
    expect(maskHtmlComments('<!---->')).toBe('       ');
  });
});

describe('maskBlockComments', () => {
  it('blanks `/* … */` and leaves `/*/` alone', () => {
    expect(maskBlockComments('a/*x*/b')).toBe('a     b');
    expect(maskBlockComments('/*/')).toBe('/*/');
  });

  it('leaves an unterminated opener untouched', () => {
    const src = 'const a = 1; /* never closed';
    expect(maskBlockComments(src)).toBe(src);
  });
});

describe('maskScriptAndStyle', () => {
  it('blanks a script block, tags included', () => {
    expect(maskScriptAndStyle('<script>x</script>!')).toBe('                  !');
  });

  it('closes on `</script >`, which HTML allows', () => {
    const src = '<script>x</script >tail';
    expect(maskScriptAndStyle(src)).toBe(`${' '.repeat(19)}tail`);
  });

  it('closes on a closing tag carrying junk, as an HTML parser does', () => {
    const src = '<script>x</script foo>tail';
    expect(maskScriptAndStyle(src)).toBe(`${' '.repeat(22)}tail`);
  });

  it('does not close on `</scriptx>`', () => {
    const src = '<script>x</scriptx>';
    expect(maskScriptAndStyle(src)).toBe(src);
  });

  it('does not open a region on a component whose name starts with the tag', () => {
    const src = '<ScriptEditor mode="ts" />after';
    expect(maskScriptAndStyle(src)).toBe(src);
  });

  it('leaves an unterminated `<script>` and the markup after it untouched', () => {
    const src = '<script>const a = 1;\n<div>still markup</div>';
    expect(maskScriptAndStyle(src)).toBe(src);
  });
});

describe('the linter sees what the masks leave behind', () => {
  it('lints markup that follows a `<Scripted…>` component', async () => {
    // Regression: `<script` without a word boundary matched inside `<ScriptEditor`
    // and blanked everything up to the next `</script>`, so the violation on the
    // first line went unreported and the file scored a clean 100.
    const { findings } = await lintDesign(
      '<ScriptEditor class="bg-red-500" />\n<script>\n  const c = 1;\n</script>\n',
      { filename: 'A.svelte' }
    );
    expect(findings.some((f) => f.line === 1)).toBe(true);
  });

  it('still lints a class literal in a body closed by `</script >`', async () => {
    // The mask and the code view have to agree on where the body ends; while they
    // did not, this literal stopped being linted without a word.
    const { findings } = await lintDesign(
      "<script>\n  const c = 'bg-red-500';\n</script >\n<div>x</div>\n",
      { filename: 'B.svelte' }
    );
    expect(findings.some((f) => f.line === 2)).toBe(true);
  });
});

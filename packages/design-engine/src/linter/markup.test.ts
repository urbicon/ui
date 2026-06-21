import { describe, expect, it } from 'vitest';
import { type Element, innerContent, scanMarkup } from './markup.js';

/** Find the first scanned element with a given tag. */
function tag(els: Element[], name: string): Element | undefined {
  return els.find((e) => e.tag === name);
}

describe('scanMarkup', () => {
  it('extracts a component with string, expression, and boolean attributes', () => {
    const els = scanMarkup('<Button intent="primary" onclick={save} disabled>Save</Button>');
    expect(els).toHaveLength(1);
    const b = els[0]!;
    expect(b.tag).toBe('Button');
    expect(b.isComponent).toBe(true);
    expect(b.selfClosing).toBe(false);
    expect(b.attrs).toEqual([
      { name: 'intent', value: 'primary', kind: 'string', line: 1 },
      { name: 'onclick', value: 'save', kind: 'expression', line: 1 },
      { name: 'disabled', value: null, kind: 'boolean', line: 1 }
    ]);
  });

  it('distinguishes components from raw HTML elements', () => {
    const els = scanMarkup('<div><Button /><Foo.Bar /><button /></div>');
    expect(tag(els, 'div')?.isComponent).toBe(false);
    expect(tag(els, 'Button')?.isComponent).toBe(true);
    expect(tag(els, 'Foo.Bar')?.isComponent).toBe(true);
    expect(tag(els, 'button')?.isComponent).toBe(false);
  });

  it('marks self-closing tags', () => {
    const els = scanMarkup('<Icon name="x" />');
    expect(els[0]!.selfClosing).toBe(true);
    expect(els[0]!.attrs[0]).toEqual({ name: 'name', value: 'x', kind: 'string', line: 1 });
  });

  it('does not let a `>` inside an expression terminate the tag early', () => {
    const els = scanMarkup('<Box class={a > b ? "x" : "y"} role="grid">hi</Box>');
    const box = tag(els, 'Box')!;
    expect(box.attrs.map((a) => a.name)).toEqual(['class', 'role']);
    expect(box.attrs[1]).toEqual({ name: 'role', value: 'grid', kind: 'string', line: 1 });
  });

  it('handles object literals and template strings inside an expression attribute', () => {
    const els = scanMarkup('<C style={{ a: `${x}`, b: "}" }} id="z" />');
    const c = tag(els, 'C')!;
    expect(c.attrs.map((a) => a.name)).toEqual(['style', 'id']);
    expect(c.attrs[1]!.value).toBe('z');
  });

  it('reads shorthand and spread attributes', () => {
    const els = scanMarkup('<C {value} {...rest} />');
    expect(els[0]!.attrs).toEqual([
      { name: 'value', value: 'value', kind: 'shorthand', line: 1 },
      { name: '', value: 'rest', kind: 'spread', line: 1 }
    ]);
  });

  it('tracks line numbers across a multiline tag', () => {
    const src = '<div>\n  <Button\n    intent="primary"\n  >Go</Button>\n</div>';
    const els = scanMarkup(src);
    const b = tag(els, 'Button')!;
    expect(b.line).toBe(2);
    expect(b.attrs[0]).toEqual({ name: 'intent', value: 'primary', kind: 'string', line: 3 });
  });

  it('ignores markup inside <script> and <style> blocks', () => {
    const src =
      '<script>\n  const html = "<Button bad>";\n</script>\n<Button intent="primary" />\n<style>\n  .x { color: red }\n</style>';
    const els = scanMarkup(src);
    expect(els).toHaveLength(1);
    expect(els[0]!.tag).toBe('Button');
    expect(els[0]!.line).toBe(4); // script newlines were preserved
  });

  it('skips a malformed (unterminated) tag without crashing or guessing', () => {
    const els = scanMarkup('<Button intent="primary'); // no closing quote or >
    expect(els).toEqual([]);
  });

  it('ignores closing tags, fragments, and svelte blocks', () => {
    const els = scanMarkup('{#if x}<Button />{/if}</wrap>< notATag>');
    expect(els.map((e) => e.tag)).toEqual(['Button']);
  });
});

describe('innerContent', () => {
  const only = (src: string): { el: Element; src: string } => ({ el: scanMarkup(src)[0]!, src });

  it('returns the inner text of an element', () => {
    const { el, src } = only('<Button>Save</Button>');
    expect(innerContent(src, el)).toBe('Save');
  });

  it('honours same-name nesting', () => {
    const src = '<Menu><Menu>inner</Menu>outer</Menu>';
    const el = scanMarkup(src)[0]!;
    expect(innerContent(src, el)).toBe('<Menu>inner</Menu>outer');
  });

  it('returns null for a self-closing element', () => {
    const { el, src } = only('<Icon name="x" />');
    expect(innerContent(src, el)).toBe(null);
  });

  it('returns null when no balanced close exists', () => {
    const { el, src } = only('<Button>oops');
    expect(innerContent(src, el)).toBe(null);
  });

  it('sees only an icon child for an icon-only button (no text)', () => {
    const { el, src } = only('<button><SearchIcon /></button>');
    const inner = innerContent(src, el)!;
    expect(inner.includes('SearchIcon')).toBe(true);
    expect(inner.replace(/<[^>]*>/g, '').trim()).toBe(''); // no human text once tags are stripped
  });
});

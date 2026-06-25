import { describe, expect, it } from 'vitest';
import { findHardcodedStrings } from './hardcoded';

describe('findHardcodedStrings', () => {
  it('flags human-readable markup text and checked attributes, skipping the rest', async () => {
    const code = `<script>const x = 1;</script>
      <button aria-label="Close dialog">{bt('button.save')}</button>
      <input placeholder="Search users" class="search-input" />
      <a href="https://example.com">Visit site</a>
      <span>Welcome back</span>
      <T key="dialog.title">Fallback text</T>
      <code>user.profile.name</code>
      <p>{count}</p>`;
    const findings = await findHardcodedStrings(code, 'X.svelte');
    const texts = findings.map((f) => f.text);

    // flagged
    expect(findings).toContainEqual(
      expect.objectContaining({ kind: 'attribute', attribute: 'aria-label', text: 'Close dialog' })
    );
    expect(findings).toContainEqual(
      expect.objectContaining({ kind: 'attribute', attribute: 'placeholder', text: 'Search users' })
    );
    expect(texts).toContain('Visit site');
    expect(texts).toContain('Welcome back');

    // not flagged
    expect(texts).not.toContain('Fallback text'); // inside <T>
    expect(texts).not.toContain('dialog.title'); // <T> key attribute
    expect(texts).not.toContain('user.profile.name'); // dotted key shape
    expect(texts).not.toContain('search-input'); // unchecked attribute (class)
    expect(texts.some((t) => t.includes('example.com'))).toBe(false); // URL
    expect(texts.some((t) => t.includes('button.save'))).toBe(false); // already a t() key
  });

  it('skips short, numeric, and code-shaped strings', async () => {
    const code = `<span>OK</span><span>123</span><span>{value}</span><span>camelCaseVar</span>`;
    const findings = await findHardcodedStrings(code, 'X.svelte');
    expect(findings).toEqual([]);
  });

  it('respects an ignoreStrings allowlist (exact and glob)', async () => {
    const code = `<span>Beta</span><span>Internal note here</span>`;
    const findings = await findHardcodedStrings(code, 'X.svelte', {
      ignoreStrings: ['Beta', 'Internal*']
    });
    expect(findings).toEqual([]);
  });

  it('checks a custom attribute set', async () => {
    const code = `<custom-el data-label="Hello world" title="Tooltip text" />`;
    const findings = await findHardcodedStrings(code, 'X.svelte', { attributes: ['data-label'] });
    expect(findings.map((f) => f.attribute)).toEqual(['data-label']); // title no longer checked
    expect(findings[0]?.text).toBe('Hello world');
  });

  it('reports the line number of each finding', async () => {
    const code = `<div>\n  <span>Save changes</span>\n</div>`;
    const findings = await findHardcodedStrings(code, 'X.svelte');
    expect(findings[0]).toMatchObject({ text: 'Save changes', line: 2 });
  });
});

import { describe, expect, test } from 'vitest';
import { readBaseMeta } from './base.ts';

const META = 'notes:base';

/** A document with exactly one `<meta>` — or none. */
function doc(content: string | null) {
  return {
    querySelector: (selector: string) =>
      content !== null && selector === `meta[name="${META}"]`
        ? { getAttribute: (name: string) => (name === 'content' ? content : null) }
        : null
  };
}

describe('the app’s base in the view', () => {
  test('the URL from the <meta>, without a trailing slash', () => {
    expect(readBaseMeta(doc('https://notes.example'), META)).toBe('https://notes.example');
    expect(readBaseMeta(doc('https://notes.example/'), META)).toBe('https://notes.example');
    expect(readBaseMeta(doc('http://localhost:5184'), META)).toBe('http://localhost:5184');
  });

  test('without a replaced placeholder no base — and so no link into nowhere', () => {
    expect(readBaseMeta(doc('__NOTES_BASE__'), META)).toBeNull();
    expect(readBaseMeta(doc(null), META)).toBeNull();
    expect(readBaseMeta(doc(''), META)).toBeNull();
    expect(readBaseMeta(doc('javascript:alert(1)'), META)).toBeNull();
  });

  test('the meta name is the app’s — another name reads nothing', () => {
    expect(readBaseMeta(doc('https://notes.example'), 'other:base')).toBeNull();
  });
});
